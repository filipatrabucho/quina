import { supabase } from '../../../lib/supabaseClient.js'
import { GRID_SIZE } from '../utils/fiadaLogic.js'
import { getDisplayName, getAvatarUrl } from '../../../lib/discordProfile.js'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode() {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export async function createFiadaRoom(maxPlayers = 5) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Precisas de iniciar sessão com o Discord primeiro.')

  const code = randomCode()
  const emptyCells = Array(GRID_SIZE * GRID_SIZE).fill(null)

  // O baralho só é montado quando o jogo começa (fiada_start_room), porque
  // só aí sabemos quantos jogadores vão mesmo jogar — as regras dizem um
  // conjunto de 1-20 por jogador em jogo.
  const { data, error } = await supabase
    .from('fiada_rooms')
    .insert({
      host_id: user.id,
      code,
      max_players: maxPlayers,
      players: [{
        id: user.id,
        name: getDisplayName(user),
        avatar: getAvatarUrl(user),
        cells: emptyCells,
        moves: 0,
      }],
      deck: [],
      face_up: [],
      draw_index: 0,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function joinFiadaRoom(code) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase.rpc('fiada_join_room', {
    p_code: code.trim().toUpperCase(),
    p_name: getDisplayName(user),
    p_avatar: getAvatarUrl(user),
  })
  if (error) throw error
  return data
}

export async function startFiadaRoom(roomId) {
  const { data, error } = await supabase.rpc('fiada_start_room', { p_room_id: roomId })
  if (error) throw error
  return data
}

export async function getFiadaRoom(roomId) {
  const { data, error } = await supabase.from('fiada_rooms').select('*').eq('id', roomId).single()
  if (error) throw error
  return data
}

export async function fiadaDrawBlind(roomId) {
  const { data, error } = await supabase.rpc('fiada_draw_blind', { p_room_id: roomId })
  if (error) throw error
  return data
}

export async function fiadaPickFaceUp(roomId, idx) {
  const { data, error } = await supabase.rpc('fiada_pick_faceup', { p_room_id: roomId, p_idx: idx })
  if (error) throw error
  return data
}

export async function fiadaPlace(roomId, index) {
  const { data, error } = await supabase.rpc('fiada_place', { p_room_id: roomId, p_index: index })
  if (error) throw error
  return data
}

export async function fiadaPassTurn(roomId) {
  const { data, error } = await supabase.rpc('fiada_pass_turn', { p_room_id: roomId })
  if (error) throw error
  return data
}

export async function fiadaDiscard(roomId) {
  const { data, error } = await supabase.rpc('fiada_discard', { p_room_id: roomId })
  if (error) throw error
  return data
}

export function subscribeToFiadaRoom(roomId, onChange) {
  const channel = supabase
    .channel(`fiada-room-${roomId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'fiada_rooms', filter: `id=eq.${roomId}` },
      (payload) => onChange(payload.new)
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}