export const CATEGORIES = ['Nome', 'País ou cidade', 'Animal', 'Objeto', 'Comida', 'Profissão']
export const LETTERS = 'ABCDEFGIJLMNOPRSTUV'.split('')
export const DEFAULT_SETTINGS = { rounds: 5, seconds: 90 }
export const GRACE_MS = 2500

export function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function startsWithLetter(text, letter) {
  const n = normalize(text)
  return n.length > 1 && n[0] === letter.toLowerCase()
}

function cleanAnswers(answers) {
  const out = {}
  CATEGORIES.forEach((_, i) => {
    out[i] = String(answers?.[i] ?? '').slice(0, 40)
  })
  return out
}

function pickLetter(used) {
  const free = LETTERS.filter((l) => !used.includes(l))
  const pool = free.length ? free : LETTERS
  return pool[Math.floor(Math.random() * pool.length)]
}

// Pontos de uma ronda: 20 se fores o único com resposta válida na
// categoria, 10 se a tua resposta for diferente das outras, 5 se repetida.
export function scoreRound(game) {
  const { playerIds, answers, letter, contests } = game
  const valid = {} // pid -> catIdx -> bool
  const points = Object.fromEntries(playerIds.map((id) => [id, 0]))
  const detail = Object.fromEntries(playerIds.map((id) => [id, {}]))
  const needed = Math.max(1, Math.ceil((playerIds.length - 1) / 2))
  for (const id of playerIds) {
    valid[id] = {}
    CATEGORIES.forEach((_, c) => {
      const txt = answers[id]?.[c] || ''
      const votes = (contests[`${id}:${c}`] || []).length
      valid[id][c] = startsWithLetter(txt, letter) && votes < needed
    })
  }
  CATEGORIES.forEach((_, c) => {
    const validIds = playerIds.filter((id) => valid[id][c])
    for (const id of playerIds) {
      if (!valid[id][c]) {
        detail[id][c] = 0
        continue
      }
      const mine = normalize(answers[id][c])
      const same = validIds.filter((o) => normalize(answers[o][c]) === mine).length
      const pts = validIds.length === 1 ? 20 : same > 1 ? 5 : 10
      detail[id][c] = pts
      points[id] += pts
    }
  })
  return { points, detail }
}

function toReview(game, now, stoppedBy = null) {
  return { ...game, phase: 'rever', stoppedBy, graceUntil: now + GRACE_MS, deadline: null, contests: {} }
}

function newRound(game, round, now) {
  const letter = pickLetter(game.usedLetters)
  return {
    ...game,
    phase: 'escrever',
    round,
    letter,
    usedLetters: [...game.usedLetters, letter],
    answers: Object.fromEntries(game.playerIds.map((id) => [id, cleanAnswers({})])),
    contests: {},
    stoppedBy: null,
    graceUntil: null,
    deadline: now + game.settings.seconds * 1000,
    roundDetail: null,
    roundPoints: null,
  }
}

export const stopOnline = {
  minPlayers: 2,
  maxPlayers: 10,
  tick: true,
  start(players, action, now) {
    const settings = { ...DEFAULT_SETTINGS, ...(action.settings || {}) }
    const base = {
      settings,
      playerIds: players.map((p) => p.id),
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      usedLetters: [],
    }
    return newRound(base, 1, now)
  },
  reduce(game, action, fromId, { now, isHost }) {
    switch (action.type) {
      case 'answers': {
        const open = game.phase === 'escrever' || (game.phase === 'rever' && now < game.graceUntil)
        if (!open) return game
        if (!game.playerIds.includes(fromId)) throw new Error('Não estás a jogar.')
        return { ...game, answers: { ...game.answers, [fromId]: cleanAnswers(action.answers) } }
      }
      case 'stop': {
        if (game.phase !== 'escrever') return game
        const answers = cleanAnswers(action.answers)
        if (!CATEGORIES.every((_, i) => answers[i].trim())) throw new Error('Preenche todas as categorias antes do STOP.')
        return toReview({ ...game, answers: { ...game.answers, [fromId]: answers } }, now, fromId)
      }
      case 'contest': {
        if (game.phase !== 'rever') throw new Error('Já não dá para contestar.')
        if (action.target === fromId) return game
        const key = `${action.target}:${action.cat}`
        const list = game.contests[key] || []
        const next = list.includes(fromId) ? list.filter((x) => x !== fromId) : [...list, fromId]
        return { ...game, contests: { ...game.contests, [key]: next } }
      }
      case 'next': {
        if (!isHost) throw new Error('Só o anfitrião pode avançar.')
        if (game.phase === 'escrever') return toReview(game, now)
        if (game.phase === 'rever') {
          const { points, detail } = scoreRound(game)
          const scores = { ...game.scores }
          for (const [id, p] of Object.entries(points)) scores[id] = (scores[id] || 0) + p
          return { ...game, phase: 'resultados', roundPoints: points, roundDetail: detail, scores }
        }
        if (game.phase === 'resultados') {
          return game.round >= game.settings.rounds ? { ...game, phase: 'final' } : newRound(game, game.round + 1, now)
        }
        return game
      }
      case 'restart': {
        if (!isHost || game.phase !== 'final') return game
        return newRound({ ...game, scores: Object.fromEntries(game.playerIds.map((id) => [id, 0])), usedLetters: [] }, 1, now)
      }
      case 'tick': {
        if (game.phase === 'escrever' && game.deadline && now >= game.deadline) return toReview(game, now)
        return game
      }
      default:
        throw new Error('Ação desconhecida.')
    }
  },
}
