// Blackjack contra a banca (1 a 5 jogadores na mesma mesa), com fichas a
// fingir. Regras: 6 baralhos, a banca pede até 17 e fica no 17 (mesmo "suave"),
// Blackjack paga 3:2, dobrar com 2 cartas, dividir pares uma vez (ases
// divididos recebem só uma carta cada).
import { buildDeck, shuffle } from '../../lib/cards.js'

export const START_CHIPS = 1000
export const MIN_BET = 10
export const MAX_BET = 500
export const DECKS = 6
const RESHUFFLE_AT = 78 // reembaralha quando restarem menos de 1,5 baralhos
export const TURN_MS = 30000 // online: quem não joga a tempo fica
export const BET_MS = 30000 // online: quem não aposta a tempo fica de fora da mão

export function cardValue(card) {
  if (card.rank === 'A') return 11
  if (['K', 'Q', 'J'].includes(card.rank)) return 10
  return Number(card.rank)
}

// Valor da mão e se é "suave" (um Ás a contar 11).
export function handValue(cards) {
  let total = 0
  let aces = 0
  for (const c of cards) {
    total += cardValue(c)
    if (c.rank === 'A') aces++
  }
  while (total > 21 && aces) {
    total -= 10
    aces--
  }
  return { total, soft: aces > 0 }
}

export const isBlackjack = (hand) => hand.cards.length === 2 && handValue(hand.cards).total === 21 && !hand.split

function newShoe(rand) {
  return shuffle(buildDeck(DECKS), rand)
}

function draw(g, rand) {
  if (!g.shoe.length) g.shoe = newShoe(rand)
  return g.shoe.pop()
}

const clone = (g) => ({
  ...g,
  shoe: g.shoe.slice(),
  chips: { ...g.chips },
  bets: { ...g.bets },
  hands: Object.fromEntries(Object.entries(g.hands).map(([id, hs]) => [id, hs.map((h) => ({ ...h, cards: h.cards.slice() }))])),
  dealer: g.dealer.slice(),
})

export function startGame(ids, now = Date.now(), rand = Math.random) {
  return {
    round: 0,
    order: ids,
    shoe: newShoe(rand),
    chips: Object.fromEntries(ids.map((id) => [id, START_CHIPS])),
    bets: {},
    hands: {},
    dealer: [],
    phase: 'bet',
    turn: null,
    deadline: now + BET_MS,
    results: null,
    lastBet: {},
  }
}

// ---------- Apostas ----------
function placeBet(game, id, amount, now, rand) {
  if (game.phase !== 'bet') throw new Error('Espera pela próxima mão para apostar.')
  const bet = Math.floor(Number(amount))
  if (!(bet >= MIN_BET)) throw new Error(`A aposta mínima é ${MIN_BET}.`)
  if (bet > MAX_BET) throw new Error(`A aposta máxima é ${MAX_BET}.`)
  if (bet > game.chips[id]) throw new Error('Não tens fichas suficientes.')
  const g = clone(game)
  g.bets[id] = bet
  return maybeDeal(g, now, rand)
}

// Começa a mão quando todos apostaram (ou o tempo das apostas acabou).
function maybeDeal(g, now, rand, force = false) {
  const waiting = g.order.filter((id) => g.bets[id] == null && g.chips[id] >= MIN_BET)
  const playing = g.order.filter((id) => g.bets[id] > 0)
  if (!playing.length || (waiting.length && !force)) return g
  return deal(g, playing, now, rand)
}

function deal(g, playing, now, rand) {
  if (g.shoe.length < RESHUFFLE_AT) {
    g.shoe = newShoe(rand)
    g.reshuffled = true
  } else g.reshuffled = false
  g.round += 1
  g.results = null
  g.hands = {}
  for (const id of playing) {
    g.chips[id] -= g.bets[id]
    g.lastBet[id] = g.bets[id]
    g.hands[id] = [{ cards: [], bet: g.bets[id], done: false, doubled: false, split: false }]
  }
  g.dealer = []
  for (let k = 0; k < 2; k++) {
    for (const id of playing) g.hands[id][0].cards.push(draw(g, rand))
    g.dealer.push(draw(g, rand))
  }
  g.phase = 'play'
  // A banca espreita: com Blackjack acaba logo.
  if (handValue(g.dealer).total === 21) return finish(g, now, rand, true)
  for (const id of playing) if (handValue(g.hands[id][0].cards).total === 21) g.hands[id][0].done = true
  g.turn = null
  return nextTurn(g, now, rand)
}

// ---------- Jogadas ----------
function nextTurn(g, now, rand) {
  for (const id of g.order) {
    const hs = g.hands[id]
    if (!hs) continue
    const h = hs.findIndex((x) => !x.done)
    if (h >= 0) {
      g.turn = { id, h }
      g.deadline = now + TURN_MS
      return g
    }
  }
  g.turn = null
  return finish(g, now, rand)
}

function current(g, id) {
  if (g.phase !== 'play' || !g.turn) throw new Error('Agora não é altura de jogar.')
  if (g.turn.id !== id) throw new Error('Não é a tua vez.')
  return g.hands[id][g.turn.h]
}

