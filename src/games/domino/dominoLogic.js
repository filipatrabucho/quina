// Dominó (duplo seis, 28 pedras). A 2 ou 3 jogadores, cada um recebe 7 e o
// resto fica para comprar; a 4, joga-se em equipas (lugares 0+2 contra 1+3),
// todos recebem 7 e quem não pode jogar passa. Na 1.ª mão começa quem tem o
// duplo mais alto (e tem de o jogar); depois começa quem ganhou a mão anterior.
// A mão acaba quando alguém fica sem pedras (dominó) ou quando o jogo fecha
// (ninguém pode jogar): aí ganha quem tiver menos pontos na mão. Quem ganha
// soma os pontos das pedras que ficaram aos adversários. Ganha a partida quem
// chegar primeiro a TARGET pontos.
import { shuffle } from '../../lib/cards.js'

export const TARGET = 100
export const HAND_SIZE = 7
export const BOT_DELAY_MS = 800
export const TURN_MS = 30000
export const END_MS = 10000
export const BOT_NAMES = ['Bot Rita', 'Bot Zé', 'Bot Inês']

export function buildSet() {
  const tiles = []
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push({ id: `${a}-${b}`, a, b })
  return tiles
}

export const pips = (t) => t.a + t.b
export const isDouble = (t) => t.a === t.b
export const handPips = (hand) => hand.reduce((s, t) => s + pips(t), 0)
export const isBot = (g, id) => g.bots.includes(id)
export const teams = (g) => g.order.length === 4
// Lado de cada lugar: a 4 são equipas (0 e 1); a 2 ou 3 cada um é o seu lado.
export const sideOf = (g, id) => (teams(g) ? g.order.indexOf(id) % 2 : g.order.indexOf(id))
const nextOf = (g, id) => g.order[(g.order.indexOf(id) + 1) % g.order.length]

function addLog(g, msg) {
  g.log = [msg, ...g.log].slice(0, 40)
}

export function startGame(ids, bots = [], now = Date.now(), rand = Math.random, opts = {}) {
  if (ids.length < 2 || ids.length > 4) throw new Error('O Dominó joga-se a 2, 3 ou 4.')
  const sides = ids.length === 4 ? 2 : ids.length
  const g = {
    order: ids,
    bots,
    timed: opts.timed !== false,
    target: opts.target || TARGET,
    handNo: 0,
    scores: Array(sides).fill(0),
    phase: 'play',
    hands: {},
    boneyard: [],
    chain: [], // pedras viradas da esquerda para a direita: { id, l, r }
    turn: null,
    starter: null,
    mustPlay: null,
    passes: 0,
    result: null,
    winner: null,
    deadline: null,
    log: [],
    seq: 0,
    wins: opts.wins || Array(sides).fill(0),
  }
  return deal(g, now, rand)
}

function deal(g, now, rand) {
  g.handNo += 1
  const set = shuffle(buildSet(), rand)
  g.hands = {}
  for (const id of g.order) g.hands[id] = set.splice(0, HAND_SIZE)
  g.boneyard = g.order.length === 4 ? [] : set
  g.chain = []
  g.passes = 0
  g.result = null
  g.phase = 'play'
  g.mustPlay = null
  let first = g.starter
  if (g.handNo === 1 || !first) {
    // Duplo mais alto; se ninguém tiver duplos, a pedra mais alta.
    let best = null
    for (const id of g.order) {
      for (const t of g.hands[id]) {
        const key = (isDouble(t) ? 100 : 0) + pips(t) * 10 + t.b
        if (!best || key > best.key) best = { key, id, tile: t }
      }
    }
    first = best.id
    g.mustPlay = best.tile.id
  }
  addLog(g, `Mão ${g.handNo}: começa @${first}.`)
  return setTurn(g, first, now)
}

function setTurn(g, id, now) {
  g.turn = id
  g.deadline = isBot(g, id) ? now + BOT_DELAY_MS : g.timed ? now + TURN_MS : null
  return g
}

