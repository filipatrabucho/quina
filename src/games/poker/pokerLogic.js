// Texas Hold'em em formato torneio (fichas a fingir): todos começam com as
// mesmas fichas, as blinds sobem de tempos a tempos e ganha quem ficar com
// tudo. Corre no anfitrião da sala (ou no browser, contra bots).
import { buildDeck, shuffle } from '../../lib/cards.js'
import { bestHand, compareScores, handName, RANK_VALUE } from './pokerHands.js'

export const START_CHIPS = 1500
export const BLINDS = [[10, 20], [15, 30], [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400], [300, 600], [500, 1000]]
export const HANDS_PER_LEVEL = 6
export const TURN_MS = 30000 // online: quem não joga a tempo passa ou desiste
export const BOT_DELAY_MS = 900
export const SHOWDOWN_MS = 6000 // online: tempo a ver o resultado antes da mão seguinte
const STREETS = ['preflop', 'flop', 'turn', 'river']

const clone = (g) => ({
  ...g,
  deck: g.deck.slice(),
  board: g.board.slice(),
  chips: { ...g.chips },
  holes: { ...g.holes },
  folded: { ...g.folded },
  bets: { ...g.bets },
  contrib: { ...g.contrib },
  acted: { ...g.acted },
  log: g.log.slice(-40),
})

const log = (g, msg) => {
  g.log = [...g.log.slice(-40), msg]
}

export const BOT_NAMES = ['Bot Rita', 'Bot Zé', 'Bot Inês', 'Bot Rui', 'Bot Ana']

export function startGame(ids, bots = [], now = Date.now(), rand = Math.random) {
  const g = {
    order: ids,
    bots,
    chips: Object.fromEntries(ids.map((id) => [id, START_CHIPS])),
    dealer: Math.floor(rand() * ids.length),
    handNo: 0,
    level: 0,
    phase: 'waiting',
    deck: [],
    board: [],
    holes: {},
    folded: {},
    bets: {},
    contrib: {},
    acted: {},
    toAct: null,
    currentBet: 0,
    minRaise: 0,
    result: null,
    winner: null,
    deadline: null,
    log: [],
  }
  return startHand(g, now, rand)
}

export const seated = (g) => g.order.filter((id) => g.chips[id] > 0 || g.contrib[id] > 0)
const live = (g) => g.order.filter((id) => g.holes[id] && !g.folded[id]) // ainda na mão
const canAct = (g, id) => live(g).includes(id) && g.chips[id] > 0
export const isBot = (g, id) => g.bots.includes(id)
export const blinds = (g) => BLINDS[Math.min(g.level, BLINDS.length - 1)]

function nextSeat(g, from, pred) {
  const n = g.order.length
  for (let k = 1; k <= n; k++) {
    const id = g.order[(g.order.indexOf(from) + k) % n]
    if (pred(id)) return id
  }
  return null
}

function post(g, id, amount) {
  const a = Math.min(amount, g.chips[id])
  g.chips[id] -= a
  g.bets[id] = (g.bets[id] || 0) + a
  g.contrib[id] = (g.contrib[id] || 0) + a
  return a
}

export function startHand(game, now = Date.now(), rand = Math.random) {
  const g = clone(game)
  const players = g.order.filter((id) => g.chips[id] > 0)
  if (players.length <= 1) {
    g.phase = 'over'
    g.winner = players[0] || null
    g.toAct = null
    g.deadline = null
    return g
  }
  g.handNo += 1
  g.level = Math.floor((g.handNo - 1) / HANDS_PER_LEVEL)
  const [sb, bb] = blinds(g)
  if (g.handNo > 1 && (g.handNo - 1) % HANDS_PER_LEVEL === 0) log(g, `As blinds subiram para ${sb}/${bb}.`)
  g.deck = shuffle(buildDeck(1), rand)
  g.board = []
  g.holes = {}
  g.folded = {}
  g.bets = {}
  g.contrib = {}
  g.acted = {}
  g.result = null
  const dealerId = g.handNo === 1 ? players[g.dealer % players.length] : nextSeat(g, g.order[g.dealer] ?? players[0], (id) => g.chips[id] > 0)
  g.dealer = g.order.indexOf(dealerId)
  for (const id of players) g.holes[id] = [g.deck.pop(), g.deck.pop()]
  // Frente a frente, o dealer põe a small blind.
  const sbId = players.length === 2 ? dealerId : nextSeat(g, dealerId, (id) => g.chips[id] > 0)
  const bbId = nextSeat(g, sbId, (id) => g.chips[id] > 0)
  post(g, sbId, sb)
  post(g, bbId, bb)
  g.sb = sbId
  g.bb = bbId
  g.currentBet = bb
  g.minRaise = bb
  g.phase = 'preflop'
  g.toAct = nextSeat(g, bbId, (id) => canAct(g, id))
  return afterAction(g, now, rand, true)
}

