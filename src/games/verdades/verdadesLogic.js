export const MAX_LEN = 120
export const DEFAULT_SETTINGS = { writeSeconds: 90, guessSeconds: 30 }
export const REVEAL_SECONDS = 10
export const POINTS_RIGHT = 100
export const POINTS_FOOLED = 50

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const entryValid = (e) => !!e && e.statements.every((s) => s.trim()) && [0, 1, 2].includes(e.lie)

function cleanEntry(raw) {
  const statements = [0, 1, 2].map((i) => String(raw?.statements?.[i] ?? '').slice(0, MAX_LEN))
  const lie = [0, 1, 2].includes(raw?.lie) ? raw.lie : null
  return { statements, lie, done: !!raw?.done && lie !== null && statements.every((s) => s.trim()) }
}

function toWriting(game, now) {
  return {
    ...game,
    phase: 'escrever',
    entries: {},
    queue: [],
    current: 0,
    perm: null,
    votes: {},
    roundPoints: null,
    deadline: now + game.settings.writeSeconds * 1000,
  }
}

function setSubject(game, k, now) {
  return { ...game, phase: 'adivinhar', current: k, perm: shuffle([0, 1, 2]), votes: {}, roundPoints: null, deadline: now + game.settings.guessSeconds * 1000 }
}

function toGuessing(game, now) {
  const queue = shuffle(game.playerIds.filter((id) => entryValid(game.entries[id])))
  if (queue.length === 0) return { ...game, phase: 'final', queue, deadline: null }
  return setSubject({ ...game, queue }, 0, now)
}

export const subjectOf = (game) => game.queue[game.current]
// Posição (no ecrã) da mentira do jogador atual.
export const lieShown = (game) => game.perm.indexOf(game.entries[subjectOf(game)].lie)

function reveal(game, now) {
  const subject = subjectOf(game)
  const lie = lieShown(game)
  const roundPoints = Object.fromEntries(game.playerIds.map((id) => [id, 0]))
  for (const [voter, idx] of Object.entries(game.votes)) {
    if (idx === lie) roundPoints[voter] += POINTS_RIGHT
    else roundPoints[subject] += POINTS_FOOLED
  }
  const scores = { ...game.scores }
  for (const [id, p] of Object.entries(roundPoints)) scores[id] = (scores[id] || 0) + p
  return { ...game, phase: 'revelar', roundPoints, scores, deadline: now + REVEAL_SECONDS * 1000 }
}

function advance(game, now) {
  if (game.phase === 'escrever') return toGuessing(game, now)
  if (game.phase === 'adivinhar') return reveal(game, now)
  if (game.phase === 'revelar') {
    return game.current + 1 < game.queue.length ? setSubject(game, game.current + 1, now) : { ...game, phase: 'final', deadline: null }
  }
  return game
}

export const verdadesOnline = {
  minPlayers: 2,
  maxPlayers: 10,
  tick: true,
  start(players, action, now) {
    const settings = { ...DEFAULT_SETTINGS, ...(action.settings || {}) }
    const ids = players.map((p) => p.id)
    return toWriting({ settings, playerIds: ids, scores: Object.fromEntries(ids.map((id) => [id, 0])) }, now)
  },
  reduce(game, action, fromId, { now, isHost }) {
    switch (action.type) {
      case 'submit': {
        if (game.phase !== 'escrever') throw new Error('Já não dá para mudar.')
        if (!game.playerIds.includes(fromId)) throw new Error('Não estás a jogar.')
        const entries = { ...game.entries, [fromId]: cleanEntry(action.entry) }
        const next = { ...game, entries }
        return game.playerIds.every((id) => entries[id]?.done) ? toGuessing(next, now) : next
      }
      case 'vote': {
        if (game.phase !== 'adivinhar') throw new Error('A votação já acabou.')
        if (!game.playerIds.includes(fromId)) throw new Error('Não estás a jogar.')
        if (fromId === subjectOf(game)) throw new Error('Não podes votar nas tuas frases.')
        if (![0, 1, 2].includes(action.index)) throw new Error('Voto inválido.')
        const votes = { ...game.votes, [fromId]: action.index }
        const next = { ...game, votes }
        const voters = game.playerIds.filter((id) => id !== subjectOf(game))
        return voters.every((id) => votes[id] !== undefined) ? reveal(next, now) : next
      }
      case 'next': {
        if (!isHost) throw new Error('Só o anfitrião pode avançar.')
        return advance(game, now)
      }
      case 'restart': {
        if (!isHost || game.phase !== 'final') return game
        return toWriting({ ...game, scores: Object.fromEntries(game.playerIds.map((id) => [id, 0])) }, now)
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