const clone = (g) => ({
  ...g,
  hands: Object.fromEntries(Object.entries(g.hands).map(([k, v]) => [k, v.slice()])),
  boneyard: g.boneyard.slice(),
  chain: g.chain.slice(),
  scores: g.scores.slice(),
  log: g.log.slice(),
})

export const ends = (g) => (g.chain.length ? [g.chain[0].l, g.chain[g.chain.length - 1].r] : null)

// Onde pode ir esta pedra: ['L'], ['R'], ['L','R'] ou [] (com a mesa vazia: ['R']).
export function sidesFor(g, tile) {
  if (!g.chain.length) return !g.mustPlay || g.mustPlay === tile.id ? ['R'] : []
  const [l, r] = ends(g)
  const out = []
  if (tile.a === l || tile.b === l) out.push('L')
  if (tile.a === r || tile.b === r) out.push('R')
  return out
}

export function legalMoves(g, id) {
  const out = []
  for (const t of g.hands[id] || []) for (const side of sidesFor(g, t)) out.push({ tile: t.id, side })
  return out
}

export const canPlay = (g, id) => legalMoves(g, id).length > 0

function place(g, tile, side) {
  if (!g.chain.length) {
    g.chain.push({ id: tile.id, l: tile.a, r: tile.b })
    return
  }
  const [l, r] = ends(g)
  if (side === 'L') {
    // o lado que encosta à esquerda fica à direita da pedra
    g.chain.unshift(tile.b === l ? { id: tile.id, l: tile.a, r: tile.b } : { id: tile.id, l: tile.b, r: tile.a })
  } else {
    g.chain.push(tile.a === r ? { id: tile.id, l: tile.a, r: tile.b } : { id: tile.id, l: tile.b, r: tile.a })
  }
}

function play(game, id, tileId, side, now) {
  if (game.phase !== 'play') throw new Error('Agora não se pode jogar.')
  if (game.turn !== id) throw new Error('Não é a tua vez.')
  const tile = game.hands[id].find((t) => t.id === tileId)
  if (!tile) throw new Error('Essa pedra não é tua.')
  const sides = sidesFor(game, tile)
  if (!sides.length) throw new Error(game.mustPlay && !game.chain.length ? 'Tens de começar com o duplo mais alto.' : 'Essa pedra não encaixa.')
  const g = clone(game)
  place(g, tile, sides.includes(side) ? side : sides[0])
  g.hands[id] = g.hands[id].filter((t) => t.id !== tileId)
  g.mustPlay = null
  g.passes = 0
  g.seq += 1
  if (!g.hands[id].length) return endHand(g, id, now, 'domino')
  return setTurn(g, nextOf(g, id), now)
}

function draw(game, id, now) {
  if (game.phase !== 'play' || game.turn !== id) throw new Error('Não é a tua vez.')
  if (canPlay(game, id)) throw new Error('Tens pedras para jogar.')
  if (!game.boneyard.length) throw new Error('Já não há pedras para comprar.')
  const g = clone(game)
  g.hands[id].push(g.boneyard.pop())
  setTurn(g, id, now)
  if (isBot(g, id)) g.deadline = now + 250 // os bots compram depressa
  return g
}

function pass(game, id, now) {
  if (game.phase !== 'play' || game.turn !== id) throw new Error('Não é a tua vez.')
  if (canPlay(game, id)) throw new Error('Tens pedras para jogar.')
  if (game.boneyard.length) throw new Error('Ainda podes comprar.')
  const g = clone(game)
  g.passes += 1
  addLog(g, `@${id} passou.`)
  if (g.passes >= g.order.length) return endHand(g, null, now, 'fechado')
  return setTurn(g, nextOf(g, id), now)
}

