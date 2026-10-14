export const MAX_CAPTION = 90
export const DEFAULT_SETTINGS = { rounds: 3, writeSeconds: 90, voteSeconds: 45, resultsSeconds: 12 }
export const POINTS_PER_VOTE = 100
export const ROUND_WINNER_BONUS = 50

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Posições iniciais das caixas de texto (em %), espalhadas na vertical.
export function defaultCaptions(boxes) {
  const n = Math.max(1, boxes)
  if (n === 2) return [{ text: '', x: 50, y: 10 }, { text: '', x: 50, y: 88 }]
  return Array.from({ length: n }, (_, i) => ({ text: '', x: 50, y: Math.round(((i + 0.5) / n) * 100) }))
}

function cleanCaptions(captions, boxes) {
  if (!Array.isArray(captions)) throw new Error('Meme inválido.')
  return captions.slice(0, Math.max(5, boxes)).map((c) => ({
    text: String(c?.text ?? '').slice(0, MAX_CAPTION),
    x: Math.min(100, Math.max(0, Number(c?.x) || 50)),
    y: Math.min(100, Math.max(0, Number(c?.y) || 50)),
  }))
}

function pickTemplates(pool, playerIds, avoid) {
  const fresh = shuffle(pool.filter((t) => !avoid.has(t.id)))
  const source = fresh.length >= playerIds.length ? fresh : shuffle(pool)
  const out = {}
  playerIds.forEach((id, i) => {
    out[id] = source[i % source.length]
  })
  return out
}

function startRound(game, round, now) {
  const ids = game.playerIds
  const templates = pickTemplates(game.pool, ids, new Set(game.used))
  return {
    ...game,
    phase: 'writing',
    round,
    deadline: now + game.settings.writeSeconds * 1000,
    templates,
    used: [...game.used, ...Object.values(templates).map((t) => t.id)],
    rerolled: {},
    memes: {},
    order: [],
    votes: {},
    roundPoints: {},
  }
}

function toVoting(game, now) {
  const order = shuffle(Object.keys(game.memes).filter((id) => game.memes[id].captions.some((c) => c.text.trim())))
  if (order.length === 0) return toResults({ ...game, order }, now)
  return { ...game, phase: 'voting', order, votes: {}, deadline: now + game.settings.voteSeconds * 1000 }
}

function toResults(game, now) {
  const tally = {}
  for (const target of Object.values(game.votes)) tally[target] = (tally[target] || 0) + 1
  const top = Math.max(0, ...Object.values(tally))
  const roundPoints = {}
  for (const id of game.playerIds) {
    const v = tally[id] || 0
    roundPoints[id] = v * POINTS_PER_VOTE + (top > 0 && v === top ? ROUND_WINNER_BONUS : 0)
  }
  const scores = { ...game.scores }
  for (const [id, pts] of Object.entries(roundPoints)) scores[id] = (scores[id] || 0) + pts
  const best = top > 0 ? Object.keys(tally).filter((id) => tally[id] === top) : []
  const hall = [
    ...game.hall,
    ...best.map((id) => ({ round: game.round, playerId: id, template: game.templates[id], captions: game.memes[id].captions })),
  ]
  return {
    ...game,
    phase: 'results',
    tally,
    roundPoints,
    scores,
    hall,
    deadline: now + game.settings.resultsSeconds * 1000,
  }
}

function advanceFromResults(game, now) {
  if (game.round >= game.settings.rounds) return { ...game, phase: 'final', deadline: null }
  return startRound(game, game.round + 1, now)
}

export const memesOnline = {
  minPlayers: 2,
  maxPlayers: 8,
  tick: true,
  start(players, action, now) {
    const pool = Array.isArray(action.templates) && action.templates.length ? action.templates : []
    if (pool.length === 0) throw new Error('Não há modelos de memes carregados.')
    const settings = { ...DEFAULT_SETTINGS, ...(action.settings || {}) }
    const base = {
      settings,
      pool,
      used: [],
      playerIds: players.map((p) => p.id),
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      hall: [],
    }
    return startRound(base, 1, now)
  },
  reduce(game, action, fromId, { now, isHost }) {
    switch (action.type) {
      case 'submit': {
        if (game.phase !== 'writing') throw new Error('Já não dá para mudar o meme.')
        if (!game.playerIds.includes(fromId)) throw new Error('Não estás a jogar.')
        const tpl = game.templates[fromId]
        const memes = { ...game.memes, [fromId]: { captions: cleanCaptions(action.captions, tpl.boxes), done: !!action.done } }
        const next = { ...game, memes }
        const allDone = game.playerIds.every((id) => memes[id]?.done)
        return allDone ? toVoting(next, now) : next
      }
      case 'reroll': {
        if (game.phase !== 'writing') return game
        if (game.rerolled[fromId]) throw new Error('Só podes trocar de imagem uma vez por ronda.')
        const avoid = new Set([...game.used, ...Object.values(game.templates).map((t) => t.id)])
        const [tpl] = Object.values(pickTemplates(game.pool, [fromId], avoid))
        const memes = { ...game.memes }
        delete memes[fromId]
        return {
          ...game,
          templates: { ...game.templates, [fromId]: tpl },
          used: [...game.used, tpl.id],
          rerolled: { ...game.rerolled, [fromId]: true },
          memes,
        }
      }
      case 'vote': {
        if (game.phase !== 'voting') throw new Error('A votação já acabou.')
        if (!game.playerIds.includes(fromId)) throw new Error('Não estás a jogar.')
        if (action.target === fromId) throw new Error('Não podes votar no teu próprio meme.')
        if (!game.order.includes(action.target)) throw new Error('Meme inválido.')
        const votes = { ...game.votes, [fromId]: action.target }
        const next = { ...game, votes }
        // Fecha a votação quando todos os que podem votar já votaram.
        const voters = game.playerIds.filter((id) => game.order.some((t) => t !== id))
        return voters.every((id) => votes[id]) ? toResults(next, now) : next
      }
      case 'next': {
        if (!isHost) throw new Error('Só o anfitrião pode avançar.')
        if (game.phase === 'results') return advanceFromResults(game, now)
        if (game.phase === 'writing') return toVoting(game, now)
        if (game.phase === 'voting') return toResults(game, now)
        return game
      }
      case 'restart': {
        if (!isHost) throw new Error('Só o anfitrião pode recomeçar.')
        if (game.phase !== 'final') return game
        return startRound(
          { ...game, scores: Object.fromEntries(game.playerIds.map((id) => [id, 0])), hall: [], used: [] },
          1,
          now
        )
      }
      case 'tick': {
        if (!game.deadline || now < game.deadline) return game
        if (game.phase === 'writing') return toVoting(game, now)
        if (game.phase === 'voting') return toResults(game, now)
        if (game.phase === 'results') return advanceFromResults(game, now)
        return game
      }
      default:
        throw new Error('Ação desconhecida.')
    }
  },
}
