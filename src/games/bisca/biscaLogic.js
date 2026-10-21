// Bisca (de 3): 2 jogadores, ou 4 em equipas (lugares 0+2 contra 1+3), com o
// baralho de 40 cartas da Sueca. Cada um tem sempre 3 cartas: depois de cada
// vaza, quem a ganhou compra primeiro e os outros a seguir. A carta virada por
// baixo do monte é o trunfo (e é a última a ser comprada). Enquanto houver
// monte pode-se jogar qualquer carta; quando o monte acaba é obrigatório
// assistir. Quem tem o 2 de trunfo pode trocá-lo pela carta de trunfo virada.
// Pontos como na Sueca (120 por mão): mais de 60 vale 1 jogo, 91 ou mais 2
// (capote), as 120 valem 4 (bandeira). Ganha quem chegar primeiro a 4 jogos.
import { shuffle } from '../../lib/cards.js'
import { buildSuecaDeck, STRENGTH, cardValue, trickWinner } from '../sueca/suecaLogic.js'

export { cardValue, trickWinner }
export const HAND_SIZE = 3
export const TARGET = 4
export const BOT_DELAY_MS = 750
export const TURN_MS = 30000
export const TRICK_MS = 1300
export const END_MS = 9000
export const BOT_NAMES = ['Bot Rita', 'Bot Zé', 'Bot Inês']

export const teamOf = (g, id) => g.order.indexOf(id) % 2
export const isBot = (g, id) => g.bots.includes(id)
const nextOf = (g, id) => g.order[(g.order.indexOf(id) + 1) % g.order.length]
const SUIT_SYM = { s: '♠', h: '♥', d: '♦', c: '♣' }
const label = (c) => `${c.rank}${SUIT_SYM[c.suit]}`

function addLog(g, msg) {
  g.log = [msg, ...g.log].slice(0, 40)
}

export function startGame(ids, bots = [], now = Date.now(), rand = Math.random, opts = {}) {
  if (ids.length !== 2 && ids.length !== 4) throw new Error('A Bisca joga-se a 2 ou a 4.')
  const g = {
    order: ids,
    bots,
    timed: opts.timed !== false,
    dealer: ids[Math.floor(rand() * ids.length)],
    handNo: 0,
    games: [0, 0],
    phase: 'play',
    hands: {},
    stock: [],
    trump: null,
    trick: [],
    lastTrick: null,
    piles: [[], []],
    turn: null,
    result: null,
    winner: null,
    deadline: null,
    log: [],
    wins: opts.wins || [0, 0],
  }
  return deal(g, now, rand)
}

function deal(g, now, rand) {
  g.handNo += 1
  if (g.handNo > 1) g.dealer = nextOf(g, g.dealer)
  // O monte tira-se do fim; a carta 0 é o trunfo virado (a última a sair).
  const deck = shuffle(buildSuecaDeck(), rand)
  g.hands = {}
  let id = nextOf(g, g.dealer)
  for (let k = 0; k < g.order.length; k++) {
    g.hands[id] = deck.splice(deck.length - HAND_SIZE, HAND_SIZE)
    id = nextOf(g, id)
  }
  g.stock = deck
  g.trump = { suit: deck[0].suit, card: deck[0] }
  g.trick = []
  g.lastTrick = null
  g.piles = [[], []]
  g.result = null
  g.phase = 'play'
  addLog(g, `Mão ${g.handNo}: o trunfo é ${label(deck[0])}.`)
  return setTurn(g, nextOf(g, g.dealer), now)
}

function setTurn(g, id, now) {
  g.turn = id
  g.deadline = isBot(g, id) ? now + BOT_DELAY_MS : g.timed ? now + TURN_MS : null
  return g
}

const clone = (g) => ({
  ...g,
  hands: Object.fromEntries(Object.entries(g.hands).map(([k, v]) => [k, v.slice()])),
  stock: g.stock.slice(),
  trick: g.trick.slice(),
  piles: [g.piles[0].slice(), g.piles[1].slice()],
  games: g.games.slice(),
  log: g.log.slice(),
})

// Com monte, qualquer carta; sem monte, é obrigatório assistir.
export function legalCards(g, id) {
  const hand = g.hands[id] || []
  if (g.stock.length || !g.trick.length) return hand
  const follow = hand.filter((c) => c.suit === g.trick[0].card.suit)
  return follow.length ? follow : hand
}