function endHand(g, winnerId, now, how) {
  const n = g.scores.length
  const sidePips = Array(n).fill(0)
  for (const id of g.order) sidePips[sideOf(g, id)] += handPips(g.hands[id])
  let side
  if (how === 'domino') side = sideOf(g, winnerId)
  else {
    // Jogo fechado: ganha o lado com menos pontos na mão (empate: ninguém).
    const min = Math.min(...sidePips)
    const best = sidePips.map((p, i) => (p === min ? i : -1)).filter((i) => i >= 0)
    side = best.length === 1 ? best[0] : null
  }
  let points = 0
  if (side != null) {
    points = sidePips.reduce((s, p, i) => (i === side ? s : s + p), 0)
    g.scores[side] += points
    // Começa a mão seguinte quem fez dominó (ou, com o jogo fechado, quem do lado vencedor tem menos pontos).
    g.starter = winnerId || g.order.filter((p) => sideOf(g, p) === side).sort((x, y) => handPips(g.hands[x]) - handPips(g.hands[y]))[0]
  } else g.starter = nextOf(g, g.starter || g.order[0])
  g.result = { how, side, points, winnerId, pips: sidePips }
  addLog(g, side == null ? 'Jogo fechado e empatado: ninguém marca.' : `${how === 'domino' ? `@${winnerId} fez dominó` : 'Jogo fechado'}: +${points} pontos.`)
  g.turn = null
  const top = Math.max(...g.scores)
  if (top >= g.target) {
    g.phase = 'over'
    g.winner = g.scores.indexOf(top)
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
      return play(game, id, action.tile, action.side, now)
    case 'draw':
      return draw(game, id, now)
    case 'pass':
      return pass(game, id, now)
    case 'next':
      return game.phase === 'end' ? deal(clone(game), now, rand) : game
    case 'rematch': {
      if (game.phase !== 'over') return game
      const wins = game.wins.slice()
      wins[game.winner] += 1
      return startGame(game.order, game.bots, now, rand, { timed: game.timed, target: game.target, wins })
    }
    default:
      throw new Error('Jogada desconhecida.')
  }
}

// Jogada automática (bots, ou quem deixou acabar o tempo).
export function autoMove(g, id) {
  const moves = legalMoves(g, id)
  if (!moves.length) return g.boneyard.length ? { type: 'draw' } : { type: 'pass' }
  const hand = g.hands[id]
  const byId = Object.fromEntries(hand.map((t) => [t.id, t]))
  let best = null
  for (const m of moves) {
    const t = byId[m.tile]
    // Prefere livrar-se de pedras pesadas e de duplos, e deixar pontas que ainda tem.
    const sim = clone(g)
    place(sim, t, m.side)
    const [l, r] = ends(sim)
    const rest = hand.filter((x) => x.id !== t.id)
    const keeps = rest.filter((x) => x.a === l || x.b === l || x.a === r || x.b === r).length
    const score = pips(t) + (isDouble(t) ? 6 : 0) + keeps * 3
    if (!best || score > best.score) best = { score, move: m }
  }
  return { type: 'play', ...best.move }
}

export function tick(game, now, rand = Math.random) {
  if (!game.deadline || now < game.deadline) return game
  if (game.phase === 'end') return deal(clone(game), now, rand)
  if (game.phase === 'play' && game.turn) return applyAction(game, game.turn, autoMove(game, game.turn), now, rand)
  return game
}

export const dominoOnline = {
  minPlayers: 1,
  maxPlayers: 4,
  tick: true,
  tickMs: 250,
  start(players, action, now) {
    const humans = players.map((p) => p.id)
    const seats = Math.max(humans.length, Math.min(4, Math.max(2, Number(action.seats) || 2)))
    const bots = Array.from({ length: seats - humans.length }, (_, i) => `bot${i}`)
    let order = [...humans, ...bots]
    if (seats === 4 && humans.length === 2 && action.together !== false) order = [humans[0], bots[0], humans[1], bots[1]]
    return startGame(order, bots, now, Math.random, { target: Number(action.target) || TARGET })
  },
  reduce(game, action, fromId, { now }) {
    if (action.type === 'tick') return tick(game, now)
    return applyAction(game, fromId, action, now)
  },
}
