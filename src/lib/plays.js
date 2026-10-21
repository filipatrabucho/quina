import { supabase, supabaseConfigured } from './supabaseClient.js'

// Contagem de quem joga (com e sem conta), para o backoffice. Cada browser tem
// um id aleatório; não guarda nada pessoal.
const VISITOR_KEY = 'tg-visitante'
const OPENED_KEY = 'tg-jogos-abertos'
const GUEST_PLAYS_KEY = 'tg-partidas-convidado'

export const GAME_FINISHED = 'tg-game-finished'

function visitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = `v-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

export async function logPlay(kind, game, mode = null, won = null) {
  const visitor = visitorId()
  if (!supabaseConfigured || !visitor) return
  try {
    await supabase.rpc('log_play', { p_kind: kind, p_game: game, p_mode: mode, p_won: won, p_visitor: visitor })
  } catch {
    // as contagens nunca podem partir um jogo
  }
}

// Abriu a página de um jogo: conta uma vez por sessão do browser.
export function logOpen(game) {
  try {
    const seen = JSON.parse(sessionStorage.getItem(OPENED_KEY) || '[]')
    if (seen.includes(game)) return
    sessionStorage.setItem(OPENED_KEY, JSON.stringify([...seen, game]))
  } catch {
    // sem sessionStorage conta na mesma
  }
  logPlay('abriu', game)
}

// Partidas acabadas sem conta (para sugerir criar conta de vez em quando).
export function countGuestPlay() {
  try {
    const n = Number(localStorage.getItem(GUEST_PLAYS_KEY) || 0) + 1
    localStorage.setItem(GUEST_PLAYS_KEY, String(n))
    return n
  } catch {
    return 0
  }
}

// As chaves das partidas dizem o modo: as das salas levam o código da sala.
export function modeOfKey(key) {
  if (/-(bot|bots|solo)-/.test(key) || /^(snake|emojidia|fiada-solo|palavras-(?!duelo))/.test(key)) return 'solo'
  return 'online'
}

// Quantas pessoas já acabaram hoje este jogo (para mostrar no desafio diário).
export async function dailyPlayers(game) {
  if (!supabaseConfigured) return null
  const { data, error } = await supabase.rpc('daily_players', { p_game: game })
  return error ? null : data
}