const toCall = (g, id) => Math.max(0, g.currentBet - (g.bets[id] || 0))
const pot = (g) => Object.values(g.contrib).reduce((a, b) => a + b, 0)
export { toCall, pot }

// Acabou a ronda de apostas?
function roundDone(g) {
  const actors = live(g).filter((id) => g.chips[id] > 0)
  if (live(g).length <= 1) return true
  return actors.every((id) => g.acted[id] && (g.bets[id] || 0) === g.currentBet) || actors.length === 0
}

function afterAction(g, now, rand, justStarted = false) {
  if (live(g).length === 1) return award(g, now)
  if (!justStarted && !roundDone(g)) {
    g.toAct = nextSeat(g, g.toAct, (id) => canAct(g, id) && !(g.acted[id] && (g.bets[id] || 0) === g.currentBet))
    if (g.toAct) return setTurn(g, now)
  }
  if (justStarted) {
    // Pode já não haver ninguém para agir (all-ins nas blinds).
    if (!g.toAct || roundDone(g)) return nextStreet(g, now, rand)
    return setTurn(g, now)
  }
  return nextStreet(g, now, rand)
}

function setTurn(g, now) {
  g.deadline = now + (isBot(g, g.toAct) ? BOT_DELAY_MS : TURN_MS)
  return g
}

function nextStreet(g, now, rand) {
  const i = STREETS.indexOf(g.phase)
  g.bets = {}
  g.acted = {}
  g.currentBet = 0
  g.minRaise = blinds(g)[1]
  if (i === STREETS.length - 1) return showdown(g, now)
  g.phase = STREETS[i + 1]
  g.deck.pop() // carta queimada
  if (g.phase === 'flop') g.board.push(g.deck.pop(), g.deck.pop(), g.deck.pop())
  else g.board.push(g.deck.pop())
  // Se no máximo um jogador ainda pode apostar, mostra as cartas até ao fim.
  if (live(g).filter((id) => g.chips[id] > 0).length <= 1) return nextStreet(g, now, rand)
  g.toAct = nextSeat(g, g.order[g.dealer], (id) => canAct(g, id))
  return setTurn(g, now)
}

// Potes (principal e laterais) a partir do que cada um meteu.
export function buildPots(g) {
  const ids = Object.keys(g.contrib).filter((id) => g.contrib[id] > 0)
  const levels = [...new Set(live(g).map((id) => g.contrib[id] || 0))].filter((x) => x > 0).sort((a, b) => a - b)
  const pots = []
  let prev = 0
  for (const L of levels) {
    let amount = 0
    for (const id of ids) amount += Math.max(0, Math.min(g.contrib[id], L) - prev)
    const eligible = live(g).filter((id) => (g.contrib[id] || 0) >= L)
    if (amount) pots.push({ amount, eligible })
    prev = L
  }
  // Fichas acima do maior nível (de quem desistiu) vão para o último pote.
  const extra = ids.reduce((a, id) => a + Math.max(0, g.contrib[id] - prev), 0)
  if (extra && pots.length) pots[pots.length - 1].amount += extra
  return pots
}

function award(g, now) {
  const [only] = live(g)
  const total = pot(g)
  g.chips[only] += total
  g.result = { kind: 'fold', winners: [{ ids: [only], amount: total }], shown: {} }
  log(g, `${'@' + only} ganhou ${total} fichas (os outros desistiram).`)
  return endHand(g, now)
}

