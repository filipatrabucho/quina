// Sueca: 4 jogadores em 2 equipas (lugares 0+2 contra 1+3), baralho de 40
// cartas (sem 8, 9 e 10). O trunfo é a última carta dada a quem baralha.
// Tem de se assistir ao naipe jogado; quem não tem pode cortar com trunfo ou
// largar outra carta. A vaza é do trunfo mais alto ou, sem trunfos, da carta
// mais alta do naipe que saiu. Contam os pontos: Ás 11, Sete 10, Rei 4,
// Valete 3, Dama 2 (120 no total). Mais de 60 ganha 1 jogo, 91 ou mais 2 jogos
// (capote) e as 120 todas 4 jogos (bandeira). Ganha a partida quem chegar a 4.
// Corre no anfitrião da sala (ou no browser, contra bots).
import { SUITS, shuffle } from '../../lib/cards.js'

export const SUECA_RANKS = ['2', '3', '4', '5', '6', 'Q', 'J', 'K', '7', 'A'] // do mais fraco ao mais forte
export const STRENGTH = Object.fromEntries(SUECA_RANKS.map((r, i) => [r, i]))
export const VALUE = { A: 11, 7: 10, K: 4, J: 3, Q: 2 }
export const cardValue = (c) => VALUE[c.rank] || 0
export const TARGET = 4
export const BOT_DELAY_MS = 750
export const TURN_MS = 30000
export const TRICK_MS = 1300
export const END_MS = 9000
export const BOT_NAMES = ['Bot Rita', 'Bot Zé', 'Bot Inês']

export const teamOf = (g, id) => g.order.indexOf(id) % 2
export const isBot = (g, id) => g.bots.includes(id)
export const partnerOf = (g, id) => g.order[(g.order.indexOf(id) + 2) % 4]
const nextOf = (g, id) => g.order[(g.order.indexOf(id) + 1) % 4]

export function buildSuecaDeck() {
  const deck = []
  let n = 0
  for (const suit of SUITS) for (const rank of SUECA_RANKS) deck.push({ id: n++, suit, rank })
  return deck
}

function addLog(g, msg) {
  g.log = [msg, ...g.log].slice(0, 40)
}

// opts.timed: false = sem tempo para as pessoas (contra bots).
export function startGame(ids, bots = [], now = Date.now(), rand = Math.random, opts = {}) {
  if (ids.length !== 4) throw new Error('A Sueca joga-se a 4.')
  const g = {
    order: ids,
    bots,
    timed: opts.timed !== false,
    dealer: ids[Math.floor(rand() * 4)],
    handNo: 0,
    games: [0, 0],
    phase: 'play',
    hands: {},
    trump: null,
    trick: [],
    lastTrick: null,
    piles: [[], []],
    turn: null,
    result: null,
    winner: null,
    deadline: null,
    log: [],
    seq: 0,
    wins: opts.wins || [0, 0],
  }
  return deal(g, now, rand)
}

function deal(g, now, rand) {
  g.handNo += 1
  if (g.handNo > 1) g.dealer = nextOf(g, g.dealer)
  const deck = shuffle(buildSuecaDeck(), rand)
  // Dá 10 a cada um, a começar a seguir a quem baralha; a última carta (a de
  // quem baralha) é o trunfo.
  g.hands = {}
  const start = g.order.indexOf(g.dealer) + 1
  for (let k = 0; k < 4; k++) g.hands[g.order[(start + k) % 4]] = deck.slice(k * 10, k * 10 + 10)
  const trumpCard = g.hands[g.dealer][9]
  g.trump = { suit: trumpCard.suit, card: trumpCard }
  g.trick = []
  g.lastTrick = null
  g.piles = [[], []]
  g.result = null
  g.phase = 'play'
  g.leader = nextOf(g, g.dealer)
  addLog(g, `Mão ${g.handNo}: @${g.dealer} baralhou. Trunfo: ${trumpCard.rank}${'♠♥♦♣'[SUITS.indexOf(trumpCard.suit)]}.`)
  return setTurn(g, g.leader, now)
}

function setTurn(g, id, now) {
  g.turn = id
  g.deadline = isBot(g, id) ? now + BOT_DELAY_MS : g.timed ? now + TURN_MS : null
  return g
}

const clone = (g) => ({
  ...g,
  hands: Object.fromEntries(Object.entries(g.hands).map(([k, v]) => [k, v.slice()])),
  trick: g.trick.slice(),
  piles: [g.piles[0].slice(), g.piles[1].slice()],
  games: g.games.slice(),
  log: g.log.slice(),
})

export function legalCards(g, id) {
  const hand = g.hands[id] || []
  if (!g.trick.length) return hand
  const lead = g.trick[0].card.suit
  const follow = hand.filter((c) => c.suit === lead)
  return follow.length ? follow : hand
}

// Quem está a ganhar a vaza (índice em trick).
export function trickWinner(trick, trumpSuit) {
  let best = 0
  for (let i = 1; i < trick.length; i++) {
    const a = trick[best].card
    const b = trick[i].card
    if (b.suit === a.suit) {
      if (STRENGTH[b.rank] > STRENGTH[a.rank]) best = i
    } else if (b.suit === trumpSuit) best = i
  }
  return best
}

export const pilePoints = (pile) => pile.reduce((s, c) => s + cardValue(c), 0)
export const handPoints = (g) => [pilePoints(g.piles[0]), pilePoints(g.piles[1])]