function act(game, id, type, now, rand) {
  const g = clone(game)
  const hand = current(g, id)
  if (type === 'hit') {
    hand.cards.push(draw(g, rand))
    const v = handValue(hand.cards).total
    if (v >= 21) hand.done = true
  } else if (type === 'stand') {
    hand.done = true
  } else if (type === 'double') {
    if (hand.cards.length !== 2) throw new Error('Só podes dobrar com 2 cartas.')
    if (g.chips[id] < hand.bet) throw new Error('Não tens fichas para dobrar.')
    g.chips[id] -= hand.bet
    hand.bet *= 2
    hand.doubled = true
    hand.cards.push(draw(g, rand))
    hand.done = true
  } else if (type === 'split') {
    const hs = g.hands[id]
    if (hs.length > 1 || hand.cards.length !== 2 || cardValue(hand.cards[0]) !== cardValue(hand.cards[1])) {
      throw new Error('Só podes dividir um par, uma vez.')
    }
    if (g.chips[id] < hand.bet) throw new Error('Não tens fichas para dividir.')
    g.chips[id] -= hand.bet
    const aces = hand.cards[0].rank === 'A'
    const second = { cards: [hand.cards[1], draw(g, rand)], bet: hand.bet, done: aces, doubled: false, split: true }
    hand.cards = [hand.cards[0], draw(g, rand)]
    hand.split = true
    hand.done = aces // ases divididos: uma carta cada e acabou
    if (!aces && handValue(hand.cards).total === 21) hand.done = true
    if (!aces && handValue(second.cards).total === 21) second.done = true
    hs.push(second)
  } else {
    throw new Error('Jogada desconhecida.')
  }
  return hand.done ? nextTurn(g, now, rand) : { ...g, deadline: now + TURN_MS }
}

// ---------- Banca e pagamentos ----------
function finish(g, now, rand, dealerBlackjack = false) {
  const live = Object.values(g.hands).some((hs) => hs.some((h) => handValue(h.cards).total <= 21 && !isBlackjack(h)))
  if (!dealerBlackjack && live) {
    while (handValue(g.dealer).total < 17) g.dealer.push(draw(g, rand))
  }
  const dealer = handValue(g.dealer).total
  const dealerBJ = g.dealer.length === 2 && dealer === 21
  const results = {}
  for (const [id, hs] of Object.entries(g.hands)) {
    let paid = 0
    let staked = 0
    const outcomes = hs.map((h) => {
      const v = handValue(h.cards).total
      staked += h.bet
      let outcome
      let pay = 0
      if (v > 21) outcome = 'rebentou'
      else if (isBlackjack(h) && !dealerBJ) {
        outcome = 'blackjack'
        pay = h.bet * 2.5
      } else if (dealerBJ) outcome = isBlackjack(h) ? 'empate' : 'perdeu'
      else if (dealer > 21 || v > dealer) {
        outcome = 'ganhou'
        pay = h.bet * 2
      } else if (v === dealer) {
        outcome = 'empate'
        pay = h.bet
      } else outcome = 'perdeu'
      if (outcome === 'empate' && dealerBJ) pay = h.bet
      paid += pay
      return { outcome, pay }
    })
    g.chips[id] += Math.floor(paid)
    results[id] = { outcomes, net: Math.floor(paid) - staked }
  }
  g.results = results
  g.phase = 'done'
  g.turn = null
  g.deadline = null
  return g
}

export function nextHand(game, now = Date.now()) {
  if (game.phase !== 'done') return game
  const g = clone(game)
  g.phase = 'bet'
  g.bets = {}
  g.deadline = now + BET_MS
  return g
}

// Fichas a fingir: quem fica sem fichas pode recomeçar com 1000.
function rebuy(game, id) {
  if (game.chips[id] >= MIN_BET) throw new Error('Ainda tens fichas.')
  return { ...game, chips: { ...game.chips, [id]: START_CHIPS } }
}

export function applyAction(game, id, action, now = Date.now(), rand = Math.random) {
  if (!game.order.includes(id)) throw new Error('Não estás nesta mesa.')
  switch (action.type) {
    case 'bet':
      return placeBet(game, id, action.amount, now, rand)
    case 'hit':
    case 'stand':
    case 'double':
    case 'split':
      return act(game, id, action.type, now, rand)
    case 'next':
      return nextHand(game, now)
    case 'rebuy':
      return rebuy(game, id)
    default:
      throw new Error('Ação desconhecida.')
  }
}

// Online: o tempo acabou (apostas ou vez de alguém).
export function tick(game, now, rand = Math.random) {
  if (!game.deadline || now < game.deadline) return game
  if (game.phase === 'bet') {
    const g = clone(game)
    for (const id of g.order) if (g.bets[id] == null) g.bets[id] = 0
    const dealt = maybeDeal(g, now, rand, true)
    if (dealt.phase === 'bet') return { ...dealt, bets: {}, deadline: now + BET_MS } // ninguém apostou
    return dealt
  }
  if (game.phase === 'play' && game.turn) return act(game, game.turn.id, 'stand', now, rand)
  return game
}

export const canDouble = (game, id) => {
  const h = game.turn?.id === id ? game.hands[id][game.turn.h] : null
  return !!h && h.cards.length === 2 && game.chips[id] >= h.bet
}
export const canSplit = (game, id) => {
  const h = game.turn?.id === id ? game.hands[id][game.turn.h] : null
  return !!h && game.hands[id].length === 1 && h.cards.length === 2 && cardValue(h.cards[0]) === cardValue(h.cards[1]) && game.chips[id] >= h.bet
}

export const blackjackOnline = {
  minPlayers: 1,
  maxPlayers: 5,
  tick: true,
  start(players, action, now) {
    return startGame(players.map((p) => p.id), now)
  },
  reduce(game, action, fromId, { now }) {
    if (action.type === 'tick') return tick(game, now)
    return applyAction(game, fromId, action, now)
  },
}