function showdown(g, now) {
  const shown = {}
  for (const id of live(g)) {
    const best = bestHand([...g.holes[id], ...g.board])
    shown[id] = { score: best.score, name: handName(best.score), cards: best.cards.map((c) => c.id) }
  }
  const winners = []
  for (const p of buildPots(g)) {
    let top = []
    for (const id of p.eligible) {
      if (!top.length || compareScores(shown[id].score, shown[top[0]].score) > 0) top = [id]
      else if (compareScores(shown[id].score, shown[top[0]].score) === 0) top.push(id)
    }
    const share = Math.floor(p.amount / top.length)
    let rest = p.amount - share * top.length
    // Fichas que sobram da divisão vão para o primeiro depois do dealer.
    const ordered = [...top].sort((a, b) => ((g.order.indexOf(a) - g.dealer + g.order.length) % g.order.length) - ((g.order.indexOf(b) - g.dealer + g.order.length) % g.order.length))
    for (const id of ordered) {
      g.chips[id] += share + (rest > 0 ? 1 : 0)
      rest--
    }
    winners.push({ ids: top, amount: p.amount, hand: shown[top[0]].name })
  }
  g.result = { kind: 'showdown', winners, shown }
  for (const w of winners) log(g, `${w.ids.map((id) => '@' + id).join(' e ')} ${w.ids.length > 1 ? 'dividiram' : 'ganhou'} ${w.amount} fichas com ${w.hand}.`)
  return endHand(g, now)
}

function endHand(g, now) {
  g.phase = 'showdown'
  g.toAct = null
  g.deadline = now + SHOWDOWN_MS
  const left = g.order.filter((id) => g.chips[id] > 0)
  if (left.length <= 1) {
    g.winner = left[0] || null
    g.phase = 'over'
    g.deadline = null
  }
  return g
}

// ---------- Jogadas ----------
export function legalActions(g, id) {
  if (g.toAct !== id || !STREETS.includes(g.phase)) return null
  const call = toCall(g, id)
  const stack = g.chips[id]
  const minTo = g.currentBet + g.minRaise
  return {
    canCheck: call === 0,
    call: Math.min(call, stack),
    canRaise: stack > call,
    minRaiseTo: Math.min(minTo, (g.bets[id] || 0) + stack),
    maxRaiseTo: (g.bets[id] || 0) + stack,
  }
}

function act(game, id, action, now, rand) {
  const opts = legalActions(game, id)
  if (!opts) throw new Error('Não é a tua vez.')
  const g = clone(game)
  const name = '@' + id
  switch (action.type) {
    case 'fold':
      g.folded[id] = true
      log(g, `${name} desistiu.`)
      break
    case 'check':
      if (!opts.canCheck) throw new Error('Tens de pagar ou desistir.')
      log(g, `${name} passou.`)
      break
    case 'call': {
      if (opts.canCheck) throw new Error('Não há nada para pagar.')
      const a = post(g, id, opts.call)
      log(g, `${name} pagou ${a}${g.chips[id] === 0 ? ' (all-in)' : ''}.`)
      break
    }
    case 'raise': {
      if (!opts.canRaise) throw new Error('Não tens fichas para aumentar.')
      let to = Math.floor(Number(action.to))
      if (!(to >= opts.minRaiseTo)) throw new Error(`O mínimo é ${opts.minRaiseTo}.`)
      to = Math.min(to, opts.maxRaiseTo)
      const before = g.currentBet
      post(g, id, to - (g.bets[id] || 0))
      if (g.bets[id] > before) {
        g.minRaise = Math.max(g.minRaise, g.bets[id] - before)
        g.currentBet = g.bets[id]
        g.acted = {} // os outros voltam a ter de responder
      }
      log(g, `${name} ${before === 0 ? 'apostou' : 'aumentou para'} ${g.bets[id]}${g.chips[id] === 0 ? ' (all-in)' : ''}.`)
      break
    }
    default:
      throw new Error('Jogada desconhecida.')
  }
  g.acted[id] = true
  return afterAction(g, now, rand)
}

export function applyAction(game, id, action, now = Date.now(), rand = Math.random) {
  if (!game.order.includes(id)) throw new Error('Não estás nesta mesa.')
  if (action.type === 'next') return game.phase === 'showdown' ? startHand(game, now, rand) : game
  if (action.type === 'rematch') return game.phase === 'over' ? { ...startGame(game.order, game.bots, now, rand), wins: { ...(game.wins || {}), [game.winner]: ((game.wins || {})[game.winner] || 0) + 1 } } : game
  if (game.phase === 'over') throw new Error('O torneio acabou.')
  return act(game, id, action, now, rand)
}

