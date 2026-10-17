import { PUZZLES } from './puzzles.js'

export const DEFAULT_SETTINGS = { rounds: 10, seconds: 30, category: 'tudo' }
export const REVEAL_SECONDS = 5

const STOP = new Set(['o', 'a', 'os', 'as', 'the', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'e', 'and', 'of', 'el', 'la'])

export function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .join('')
}

export function distance(a, b) {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[n]
}

// Aceita pequenas gralhas: 1 letra a partir de 5, 2 a partir de 10.
export function checkGuess(guess, puzzle) {
  const g = normalize(guess)
  if (!g) return 'errado'
  let best = Infinity
  for (const ans of puzzle.a) {
    const t = normalize(ans)
    const d = distance(g, t)
    const tol = t.length >= 10 ? 2 : t.length >= 5 ? 1 : 0
    if (d <= tol) return 'certo'
    best = Math.min(best, d / Math.max(1, t.length))
  }
  return best <= 0.34 ? 'quase' : 'errado'
}

// Pista: primeira letra de cada palavra e o resto em tracinhos.
export function hintFor(answer) {
  return answer
    .split(' ')
    .map((w) => [...w].map((ch, i) => (i === 0 || !/[\p{L}\p{N}]/u.test(ch) ? ch : '_')).join(' '))
    .join('   ')
}

export function pickPuzzles(count, category = 'tudo', rand = Math.random) {
  const ids = PUZZLES.map((_, i) => i).filter((i) => category === 'tudo' || PUZZLES[i].c === category)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids.slice(0, count)
}

export function pointsFor(leftMs, totalMs, first) {
  return 50 + Math.ceil((100 * Math.max(0, leftMs)) / totalMs) + (first ? 25 : 0)
}

function startRound(game, round, now) {
  return { ...game, phase: 'adivinhar', round, solved: {}, tries: {}, deadline: now + game.settings.seconds * 1000, startedAt: now }
}

const reveal = (game, now) => ({ ...game, phase: 'revelar', deadline: now + REVEAL_SECONDS * 1000 })

function advance(game, now) {
  if (game.phase === 'adivinhar') return reveal(game, now)
  if (game.phase === 'revelar') return game.round >= game.puzzles.length ? { ...game, phase: 'final', deadline: null } : startRound(game, game.round + 1, now)
  return game
}

export const puzzleOf = (game) => PUZZLES[game.puzzles[game.round - 1]]

export const emojisOnline = {
  minPlayers: 2,
  maxPlayers: 10,
  tick: true,
  start(players, action, now) {
    const settings = { ...DEFAULT_SETTINGS, ...(action.settings || {}) }
    const ids = players.map((p) => p.id)
    const puzzles = pickPuzzles(settings.rounds, settings.category)
    if (!puzzles.length) throw new Error('Não há enigmas nessa categoria.')
    return startRound({ settings, playerIds: ids, puzzles, scores: Object.fromEntries(ids.map((id) => [id, 0])) }, 1, now)
  },
  reduce(game, action, fromId, { now, isHost }) {
    switch (action.type) {
      case 'guess': {
        if (game.phase !== 'adivinhar') return game
        if (!game.playerIds.includes(fromId)) throw new Error('Não estás a jogar.')
        if (game.solved[fromId]) return game
        const tries = { ...game.tries, [fromId]: (game.tries[fromId] || 0) + 1 }
        if (checkGuess(action.text, puzzleOf(game)) !== 'certo') return { ...game, tries }
        const first = Object.keys(game.solved).length === 0
        const points = pointsFor(game.deadline - now, game.settings.seconds * 1000, first)
        const solved = { ...game.solved, [fromId]: { points, at: now - game.startedAt } }
        const next = { ...game, tries, solved, scores: { ...game.scores, [fromId]: (game.scores[fromId] || 0) + points } }
        return game.playerIds.every((id) => solved[id]) ? reveal(next, now) : next
      }
      case 'next': {
        if (!isHost) throw new Error('Só o anfitrião pode avançar.')
        return advance(game, now)
      }
      case 'restart': {
        if (!isHost || game.phase !== 'final') return game
        const puzzles = pickPuzzles(game.settings.rounds, game.settings.category)
        return startRound({ ...game, puzzles, scores: Object.fromEntries(game.playerIds.map((id) => [id, 0])) }, 1, now)
      }
      case 'tick': {
        if (!game.deadline || now < game.deadline) return game
        return advance(game, now)
      }
      default:
        throw new Error('Ação desconhecida.')
    }
  },
}