// Pode trocar o 2 de trunfo pela carta virada (enquanto o monte tiver pelo menos 2 cartas).
export function canSwap(g, id) {
  if (g.phase !== 'play' || g.turn !== id || g.stock.length < 2) return false
  if (g.trump.card.rank === '2') return false
  return (g.hands[id] || []).some((c) => c.suit === g.trump.suit && c.rank === '2')
}

function swap(game, id, now) {
  if (!canSwap(game, id)) throw new Error('Agora não podes trocar o 2.')
  const g = clone(game)
  const two = g.hands[id].find((c) => c.suit === g.trump.suit && c.rank === '2')
  g.hands[id] = [...g.hands[id].filter((c) => c.id !== two.id), g.trump.card]
  g.stock[0] = two
  addLog(g, `@${id} trocou o 2 pelo trunfo virado (${label(g.trump.card)}).`)
  g.trump = { suit: g.trump.suit, card: two }
  return setTurn(g, id, now)
}

function playCard(game, id, cardId, now) {
  if (game.phase !== 'play') throw new Error('Agora não se pode jogar.')
  if (game.turn !== id) throw new Error('Não é a tua vez.')
  const card = game.hands[id].find((c) => c.id === cardId)
  if (!card) throw new Error('Essa carta não é tua.')
  if (!legalCards(game, id).some((c) => c.id === cardId)) throw new Error('O monte acabou: tens de assistir ao naipe que saiu.')
  const g = clone(game)
  g.hands[id] = g.hands[id].filter((c) => c.id !== cardId)
  g.trick.push({ id, card })
  if (g.trick.length < g.order.length) return setTurn(g, nextOf(g, id), now)
  g.phase = 'trick'
  g.turn = null
  g.deadline = now + TRICK_MS
  return g
}

function collectTrick(game, now) {
  const g = clone(game)
  const winner = g.trick[trickWinner(g.trick, g.trump.suit)].id
  const pts = g.trick.reduce((s, t) => s + cardValue(t.card), 0)
  g.piles[teamOf(g, winner)].push(...g.trick.map((t) => t.card))
  g.lastTrick = { cards: g.trick, winner, points: pts }
  if (pts > 0) addLog(g, `@${winner} ganhou a vaza (${pts} ${pts === 1 ? 'ponto' : 'pontos'}).`)
  g.trick = []
  // Compra: primeiro quem ganhou, depois os outros pela ordem da mesa.
  if (g.stock.length) {
    let id = winner
    for (let k = 0; k < g.order.length && g.stock.length; k++) {
      g.hands[id].push(g.stock.pop())
      id = nextOf(g, id)
    }
    if (!g.stock.length) addLog(g, 'Acabou o monte: agora é obrigatório assistir.')
  }
  if (g.order.every((p) => g.hands[p].length === 0)) return endHand(g, now)
  g.phase = 'play'
  return setTurn(g, winner, now)
}

export const pilePoints = (pile) => pile.reduce((s, c) => s + cardValue(c), 0)
export const handPoints = (g) => [pilePoints(g.piles[0]), pilePoints(g.piles[1])]

function endHand(g, now) {
  const pts = handPoints(g)
  const win = pts[0] > 60 ? 0 : pts[1] > 60 ? 1 : null
  let gamesWon = 0
  if (win != null) {
    const p = pts[win]
    gamesWon = p === 120 ? 4 : p >= 91 ? 2 : 1
    g.games[win] += gamesWon
  }
  const kind = win == null ? 'empate' : gamesWon === 4 ? 'bandeira' : gamesWon === 2 ? 'capote' : 'jogo'
  g.result = { points: pts, team: win, gamesWon, kind }
  addLog(g, win == null ? 'Empate a 60: ninguém ganha jogos.' : `@${g.order[win]} fez ${pts[win]} pontos: ${gamesWon} ${gamesWon === 1 ? 'jogo' : 'jogos'}.`)
  g.turn = null
  if (g.games[0] >= TARGET || g.games[1] >= TARGET) {
    g.phase = 'over'
    g.winner = g.games[0] >= TARGET ? 0 : 1
    g.deadline = null
    return g
  }
  g.phase = 'end'
  g.deadline = now + END_MS
  return g
}