// ---------- Bots ----------
// Força da mão antes do flop, de 0 a 1.
function preflopStrength(cards) {
  const [a, b] = cards.map((c) => RANK_VALUE[c.rank]).sort((x, y) => y - x)
  const suited = cards[0].suit === cards[1].suit
  let s = (a + b) / 28
  if (a === b) s = 0.55 + a / 30
  if (suited) s += 0.06
  if (a - b === 1) s += 0.04
  if (a === 14) s += 0.08
  return Math.min(1, s)
}

// Probabilidade de ganhar contra `opps` mãos ao calhas (Monte Carlo).
export function equity(hole, board, opps, sims = 160, rand = Math.random) {
  const used = new Set([...hole, ...board].map((c) => `${c.rank}${c.suit}`))
  const deck = buildDeck(1).filter((c) => !used.has(`${c.rank}${c.suit}`))
  let score = 0
  for (let s = 0; s < sims; s++) {
    const d = shuffle(deck, rand)
    const full = [...board, ...d.splice(0, 5 - board.length)]
    const mine = bestHand([...hole, ...full]).score
    let best = 1
    for (let o = 0; o < opps; o++) {
      const theirs = bestHand([d.pop(), d.pop(), ...full]).score
      const c = compareScores(mine, theirs)
      if (c < 0) { best = 0; break }
      if (c === 0) best = Math.min(best, 0.5)
    }
    score += best
  }
  return score / sims
}

export function botDecision(g, id, rand = Math.random) {
  const o = legalActions(g, id)
  if (!o) return null
  const opps = live(g).length - 1
  const strength = g.phase === 'preflop' ? preflopStrength(g.holes[id]) : equity(g.holes[id], g.board, opps, 140, rand)
  // ajusta à mesa: com mais adversários é preciso mais força
  const need = g.phase === 'preflop' ? 0.42 + opps * 0.03 : 1 / (opps + 1)
  const potNow = pot(g)
  const potOdds = o.call / (potNow + o.call || 1)
  const r = rand()
  const raiseTo = (frac) => Math.max(o.minRaiseTo, Math.min(o.maxRaiseTo, g.currentBet + Math.round((potNow * frac) / 10) * 10))
  if (strength > need + 0.28 && o.canRaise && r < 0.75) return { type: 'raise', to: raiseTo(0.6 + rand() * 0.5) }
  if (o.canCheck) {
    if (strength > need + 0.12 && o.canRaise && r < 0.5) return { type: 'raise', to: raiseTo(0.5) }
    if (r < 0.07 && o.canRaise) return { type: 'raise', to: raiseTo(0.5) } // bluff
    return { type: 'check' }
  }
  if (strength >= Math.max(potOdds, need - 0.08) || (o.call <= blinds(g)[1] && strength > need - 0.15)) return { type: 'call' }
  return { type: 'fold' }
}

// ---------- Tempo ----------
export function tick(game, now, rand = Math.random) {
  if (!game.deadline || now < game.deadline) return game
  if (game.phase === 'showdown') return startHand(game, now, rand)
  if (!game.toAct) return game
  if (isBot(game, game.toAct)) return act(game, game.toAct, botDecision(game, game.toAct, rand), now, rand)
  // Quem não joga a tempo passa (se puder) ou desiste.
  const o = legalActions(game, game.toAct)
  return act(game, game.toAct, { type: o?.canCheck ? 'check' : 'fold' }, now, rand)
}

export const pokerOnline = {
  minPlayers: 1,
  maxPlayers: 6,
  tick: true,
  tickMs: 300,
  start(players, action, now) {
    const humans = players.map((p) => p.id)
    const nBots = Math.max(0, Math.min(6 - humans.length, Number(action.bots) || 0))
    if (humans.length + nBots < 2) throw new Error('Junta mais um jogador ou adiciona um bot.')
    const bots = Array.from({ length: nBots }, (_, i) => `bot${i}`)
    return startGame([...humans, ...bots], bots, now)
  },
  reduce(game, action, fromId, { now }) {
    if (action.type === 'tick') return tick(game, now)
    return applyAction(game, fromId, action, now)
  },
}
