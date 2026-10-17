export const FACES = ['🍕', '🚀', '🐙', '🎸', '⚽', '🦊', '🌵', '🍩', '🎲', '🐢', '🌈', '🍉', '🦄', '🎧', '🧩', '🐝', '🍒', '🛸', '🐧', '🔥']
export const SIZES = {
  facil: { label: 'Fácil', pairs: 6, cols: 4 },
  normal: { label: 'Normal', pairs: 8, cols: 4 },
  dificil: { label: 'Difícil', pairs: 12, cols: 6 },
  enorme: { label: 'Enorme', pairs: 18, cols: 6 },
}
export const HIDE_MS = 1100

export function shuffle(list, rand = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function makeCards(pairs, rand = Math.random) {
  const faces = shuffle(FACES, rand).slice(0, pairs)
  return shuffle([...faces, ...faces], rand).map((face, i) => ({ id: i, face, matched: null }))
}

// Vira uma carta. Devolve o novo estado; com duas abertas diferentes,
// ficam visíveis até `hideAt` e depois `settle` esconde-as.
export function flip(state, index, by, now = Date.now()) {
  const card = state.cards[index]
  if (!card) throw new Error('Carta inválida.')
  if (state.hideAt) throw new Error('Espera um bocadinho.')
  if (card.matched || state.open.includes(index)) return state
  const open = [...state.open, index]
  if (open.length < 2) return { ...state, open }
  const [a, b] = open
  const moves = (state.moves || 0) + 1
  if (state.cards[a].face === state.cards[b].face) {
    const cards = state.cards.map((c, i) => (i === a || i === b ? { ...c, matched: by } : c))
    return { ...state, cards, open: [], moves, lastMatch: by, done: cards.every((c) => c.matched) }
  }
  return { ...state, open, moves, hideAt: now + HIDE_MS, lastMatch: null }
}

export function settle(state) {
  if (!state.hideAt) return state
  return { ...state, open: [], hideAt: null }
}

// ---- Multiplayer: à vez; quem acerta um par joga outra vez.
function newRound(order, size, round, scores) {
  const conf = SIZES[size] || SIZES.normal
  return {
    order,
    size,
    cols: conf.cols,
    cards: makeCards(conf.pairs),
    open: [],
    hideAt: null,
    turn: 0,
    pairs: Object.fromEntries(order.map((id) => [id, 0])),
    scores,
    round,
    done: false,
    winners: null,
  }
}

export const memoriaOnline = {
  minPlayers: 2,
  maxPlayers: 6,
  tick: true,
  start(players, action) {
    const order = players.map((p) => p.id)
    return newRound(order, action.size || 'normal', 1, Object.fromEntries(order.map((id) => [id, 0])))
  },
  reduce(game, action, fromId, { now, isHost }) {
    if (action.type === 'tick') {
      if (!game.hideAt || now < game.hideAt) return game
      return { ...settle(game), turn: (game.turn + 1) % game.order.length }
    }
    if (!game.order.includes(fromId)) throw new Error('Não estás a jogar.')
    if (action.type === 'rematch') {
      if (!game.done) return game
      if (!isHost) throw new Error('Só o anfitrião pode recomeçar.')
      return newRound([...game.order.slice(1), game.order[0]], game.size, game.round + 1, game.scores)
    }
    if (action.type !== 'flip') throw new Error('Ação desconhecida.')
    if (game.done) return game
    if (game.order[game.turn] !== fromId) throw new Error('Não é a tua vez.')
    const next = flip(game, action.index, fromId, now)
    if (next === game) return game
    const matchedNow = next.cards.filter((c) => c.matched === fromId).length / 2
    const pairs = { ...game.pairs, [fromId]: matchedNow }
    if (!next.done) return { ...next, pairs }
    const top = Math.max(...Object.values(pairs))
    const winners = game.order.filter((id) => pairs[id] === top)
    const scores = { ...game.scores }
    winners.forEach((id) => (scores[id] = (scores[id] || 0) + 1))
    return { ...next, pairs, winners, scores }
  },
}
