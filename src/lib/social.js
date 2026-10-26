import { supabase } from './supabaseClient.js'
import { track } from './analytics.js'
import { GAME_FINISHED, logPlay, countGuestPlay, modeOfKey } from './plays.js'

const PROFILE_FIELDS = 'id, username, avatar_url, bio, links, created_at'

function fail(error) {
  if (error) throw new Error(error.message)
}

export async function getProfileById(id) {
  const { data, error } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('id', id).maybeSingle()
  fail(error)
  return data
}

// Devolve o perfil do utilizador com sessão; se a conta ainda não tiver
// perfil (contas antigas), cria-o.
export async function getOrCreateMyProfile(id) {
  const existing = await getProfileById(id)
  if (existing) return existing
  const { error } = await supabase.rpc('ensure_profile')
  fail(error)
  return getProfileById(id)
}

export async function getProfileByUsername(username) {
  const { data, error } = await supabase.from('profiles').select(PROFILE_FIELDS).ilike('username', username).maybeSingle()
  fail(error)
  return data
}

export async function getProfilesByIds(ids) {
  if (!ids.length) return []
  const { data, error } = await supabase.from('profiles').select(PROFILE_FIELDS).in('id', ids)
  fail(error)
  return data
}

export async function searchProfiles(query, excludeId) {
  const raw = query.trim()
  if (raw.length < 2) return []
  const q = raw.replace(/[\\%_]/g, (c) => `\\${c}`) // "_" e "%" contam como letras normais
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_FIELDS)
    .ilike('username', `%${q}%`)
    .neq('id', excludeId)
    .order('username')
    .limit(10)
  fail(error)
  return data
}

export async function updatePublicProfile(id, { bio, links }) {
  const { error } = await supabase.from('profiles').update({ bio, links }).eq('id', id)
  fail(error)
}

export async function getMedalsAndStats(userId) {
  const [medals, stats] = await Promise.all([
    supabase.from('user_medals').select('medal, earned_at').eq('user_id', userId),
    supabase.from('player_stats').select('game, plays, wins, best_streak').eq('user_id', userId),
  ])
  fail(medals.error)
  fail(stats.error)
  return { medals: medals.data, stats: stats.data }
}

// ---- Amizades ----
export async function listFriendships() {
  const { data, error } = await supabase.from('friendships').select('*').order('created_at', { ascending: false })
  fail(error)
  return data
}

export async function sendFriendRequest(myId, otherId) {
  const { error } = await supabase.from('friendships').insert({ requester: myId, addressee: otherId })
  if (error && /duplicate|unique/i.test(error.message)) throw new Error('Já existe um pedido entre vocês.')
  fail(error)
}

export async function acceptFriendRequest(id) {
  const { error } = await supabase.from('friendships').update({ status: 'aceite' }).eq('id', id)
  fail(error)
}

export async function removeFriendship(id) {
  const { error } = await supabase.from('friendships').delete().eq('id', id)
  fail(error)
}

