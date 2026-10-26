export const COLORS = ['r', 'y', 'g', 'b']
export const COLOR_NAMES = { r: 'vermelho', y: 'amarelo', g: 'verde', b: 'azul' }
export const HAND_SIZE = 7

export function buildDeck() {
  const deck = []
  let n = 0
  for (const color of COLORS) {
    deck.push({ id: n++, color, value: '0' })
    for (const v of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'saltar', 'inverter', '+2']) {
      deck.push({ id: n++, color, value: v })
      deck.push({ id: n++, color, value: v })
    }
  }
  for (let k = 0; k < 4; k++) {
    deck.push({ id: n++, color: null, value: 'cor' })
    deck.push({ id: n++, color: null, value: '+4' })
  }
  return deck // 108 cartas
}

export function shuffle(list, rand = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const isWild = (card) => card.color === null

export function canPlay(card, top, color) {
  if (isWild(card)) return true
  return card.color === color || card.value === top.value
}

const nextIndex = (game, from, steps = 1) => {
  const n = game.order.length
  return (((from + game.direction * steps) % n) + n) % n
}

// Tira `count` cartas do baralho, reciclando a pilha de descarte se preciso.
function draw(game, count) {
  let drawPile = [...game.drawPile]
  let discard = [...game.discard]
  const cards = []
  for (let k = 0; k < count; k++) {
    if (drawPile.length === 0) {
      if (discard.length <= 1) break
      const top = discard[discard.length - 1]
      drawPile = shuffle(discard.slice(0, -1))
      discard = [top]
    }
    cards.push(drawPile.pop())
  }
  return { cards, drawPile, discard }
}

export function startGame(playerIds, rand = Math.random) {
  let drawPile = shuffle(buildDeck(), rand)
  const hands = {}
  for (const id of playerIds) hands[id] = drawPile.splice(-HAND_SIZE)
  // A primeira carta da mesa tem de ser um número.
  let firstIdx = drawPile.findIndex((c) => /^\d$/.test(c.value))
  const first = drawPile.splice(firstIdx, 1)[0]
  return {
    order: [...playerIds],
    hands,
    drawPile,
    discard: [first],
    color: first.color,
    turn: 0,
    direction: 1,
    drawnThisTurn: null, // id da carta comprada nesta vez (só essa pode ser jogada)
    winner: null,
    lastAction: null,
    round: 1,
    score: Object.fromEntries(playerIds.map((id) => [id, 0])),
  }
}

export function currentPlayer(game) {
  return game.order[game.turn]
}

export const isNumber = (card) => /^\d$/.test(card.value)

// Cartas que podem ir juntas com esta (mesmo número, de qualquer cor).
export function sameNumber(hand, card) {
  if (!isNumber(card)) return []
  return hand.filter((c) => c.id !== card.id && c.value === card.value)
}

// extraIds: outras cartas com o mesmo número, jogadas logo a seguir (a última fica em cima e manda na cor).
export function playCard(game, playerId, cardId, chosenColor, extraIds = []) {
  if (game.winner) throw new Error('A partida já acabou.')
  if (currentPlayer(game) !== playerId) throw new Error('Não é a tua vez.')
  const hand = game.hands[playerId]
  const card = hand.find((c) => c.id === cardId)
  if (!card) throw new Error('Não tens essa carta.')
  if (game.drawnThisTurn != null && card.id !== game.drawnThisTurn) throw new Error('Depois de comprar só podes jogar a carta comprada.')
  const top = game.discard[game.discard.length - 1]
  if (!canPlay(card, top, game.color)) throw new Error('Essa carta não serve.')
  if (isWild(card) && !COLORS.includes(chosenColor)) throw new Error('Escolhe uma cor.')
  const extras = []
  for (const id of extraIds || []) {
    const c = hand.find((x) => x.id === id)
    if (!c || id === cardId || extras.includes(c)) throw new Error('Não tens essa carta.')
    if (!isNumber(card) || c.value !== card.value) throw new Error('Só podes juntar cartas com o mesmo número.')
    extras.push(c)
  }
  const played = [card, ...extras]
  const last = played[played.length - 1]
  const ids = new Set(played.map((c) => c.id))

  let next = {
    ...game,
    hands: { ...game.hands, [playerId]: hand.filter((c) => !ids.has(c.id)) },
    discard: [...game.discard, ...played],
    color: isWild(card) ? chosenColor : last.color,
    drawnThisTurn: null,
    lastAction: { by: playerId, type: 'jogou', card: last, count: played.length },
  }
  if (next.hands[playerId].length === 0) {
    return { ...next, winner: playerId, score: { ...game.score, [playerId]: (game.score[playerId] || 0) + 1 } }
  }

  const twoPlayers = game.order.length === 2
  let skip = 0
  if (card.value === 'inverter') {
    if (twoPlayers) skip = 1
    else next.direction = -game.direction
  }
  if (card.value === 'saltar') skip = 1
  if (card.value === '+2' || card.value === '+4') {
    const victimIdx = nextIndex(next, game.turn)
    const victim = next.order[victimIdx]
    const d = draw(next, card.value === '+2' ? 2 : 4)
    next = { ...next, drawPile: d.drawPile, discard: d.discard, hands: { ...next.hands, [victim]: [...next.hands[victim], ...d.cards] } }
    skip = 1
  }
  return { ...next, turn: nextIndex(next, game.turn, 1 + skip) }
}

export function drawCard(game, playerId) {
  if (game.winner) throw new Error('A partida já acabou.')
  if (currentPlayer(game) !== playerId) throw new Error('Não é a tua vez.')
  if (game.drawnThisTurn != null) throw new Error('Já compraste uma carta nesta vez.')
  const d = draw(game, 1)
  if (!d.cards.length) {
    // Sem cartas para comprar: passa a vez.
    return { ...game, turn: nextIndex(game, game.turn), lastAction: { by: playerId, type: 'passou' } }
  }
  const card = d.cards[0]
  const next = {
    ...game,
    drawPile: d.drawPile,
    discard: d.discard,
    hands: { ...game.hands, [playerId]: [...game.hands[playerId], card] },
    lastAction: { by: playerId, type: 'comprou' },
  }
  const top = next.discard[next.discard.length - 1]
  // Se a carta comprada não serve, a vez passa logo.
  if (!canPlay(card, top, next.color)) return { ...next, turn: nextIndex(next, game.turn), drawnThisTurn: null }
  return { ...next, drawnThisTurn: card.id }
}

export function passTurn(game, playerId) {
  if (currentPlayer(game) !== playerId) throw new Error('Não é a tua vez.')
  if (game.drawnThisTurn == null) throw new Error('Primeiro compra uma carta.')
  return { ...game, turn: nextIndex(game, game.turn), drawnThisTurn: null, lastAction: { by: playerId, type: 'passou' } }
}

export function rematch(game) {
  if (!game.winner) return game
  // Quem perdeu a anterior começa (roda a ordem).
  const order = [...game.order.slice(1), game.order[0]]
  return { ...startGame(order), score: game.score, round: game.round + 1 }
}

// ---- Bot: joga a carta "mais útil"; os coringas ficam para o fim.
export function botMove(game, botId) {
  const hand = game.hands[botId]
  const top = game.discard[game.discard.length - 1]
  const playable = hand.filter((c) => canPlay(c, top, game.color) && (game.drawnThisTurn == null || c.id === game.drawnThisTurn))
  const colorCount = Object.fromEntries(COLORS.map((c) => [c, hand.filter((x) => x.color === c).length]))
  const bestColor = COLORS.reduce((a, b) => (colorCount[b] > colorCount[a] ? b : a), COLORS[0])
  if (playable.length) {
    const rank = (c) => (isWild(c) ? 0 : ['+2', 'saltar', 'inverter'].includes(c.value) ? 3 : 2) + (c.color === game.color ? 0.5 : 0)
    const card = [...playable].sort((a, b) => rank(b) - rank(a))[0]
    // Com várias do mesmo número joga-as todas; fica em cima a da cor de que tem mais.
    const same = sameNumber(hand, card)
    if (same.length) {
      const left = hand.filter((c) => c.value !== card.value)
      const count = (col) => left.filter((x) => x.color === col).length
      const all = [card, ...same]
      const topCard = all.reduce((a, b) => (count(b.color) > count(a.color) ? b : a), card)
      // a primeira tem de servir na mesa; a última fica em cima
      const opener = topCard !== card ? card : same.find((c) => canPlay(c, top, game.color)) || card
      const middle = all.filter((c) => c !== opener && c !== topCard)
      const seq = opener === topCard ? [opener, ...middle] : [opener, ...middle, topCard]
      return { type: 'play', cardId: opener.id, extra: seq.slice(1).map((c) => c.id) }
    }
    return { type: 'play', cardId: card.id, color: isWild(card) ? bestColor : undefined }
  }
  return game.drawnThisTurn != null ? { type: 'pass' } : { type: 'draw' }
}

export function applyMove(game, playerId, move) {
  if (move.type === 'play') return playCard(game, playerId, move.cardId, move.color, move.extra)
  if (move.type === 'draw') return drawCard(game, playerId)
  if (move.type === 'pass') return passTurn(game, playerId)
  throw new Error('Ação desconhecida.')
}

// ---- Multiplayer (corre no anfitrião) ----
export const cartasOnline = {
  minPlayers: 2,
  maxPlayers: 8,
  start(players) {
    return startGame(players.map((p) => p.id))
  },
  reduce(game, action, fromId) {
    if (!game.order.includes(fromId)) throw new Error('Não estás a jogar.')
    if (action.type === 'rematch') return rematch(game)
    return applyMove(game, fromId, action)
  },
}
