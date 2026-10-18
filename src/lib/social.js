import { supabase } from './supabaseClient.js'

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
export async function recordResultOnce(key, game, won, detail = null) {
  let done = []
  try {
    done = JSON.parse(localStorage.getItem(RECORDED_KEY) || '[]')
  } catch {
    done = []
  }
  if (done.includes(key)) return
  const save = (list) => localStorage.setItem(RECORDED_KEY, JSON.stringify(list.slice(-300)))
  save([...done, key])
  const { data: s } = await supabase.auth.getSession()
  const user = s.session?.user
  if (!user || user.is_anonymous) return
  const { error } = await supabase.rpc('record_game_result', { p_game: game, p_won: !!won, p_detail: detail })
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
export async function getTopPlayers(game, limit = 3) {
  const { data, error } = await supabase
    .from('player_stats')
    .select('user_id, wins, plays')
    .eq('game', game)
    .gt('wins', 0)
    .order('wins', { ascending: false })
    .order('plays', { ascending: true })
    .limit(limit)
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