// ---- Mensagens ----
export async function listMessages(myId, friendId, limit = 60) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender.eq.${myId},recipient.eq.${friendId}),and(sender.eq.${friendId},recipient.eq.${myId})`)
    .order('created_at', { ascending: false })
    .limit(limit)
  fail(error)
  return data.reverse()
}

export async function listUnread(myId) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender')
    .eq('recipient', myId)
    .is('read_at', null)
    .limit(500)
  fail(error)
  const counts = {}
  for (const m of data) counts[m.sender] = (counts[m.sender] || 0) + 1
  return counts
}

export async function sendMessage(myId, friendId, body) {
  const text = body.trim().slice(0, 1000)
  if (!text) return null
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender: myId, recipient: friendId, kind: 'texto', body: text })
    .select()
    .single()
  if (error && /row-level security/i.test(error.message)) throw new Error('Só podes enviar mensagens a amigos.')
  fail(error)
  return data
}

export async function sendInvite(myId, friendId, invite) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender: myId, recipient: friendId, kind: 'convite', body: invite.title, payload: invite })
    .select()
    .single()
  fail(error)
  return data
}

// Últimas mensagens recebidas (para apanhar o que o tempo real possa ter falhado).
export async function listIncoming(myId, limit = 30) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('recipient', myId)
    .order('created_at', { ascending: false })
    .limit(limit)
  fail(error)
  return data.reverse()
}

// ---- Grupos de amigos (para convidar vários de uma vez) ----
export async function listGroups() {
  const { data, error } = await supabase.from('friend_groups').select('id, name, members, created_at').order('created_at')
  fail(error)
  return data
}

export async function createGroup(myId, name, members) {
  const { data, error } = await supabase
    .from('friend_groups')
    .insert({ owner: myId, name: name.trim().slice(0, 40), members })
    .select('id, name, members, created_at')
    .single()
  fail(error)
  return data
}

export async function deleteGroup(id) {
  const { error } = await supabase.from('friend_groups').delete().eq('id', id)
  fail(error)
}

export async function markRead(friendId) {
  await supabase.rpc('mark_messages_read', { p_friend: friendId })
}

// ---- Resultados e medalhas ----
const RECORDED_KEY = 'quina-resultados-registados'

// Regista o resultado de uma partida (só para contas). `key` evita contar a
// mesma partida duas vezes (ex.: depois de um refresh).
// Avisa o resto do site (ex.: o top 3) de que as estatísticas mudaram.
export const STATS_CHANGED = 'tg-stats-changed'

export async function recordResultOnce(key, game, won, detail = null) {
  let done = []
  try {
    done = JSON.parse(localStorage.getItem(RECORDED_KEY) || '[]')
  } catch {
    done = []
  }
  if (done.includes(key)) return
  track('game_end', { game_name: game, result: won ? 'vitoria' : 'derrota' })
  const save = (list) => localStorage.setItem(RECORDED_KEY, JSON.stringify(list.slice(-300)))
  save([...done, key])
  const mode = modeOfKey(key)
  logPlay('partida', game, mode, !!won)
  const { data: s } = await supabase.auth.getSession()
  const user = s.session?.user
  const guest = !user || user.is_anonymous
  // Avisa o site (partilhar o resultado e, sem conta, sugerir criar uma).
  window.dispatchEvent(new CustomEvent(GAME_FINISHED, { detail: { game, won: !!won, detail, mode, guest, guestPlays: guest ? countGuestPlay() : 0 } }))
  if (guest) return
  const { error } = await supabase.rpc('record_game_result', { p_game: game, p_won: !!won, p_detail: detail })
  if (!error) window.dispatchEvent(new CustomEvent(STATS_CHANGED, { detail: { game } }))
  if (error) {
    // Não ficou registado: deixa tentar outra vez (ex.: depois de um refresh).
    try {
      save(JSON.parse(localStorage.getItem(RECORDED_KEY) || '[]').filter((k) => k !== key))
    } catch {
      // ignora
    }
  }
}

// ---- Redes sociais do perfil ----
export const SOCIAL_NETWORKS = [
  { key: 'twitch', label: 'Twitch', base: 'https://twitch.tv/' },
  { key: 'youtube', label: 'YouTube', base: 'https://youtube.com/@' },
  { key: 'instagram', label: 'Instagram', base: 'https://instagram.com/' },
  { key: 'tiktok', label: 'TikTok', base: 'https://tiktok.com/@' },
  { key: 'x', label: 'X', base: 'https://x.com/' },
  { key: 'steam', label: 'Steam', base: 'https://steamcommunity.com/id/' },
  { key: 'discord', label: 'Discord', base: null },
  { key: 'site', label: 'Site', base: null },
]

// Devolve um URL seguro (só https) para um link do perfil, ou null.
export function socialUrl(network, value) {
  const v = String(value || '').trim()
  if (!v) return null
  if (/^https:\/\//i.test(v)) {
    try {
      return new URL(v).href
    } catch {
      return null
    }
  }
  const net = SOCIAL_NETWORKS.find((n) => n.key === network)
  if (!net?.base) return null
  const handle = v.replace(/^@/, '')
  return /^[A-Za-z0-9_.-]{1,40}$/.test(handle) ? net.base + handle : null
}

// ---- Top de jogadores de cada jogo ----
// Jogos em que o top é pela melhor pontuação (e não pelas vitórias).
export const SCORE_GAMES = ['snake']

export async function getTopPlayers(game, limit = 3) {
  const byScore = SCORE_GAMES.includes(game)
  let q = supabase.from('player_stats').select('user_id, wins, plays, best_score').eq('game', game)
  q = byScore
    ? q.gt('best_score', 0).order('best_score', { ascending: false }).order('updated_at', { ascending: true })
    : q.gt('wins', 0).order('wins', { ascending: false }).order('plays', { ascending: true })
  const { data, error } = await q.limit(limit)
  fail(error)
  if (!data.length) return []
  const profiles = await getProfilesByIds(data.map((x) => x.user_id))
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]))
  return data.filter((x) => byId[x.user_id]).map((x) => ({ ...x, profile: byId[x.user_id] }))
}

// ---- Admin e testers ----
export async function getMyRole() {
  const { data, error } = await supabase.rpc('my_role')
  fail(error)
  return data || null
}

export async function listStaff() {
  const { data, error } = await supabase.rpc('list_staff')
  fail(error)
  return data
}

export async function setStaff(username, role) {
  const { error } = await supabase.rpc('set_staff', { p_username: username, p_role: role })
  fail(error)
}

// ---- Backoffice ----
export async function adminListUsers({ query = '', role = null, limit = 25, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc('admin_list_users', { p_query: query, p_role: role, p_limit: limit, p_offset: offset })
  fail(error)
  return { users: data || [], total: data?.[0]?.total ? Number(data[0].total) : 0 }
}

export async function adminStats() {
  const { data, error } = await supabase.rpc('admin_stats')
  fail(error)
  return data
}

export async function adminSetRole(userId, role) {
  const { error } = await supabase.rpc('admin_set_role', { p_user: userId, p_role: role })
  fail(error)
}

// ---- Carteira de fichas (a fingir) que passa de uma partida para a outra ----
async function myUserId() {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  return user && !user.is_anonymous ? user.id : null
}

// Fichas de cada id (só quem já tem carteira aparece).
export async function getWallets(game, ids) {
  const list = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  if (!list.length) return {}
  const { data, error } = await supabase.from('game_wallets').select('user_id, chips').eq('game', game).in('user_id', list)
  fail(error)
  return Object.fromEntries(data.map((w) => [w.user_id, w.chips]))
}

// As minhas fichas, ou null se ainda não tiver carteira (ou não tiver conta).
export async function getMyWallet(game) {
  const id = await myUserId()
  if (!id) return null
  const w = await getWallets(game, [id])
  return w[id] ?? null
}

export async function saveMyWallet(game, chips) {
  const id = await myUserId()
  if (!id || !Number.isFinite(chips) || chips < 0) return
  const { error } = await supabase
    .from('game_wallets')
    .upsert({ user_id: id, game, chips: Math.floor(chips), updated_at: new Date().toISOString() })
  fail(error)
}

// Quem jogou (com e sem conta), para o backoffice.
export async function adminPlayStats(days = 30) {
  const { data, error } = await supabase.rpc('admin_play_stats', { p_days: days })
  fail(error)
  return data
}

export async function adminRecentPlays(limit = 30) {
  const { data, error } = await supabase.rpc('admin_recent_plays', { p_limit: limit })
  fail(error)
  return data
}

// ---- Jogos em beta ou em produção (backoffice) ----
export async function listGameSettings() {
  let { data, error } = await supabase.from('game_settings').select('game, beta, promoted, updated_at')
  // Antes de correr o SQL novo ainda não há a coluna promoted.
  if (error) ({ data, error } = await supabase.from('game_settings').select('game, beta, updated_at'))
  fail(error)
  return data
}

export async function adminSetGamePromoted(game, promoted) {
  const { error } = await supabase.rpc('admin_set_game_promoted', { p_game: game, p_promoted: promoted })
  fail(error)
}

export async function adminSetGameBeta(game, beta) {
  const { error } = await supabase.rpc('admin_set_game_beta', { p_game: game, p_beta: beta })
  fail(error)
}

// Quem volta (por browser), para o backoffice.
export async function adminRetention(days = 30, excludeStaff = true) {
  const { data, error } = await supabase.rpc('admin_retention', { p_days: days, p_exclude_staff: excludeStaff })
  fail(error)
  return data
}

// ---- Feedback dos utilizadores ----
export async function sendFeedback(kind, message, page) {
  const { error } = await supabase.rpc('send_feedback', { p_kind: kind, p_message: message, p_page: page })
  fail(error)
}
export async function adminListFeedback(status = null) {
  const { data, error } = await supabase.rpc('admin_list_feedback', { p_status: status, p_limit: 200 })
  fail(error)
  return data
}
export async function adminSetFeedbackStatus(id, status) {
  const { error } = await supabase.rpc('admin_set_feedback_status', { p_id: id, p_status: status })
  fail(error)
}
