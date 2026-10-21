// Emoji do Dia: 5 enigmas por dia, os mesmos para toda a gente (dia de Lisboa).
// Cada enigma tem 3 tentativas; depois da 2.ª errada aparece a pista.
import { PUZZLES } from '../emojis/puzzles.js'

export const PER_DAY = 5
export const MAX_TRIES = 3
const FIRST_DAY = Date.UTC(2026, 9, 21) // #1 = 21 de outubro de 2026
const SITE = 'https://tugagames.pt'

// "2026-10-22" no fuso de Lisboa.
export function lisbonDay(now = Date.now()) {
  return new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Europe/Lisbon' })
}

export function dayNumber(day = lisbonDay()) {
  const [y, m, d] = day.split('-').map(Number)
  return Math.floor((Date.UTC(y, m - 1, d) - FIRST_DAY) / 86400000) + 1
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Ordem fixa de todos os enigmas; cada dia leva os 5 seguintes (só se repetem
// quando a lista dá a volta).
const ORDER = (() => {
  const ids = PUZZLES.map((_, i) => i)
  const rand = mulberry32(20261022)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids
})()

export function puzzlesOfDay(n) {
  const start = (((n - 1) * PER_DAY) % ORDER.length + ORDER.length) % ORDER.length
  return Array.from({ length: PER_DAY }, (_, k) => ORDER[(start + k) % ORDER.length])
}

// Resultado de cada enigma: 1, 2 ou 3 = acertou nessa tentativa; 0 = falhou.
export const SQUARE = { 1: '🟩', 2: '🟨', 3: '🟧', 0: '🟥' }
export const squares = (results) => results.map((r) => SQUARE[r]).join('')
export const solvedCount = (results) => results.filter((r) => r > 0).length

export function shareText(n, results) {
  const url = `${SITE}/emoji-do-dia?utm_source=partilha&utm_medium=social&utm_campaign=emoji_do_dia`
  return { text: `Emoji do Dia #${n} ${squares(results)} ${solvedCount(results)}/${PER_DAY}\nConsegues fazer melhor? 👉`, url }
}

// Milissegundos até à meia-noite de Lisboa.
export function msToNextDay(now = Date.now()) {
  const today = lisbonDay(now)
  let t = now + 60000
  // avança de 5 em 5 minutos até mudar o dia e afina ao minuto
  while (lisbonDay(t) === today) t += 5 * 60000
  t -= 5 * 60000
  while (lisbonDay(t) === today) t += 60000
  return Math.max(0, t - now)
}

// Sequência de dias seguidos (a partir dos dias jogados guardados).
export function streakOf(days, today = lisbonDay()) {
  const set = new Set(days)
  let n = dayNumber(today)
  if (!set.has(today)) n -= 1 // ainda não jogou hoje: conta até ontem
  let streak = 0
  const dayOf = (k) => new Date(FIRST_DAY + (k - 1) * 86400000).toISOString().slice(0, 10)
  while (n >= 1 && set.has(dayOf(n))) {
    streak++
    n--
  }
  return streak
}

// ---- Guardado neste browser ----
export const STATE_KEY = (day) => `tg-emojidia-${day}`
export const DAYS_KEY = 'tg-emojidia-dias'
export function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key))
    return v ?? fallback
  } catch {
    return fallback
  }
}

// Resultado de hoje neste browser (null = ainda não acabou).
export function todayResult() {
  const st = load(STATE_KEY(lisbonDay()), null)
  return st?.results?.length === PER_DAY ? st.results : null
}