export function applyAction(game, id, action, now = Date.now(), rand = Math.random) {
  if (!game.order.includes(id)) throw new Error('Não estás nesta mesa.')
  switch (action.type) {
    case 'play':
      return playCard(game, id, action.card, now)
    case 'swap':
      return swap(game, id, now)
    case 'next':
      return game.phase === 'end' ? deal(clone(game), now, rand) : game
    case 'rematch': {
      if (game.phase !== 'over') return game
      const wins = game.wins.slice()
      wins[game.winner] += 1
      return startGame(game.order, game.bots, now, rand, { timed: game.timed, wins })
    }
    default:
      throw new Error('Jogada desconhecida.')
  }
}

export function tick(game, now, rand = Math.random) {
  if (!game.deadline || now < game.deadline) return game
  if (game.phase === 'trick') return collectTrick(game, now)
  if (game.phase === 'end') return deal(clone(game), now, rand)
  if (game.phase === 'play' && game.turn) {
    const id = game.turn
    if (isBot(game, id) && canSwap(game, id)) return swap(game, id, now)
    return playCard(game, id, botCard(game, id).id, now)
  }
  return game
}

// ---------- Bots ----------
const byWeakness = (a, b) => cardValue(a) - cardValue(b) || STRENGTH[a.rank] - STRENGTH[b.rank]

function beats(card, trick, trumpSuit) {
  const best = trick[trickWinner(trick, trumpSuit)].card
  if (card.suit === best.suit) return STRENGTH[card.rank] > STRENGTH[best.rank]
  return card.suit === trumpSuit
}

export function botCard(g, id) {
  const legal = legalCards(g, id)
  const trump = g.trump.suit
  const nonTrump = legal.filter((c) => c.suit !== trump)
  const lowest = (list) => [...list].sort(byWeakness)[0]
  if (!g.trick.length) {
    // A abrir: a carta mais fraca, de preferência sem pontos e sem ser trunfo.
    return lowest(nonTrump.length ? nonTrump : legal)
  }
  const wIdx = trickWinner(g.trick, trump)
  const pts = g.trick.reduce((s, t) => s + cardValue(t.card), 0)
  const last = g.trick.length === g.order.length - 1
  if (g.order.length === 4 && teamOf(g, g.trick[wIdx].id) === teamOf(g, id)) {
    // O parceiro está a ganhar: se é seguro, dá-lhe pontos.
    const wc = g.trick[wIdx].card
    const safe = last || wc.suit === trump || STRENGTH[wc.rank] >= STRENGTH['7']
    if (safe) {
      const pool = nonTrump.length ? nonTrump : legal
      return [...pool].sort((a, b) => cardValue(b) - cardValue(a) || STRENGTH[a.rank] - STRENGTH[b.rank])[0]
    }
    return lowest(legal)
  }
  const winners = legal
    .filter((c) => beats(c, g.trick, trump))
    .sort((a, b) => (a.suit === trump) - (b.suit === trump) || STRENGTH[a.rank] - STRENGTH[b.rank])
  if (winners.length) {
    const cheapest = winners[0]
    // Ganha com carta do mesmo naipe sempre; corta com trunfo só se a vaza vale a pena.
    if (cheapest.suit !== trump || pts >= 10 || (pts >= 4 && cardValue(cheapest) === 0) || (!g.stock.length && pts > 0)) return cheapest
  }
  return lowest(legal)
}

export const biscaOnline = {
  minPlayers: 1,
  maxPlayers: 4,
  tick: true,
  tickMs: 250,
  start(players, action, now) {
    const humans = players.map((p) => p.id)
    // 2 = um contra um; 4 = equipas. Com 3 pessoas joga-se a 4 (com 1 bot).
    const seats = humans.length > 2 ? 4 : Number(action.seats) === 4 ? 4 : 2
    const bots = Array.from({ length: seats - humans.length }, (_, i) => `bot${i}`)
    let order = [...humans, ...bots]
    if (seats === 4 && humans.length === 2) order = action.together === false ? [humans[0], humans[1], bots[0], bots[1]] : [humans[0], bots[0], humans[1], bots[1]]
    return startGame(order, bots, now)
  },
  reduce(game, action, fromId, { now }) {
    if (action.type === 'tick') return tick(game, now)
    return applyAction(game, fromId, action, now)
  },
}
