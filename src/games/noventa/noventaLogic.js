// 99: cada carta jogada soma ao total da mesa. Quem não conseguir jogar
// sem passar dos 99 perde uma vida. Ganha o último com vidas.
export const SUITS = ['s', 'h', 'd', 'c']
export const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' }
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const HAND_SIZE = 3
export const LIVES = 3
export const LIMIT = 99

export function buildDeck() {
  const deck = []
  let n = 0
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ id: n++, suit, rank })
  return deck
}

export function shuffle(list, rand = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const isSpecial = (card) => ['4', '9', '10', 'K'].includes(card.rank)

// Formas possíveis de jogar a carta com o total atual (só as que não passam dos 99).
export function cardOptions(card, total) {
  const opts = []
  const add = (mode, value, label) => {
    const t = Math.max(0, value)
    if (t <= LIMIT) opts.push({ mode, total: t, label })
  }
  switch (card.rank) {
    case 'A':
      add('one', total + 1, '+1')
      add('eleven', total + 11, '+11')
      break
    case '4':
      add('reverse', total, 'Inverte')
      break
    case '9':
      add('hold', total, '+0')
      break
    case '10':
      add('minus', total - 10, '−10')
      add('plus', total + 10, '+10')
      break
    case 'J':
    case 'Q':
      add('plus', total + 10, '+10')
      break
    case 'K':
      add('ninetynine', LIMIT, '= 99')
      break
    default:
      add('plus', total + Number(card.rank), `+${card.rank}`)
  }
  return opts
}

export const canPlayAny = (hand, total) => hand.some((c) => cardOptions(c, total).length > 0)

export const alive = (game, id) => (game.lives[id] || 0) > 0
export const currentPlayer = (game) => game.order[game.turn]

function nextAlive(game, from, direction = game.direction) {
  const n = game.order.length
  for (let k = 1; k <= n; k++) {
    const i = (((from + direction * k) % n) + n) % n
    if (alive(game, game.order[i])) return i
  }
  return from
}

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

// Nova mão: baralha tudo, dá 3 cartas a quem ainda está vivo e o total volta a 0.
function deal(game, starter, rand = Math.random) {
  let drawPile = shuffle(buildDeck(), rand)
  const hands = {}
  for (const id of game.order) hands[id] = alive(game, id) ? drawPile.splice(-HAND_SIZE) : []
  return { ...game, hands, drawPile, discard: [], total: 0, direction: 1, turn: starter, hand: (game.hand || 0) + 1 }
}

export function startGame(playerIds, rand = Math.random) {
  const base = {
    order: [...playerIds],
    lives: Object.fromEntries(playerIds.map((id) => [id, LIVES])),
    winner: null,
    lastAction: null,
    lostLife: null,
    round: 1,
    score: Object.fromEntries(playerIds.map((id) => [id, 0])),
  }
  return deal(base, 0, rand)
}

// Se quem tem a vez não consegue jogar, perde uma vida e começa outra mão.
function checkStuck(game) {
  const id = currentPlayer(game)
  if (canPlayAny(game.hands[id] || [], game.total)) return game
  const lives = { ...game.lives, [id]: game.lives[id] - 1 }
  const next = { ...game, lives, lostLife: { id, total: game.total, hand: game.hand } }
  const living = next.order.filter((p) => alive(next, p))
  if (living.length <= 1) {
    const winner = living[0] || id
    return { ...next, winner, score: { ...game.score, [winner]: (game.score[winner] || 0) + 1 } }
  }
  // Começa a próxima mão quem perdeu a vida (ou o seguinte, se ficou de fora).
  const starter = alive(next, id) ? game.turn : nextAlive(next, game.turn, 1)
  return deal(next, starter)
}

export function playCard(game, playerId, cardId, mode) {
  if (game.winner) throw new Error('A partida já acabou.')
  if (currentPlayer(game) !== playerId) throw new Error('Não é a tua vez.')
  const hand = game.hands[playerId]
  const card = hand.find((c) => c.id === cardId)
  if (!card) throw new Error('Não tens essa carta.')
  const opts = cardOptions(card, game.total)
  if (!opts.length) throw new Error(`Essa carta passa dos ${LIMIT}.`)
  const opt = opts.find((o) => o.mode === mode) || (opts.length === 1 || !mode ? opts[0] : null)
  if (!opt) throw new Error('Jogada inválida.')

  const direction = card.rank === '4' && game.order.filter((p) => alive(game, p)).length > 2 ? -game.direction : game.direction
  let next = {
    ...game,
    total: opt.total,
    direction,
    discard: [...game.discard, card],
    hands: { ...game.hands, [playerId]: hand.filter((c) => c.id !== cardId) },
    lastAction: { by: playerId, card, label: opt.label, total: opt.total },
  }
  const d = draw(next, 1)
  next = { ...next, drawPile: d.drawPile, discard: d.discard, hands: { ...next.hands, [playerId]: [...next.hands[playerId], ...d.cards] } }
  next = { ...next, turn: nextAlive(next, game.turn) }
  return checkStuck(next)
}

export function rematch(game) {
  if (!game.winner) return game
  const order = [...game.order.slice(1), game.order[0]]
  return { ...startGame(order), score: game.score, round: game.round + 1 }
}

// ---- Bot: guarda as cartas especiais e tenta deixar o total alto para os outros.
export function botMove(game, botId) {
  const hand = game.hands[botId]
  const plays = []
  for (const card of hand) {
    for (const opt of cardOptions(card, game.total)) {
      let score
      if (!isSpecial(card) && card.rank !== 'A') score = 100 + opt.total
      else if (card.rank === 'A') score = opt.mode === 'one' ? 60 : 100 + opt.total - 5
      else if (card.rank === '10') score = opt.mode === 'plus' ? 100 + opt.total - 15 : 40
      else score = { '9': 30, '4': 25, K: 10 }[card.rank]
      plays.push({ card, opt, score })
    }
  }
  plays.sort((a, b) => b.score - a.score)
  const best = plays[0]
  return { type: 'play', cardId: best.card.id, mode: best.opt.mode }
}

export function applyMove(game, playerId, move) {
  if (move.type === 'play') return playCard(game, playerId, move.cardId, move.mode)
  throw new Error('Ação desconhecida.')
}

export const noventaOnline = {
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