function playCard(game, id, cardId, now) {
  if (game.phase !== 'play') throw new Error('Agora não se pode jogar.')
  if (game.turn !== id) throw new Error('Não é a tua vez.')
  const card = game.hands[id].find((c) => c.id === cardId)
  if (!card) throw new Error('Essa carta não é tua.')
  if (!legalCards(game, id).some((c) => c.id === cardId)) throw new Error('Tens de assistir: joga uma carta do naipe que saiu.')
  const g = clone(game)
  g.hands[id] = g.hands[id].filter((c) => c.id !== cardId)
  g.trick.push({ id, card })
  if (g.trick.length < 4) return setTurn(g, nextOf(g, id), now)
  // Vaza completa: fica à vista um bocadinho antes de ser recolhida.
  g.phase = 'trick'
  g.turn = null
  g.deadline = now + TRICK_MS
  return g
}

function collectTrick(game, now) {
  const g = clone(game)
  const w = trickWinner(g.trick, g.trump.suit)
  const winner = g.trick[w].id
  const pts = g.trick.reduce((s, t) => s + cardValue(t.card), 0)
  g.piles[teamOf(g, winner)].push(...g.trick.map((t) => t.card))
  g.lastTrick = { cards: g.trick, winner, points: pts }
  if (pts > 0) addLog(g, `@${winner} ganhou a vaza (${pts} ${pts === 1 ? 'ponto' : 'pontos'}).`)
  g.trick = []
  g.seq += 1
  if (g.hands[g.order[0]].length === 0) return endHand(g, now)
  g.phase = 'play'
  return setTurn(g, winner, now)
}

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
  addLog(g, win == null ? 'Empate a 60: ninguém ganha jogos.' : `@${g.order[win]} e @${g.order[win + 2]} fizeram ${pts[win]} pontos: ${gamesWon} ${gamesWon === 1 ? 'jogo' : 'jogos'}.`)
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

// O tempo passa: bots jogam, vazas são recolhidas, mãos seguem; quem não
// jogar a tempo joga a carta que um bot jogaria.
export function tick(game, now, rand = Math.random) {
  if (!game.deadline || now < game.deadline) return game
  if (game.phase === 'trick') return collectTrick(game, now)
  if (game.phase === 'end') return deal(clone(game), now, rand)
  if (game.phase === 'play' && game.turn) return playCard(game, game.turn, botCard(game, game.turn).id, now)
  return game
}

// ---------- Bots ----------
const byWeakness = (a, b) => cardValue(a) - cardValue(b) || STRENGTH[a.rank] - STRENGTH[b.rank]

// Cartas que já saíram nesta mão (vazas recolhidas e a vaza na mesa).
function seen(g) {
  const s = new Set([...g.piles[0], ...g.piles[1]].map((c) => c.id))
  for (const t of g.trick) s.add(t.card.id)
  return s
}

// A carta é a mais alta que ainda anda do seu naipe?
function isBoss(g, id, card) {
  const out = seen(g)
  const mine = new Set(g.hands[id].map((c) => c.id))
  return buildSuecaDeck().every((c) => c.suit !== card.suit || STRENGTH[c.rank] <= STRENGTH[card.rank] || out.has(c.id) || mine.has(c.id))
}

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
    // A abrir: joga um "ás" seguro (a mais alta do naipe) ou a carta mais fraca.
    const bosses = nonTrump.filter((c) => isBoss(g, id, c)).sort((a, b) => cardValue(b) - cardValue(a))
    if (bosses.length) return bosses[0]
    return lowest(nonTrump.length ? nonTrump : legal)
  }
  const wIdx = trickWinner(g.trick, trump)
  const winnerId = g.trick[wIdx].id
  const pts = g.trick.reduce((s, t) => s + cardValue(t.card), 0)
  const last = g.trick.length === 3
  if (teamOf(g, winnerId) === teamOf(g, id)) {
    // O parceiro está a ganhar: se é seguro, carrega pontos.
    const wc = g.trick[wIdx].card
    const safe = last || (wc.suit === trump ? STRENGTH[wc.rank] >= STRENGTH.K : isBoss(g, id, wc))
    if (safe) {
      const pool = nonTrump.length ? nonTrump : legal
      return [...pool].sort((a, b) => cardValue(b) - cardValue(a) || STRENGTH[a.rank] - STRENGTH[b.rank])[0]
    }
    return lowest(legal)
  }
  const winners = legal.filter((c) => beats(c, g.trick, trump)).sort((a, b) => (a.suit === trump) - (b.suit === trump) || STRENGTH[a.rank] - STRENGTH[b.rank])
  if (winners.length) {
    const cheapest = winners[0]
    if (cheapest.suit !== trump || pts >= 4 || last) return cheapest
  }
  return lowest(legal)
}

export const suecaOnline = {
  minPlayers: 1,
  maxPlayers: 4,
  tick: true,
  tickMs: 250,
  start(players, action, now) {
    const humans = players.map((p) => p.id).slice(0, 4)
    const bots = Array.from({ length: 4 - humans.length }, (_, i) => `bot${i}`)
    // Com 2 pessoas, ficam na mesma equipa (lugares 0 e 2), se o anfitrião quiser.
    const order = humans.length === 2 && action.together !== false ? [humans[0], bots[0], humans[1], bots[1]] : [...humans, ...bots]
    return startGame(order, bots, now)
  },
  reduce(game, action, fromId, { now }) {
    if (action.type === 'tick') return tick(game, now)
    return applyAction(game, fromId, action, now)
  },
}
