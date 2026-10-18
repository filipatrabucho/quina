// Colonos: regras do jogo base de colonização da ilha (3 a 4 jogadores,
// também dá a 2). O estado é todo serializável; corre no anfitrião.
import { HEXES, VERTICES, EDGES, PORT_EDGES, hexNeighbors } from './board.js'

export const RES = ['madeira', 'tijolo', 'la', 'trigo', 'minerio']
export const RES_NAME = { madeira: 'Madeira', tijolo: 'Tijolo', la: 'Lã', trigo: 'Trigo', minerio: 'Minério' }
export const TERRAIN = { madeira: 'Floresta', tijolo: 'Colinas', la: 'Pasto', trigo: 'Campo', minerio: 'Montanha', deserto: 'Deserto' }
export const COSTS = {
  estrada: { madeira: 1, tijolo: 1 },
  aldeia: { madeira: 1, tijolo: 1, la: 1, trigo: 1 },
  cidade: { trigo: 2, minerio: 3 },
  desenvolvimento: { la: 1, trigo: 1, minerio: 1 },
}
export const PIECES = { estrada: 15, aldeia: 5, cidade: 4 }
export const BANK_SIZE = 19
export const WIN_POINTS = 10
export const DEV_NAME = {
  cavaleiro: 'Cavaleiro',
  ponto: 'Ponto de vitória',
  estradas: 'Construção de estradas',
  fartura: 'Ano de fartura',
  monopolio: 'Monopólio',
}
export const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 }

const emptyHand = () => Object.fromEntries(RES.map((r) => [r, 0]))
export const handSize = (hand) => RES.reduce((a, r) => a + (hand?.[r] || 0), 0)
const hasCards = (hand, cost) => RES.every((r) => (hand[r] || 0) >= (cost[r] || 0))
const addCards = (hand, cards, sign = 1) => Object.fromEntries(RES.map((r) => [r, (hand[r] || 0) + sign * (cards[r] || 0)]))

export function shuffle(list, rand = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------- Preparação do tabuleiro ----------
export function makeBoard(rand = Math.random) {
  const terrains = shuffle(
    ['deserto', ...Array(4).fill('madeira'), ...Array(4).fill('la'), ...Array(4).fill('trigo'), ...Array(3).fill('tijolo'), ...Array(3).fill('minerio')],
    rand
  )
  const NUMBERS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]
  let nums
  // 6 e 8 nunca ficam lado a lado.
  for (let tries = 0; tries < 2000; tries++) {
    const pool = shuffle(NUMBERS, rand)
    nums = terrains.map((t) => (t === 'deserto' ? null : pool.pop()))
    const hot = (i) => nums[i] === 6 || nums[i] === 8
    if (!nums.some((n, i) => hot(i) && hexNeighbors(i).some(hot))) break
  }
  const portTypes = shuffle(['3:1', '3:1', '3:1', '3:1', ...RES], rand)
  return {
    tiles: terrains.map((res, i) => ({ res, num: nums[i] })),
    robber: terrains.indexOf('deserto'),
    ports: PORT_EDGES.map((edge, i) => ({ edge, type: portTypes[i] })),
  }
}

const DEV_DECK = [...Array(14).fill('cavaleiro'), ...Array(5).fill('ponto'), ...Array(2).fill('estradas'), ...Array(2).fill('fartura'), ...Array(2).fill('monopolio')]

export function startGame(playerIds, rand = Math.random) {
  const order = [...playerIds]
  return {
    order,
    board: makeBoard(rand),
    buildings: {}, // vértice -> { owner, kind }
    roads: {}, // aresta -> dono
    hands: Object.fromEntries(order.map((id) => [id, emptyHand()])),
    devDeck: shuffle(DEV_DECK, rand).map((type, id) => ({ id, type })),
    devHands: Object.fromEntries(order.map((id) => [id, []])),
    knights: Object.fromEntries(order.map((id) => [id, 0])),
    awards: { estrada: null, exercito: null },
    roadLengths: Object.fromEntries(order.map((id) => [id, 0])),
    phase: 'setup',
    setup: { i: 0, expect: 'aldeia', vertex: null },
    turn: 0,
    turnNo: 0,
    dice: null,
    discards: {},
    afterRobber: null,
    devPlayed: false,
    freeRoads: 0,
    offer: null,
    winner: null,
    log: [],
    round: 1,
    score: Object.fromEntries(order.map((id) => [id, 0])),
  }
}

// ---------- Consultas ----------
export const setupOrder = (game) => [...game.order, ...[...game.order].reverse()]
export function currentPlayer(game) {
  return game.phase === 'setup' ? setupOrder(game)[game.setup.i] : game.order[game.turn]
}

export function bank(game) {
  const b = Object.fromEntries(RES.map((r) => [r, BANK_SIZE]))
  for (const h of Object.values(game.hands)) for (const r of RES) b[r] -= h[r] || 0
  return b
}

export const countPieces = (game, pid, kind) =>
  kind === 'estrada' ? Object.values(game.roads).filter((o) => o === pid).length : Object.values(game.buildings).filter((b) => b.owner === pid && b.kind === kind).length

export function points(game, pid, hidden = false) {
  let p = 0
  for (const b of Object.values(game.buildings)) if (b.owner === pid) p += b.kind === 'cidade' ? 2 : 1
  if (game.awards.estrada === pid) p += 2
  if (game.awards.exercito === pid) p += 2
  if (hidden) p += game.devHands[pid].filter((c) => c.type === 'ponto').length
  return p
}

const freeVertexByDistance = (game, v) => !game.buildings[v] && VERTICES[v].adj.every((n) => !game.buildings[n])

export function canPlaceSettlement(game, pid, v, setup = false) {
  if (v == null || !VERTICES[v] || !freeVertexByDistance(game, v)) return false
  if (setup) return true
  return VERTICES[v].edges.some((e) => game.roads[e] === pid)
}

export function canPlaceRoad(game, pid, e, fromVertex = null) {
  const edge = EDGES[e]
  if (!edge || game.roads[e]) return false
  if (fromVertex != null) return edge.a === fromVertex || edge.b === fromVertex
  return [edge.a, edge.b].some((v) => {
    const b = game.buildings[v]
    if (b && b.owner === pid) return true
    if (b && b.owner !== pid) return false // um edifício de outro corta a ligação
    return VERTICES[v].edges.some((o) => o !== e && game.roads[o] === pid)
  })
}

export const legalSettlements = (game, pid, setup = false) => VERTICES.map((_, v) => v).filter((v) => canPlaceSettlement(game, pid, v, setup))
export const legalRoads = (game, pid, fromVertex = null) => EDGES.map((_, e) => e).filter((e) => canPlaceRoad(game, pid, e, fromVertex))
export const legalCities = (game, pid) => Object.keys(game.buildings).map(Number).filter((v) => game.buildings[v].owner === pid && game.buildings[v].kind === 'aldeia')

export function portRates(game, pid) {
  const rates = Object.fromEntries(RES.map((r) => [r, 4]))
  for (const { edge, type } of game.board.ports) {
    const { a, b } = EDGES[edge]
    if (![a, b].some((v) => game.buildings[v]?.owner === pid)) continue
    if (type === '3:1') RES.forEach((r) => (rates[r] = Math.min(rates[r], 3)))
    else rates[type] = 2
  }
  return rates
}

export function robberVictims(game, hex, pid) {
  const ids = new Set()
  for (const v of HEXES[hex].vertices) {
    const b = game.buildings[v]
    if (b && b.owner !== pid && handSize(game.hands[b.owner]) > 0) ids.add(b.owner)
  }
  return [...ids]
}

export function longestRoad(game, pid) {
  const mine = Object.keys(game.roads).map(Number).filter((e) => game.roads[e] === pid)
  if (!mine.length) return 0
  const at = {}
  for (const e of mine) for (const v of [EDGES[e].a, EDGES[e].b]) (at[v] ||= []).push(e)
  const blocked = (v) => game.buildings[v] && game.buildings[v].owner !== pid
  const used = new Set()
  const dfs = (v, start) => {
    if (!start && blocked(v)) return 0
    let best = 0
    for (const e of at[v] || []) {
      if (used.has(e)) continue
      used.add(e)
      const o = EDGES[e].a === v ? EDGES[e].b : EDGES[e].a
      best = Math.max(best, 1 + dfs(o, false))
      used.delete(e)
    }
    return best
  }
  return Math.max(...Object.keys(at).map((v) => dfs(Number(v), true)))
}

// Recalcula a estrada mais longa (mínimo 5; empate fica com quem já a tinha).
function updateLongestRoad(game) {
  const lengths = Object.fromEntries(game.order.map((id) => [id, longestRoad(game, id)]))
  const holder = game.awards.estrada
  const max = Math.max(...Object.values(lengths))
  let next = holder
  if (holder && lengths[holder] === max && max >= 5) next = holder
  else {
    const top = game.order.filter((id) => lengths[id] === max)
    next = max >= 5 && top.length === 1 ? top[0] : null
  }
  const log = next !== holder && next ? [...game.log, { by: next, msg: `ficou com a Estrada mais longa (${max})` }] : game.log
  return { ...game, roadLengths: lengths, awards: { ...game.awards, estrada: next }, log }
}

function updateArmy(game, pid) {
  const holder = game.awards.exercito
  const k = game.knights[pid]
  if (k >= 3 && holder !== pid && (!holder || k > game.knights[holder])) {
    return { ...game, awards: { ...game.awards, exercito: pid }, log: [...game.log, { by: pid, msg: `ficou com o Maior exército (${k})` }] }
  }
  return game
}

const log = (game, by, msg) => ({ ...game, log: [...game.log.slice(-40), { by, msg }] })

function checkWin(game) {
  const pid = currentPlayer(game)
  if (game.phase === 'setup' || game.winner) return game
  if (points(game, pid, true) >= WIN_POINTS) {
    return { ...log(game, pid, 'chegou aos 10 pontos e ganhou!'), winner: pid, phase: 'fim', offer: null, score: { ...game.score, [pid]: (game.score[pid] || 0) + 1 } }
  }
  return game
}

const pay = (game, pid, cost) => ({ ...game, hands: { ...game.hands, [pid]: addCards(game.hands[pid], cost, -1) } })

function produce(game, total) {
  const owed = {} // res -> { pid: n }
  game.board.tiles.forEach((t, hi) => {
    if (t.num !== total || hi === game.board.robber) return
    for (const v of HEXES[hi].vertices) {
      const b = game.buildings[v]
      if (!b) continue
      owed[t.res] ||= {}
      owed[t.res][b.owner] = (owed[t.res][b.owner] || 0) + (b.kind === 'cidade' ? 2 : 1)
    }
  })
  const left = bank(game)
  let hands = { ...game.hands }
  for (const [res, who] of Object.entries(owed)) {
    const need = Object.values(who).reduce((a, b) => a + b, 0)
    const ids = Object.keys(who)
    if (need > left[res] && ids.length > 1) continue // não chega para todos: ninguém recebe
    for (const id of ids) hands[id] = { ...hands[id], [res]: hands[id][res] + Math.min(who[id], left[res]) }
  }
  return { ...game, hands }
}

// ---------- Ações ----------
function requireTurn(game, pid) {
  if (game.winner) throw new Error('A partida já acabou.')
  if (currentPlayer(game) !== pid) throw new Error('Não é a tua vez.')
}

function setupPlace(game, pid, action) {
  const s = game.setup
  if (action.type === 'build' && action.kind === 'aldeia' && s.expect === 'aldeia') {
    if (!canPlaceSettlement(game, pid, action.at, true)) throw new Error('Não podes construir aí (tem de haver um cruzamento livre entre aldeias).')
    let next = { ...game, buildings: { ...game.buildings, [action.at]: { owner: pid, kind: 'aldeia' } }, setup: { ...s, expect: 'estrada', vertex: action.at } }
    if (s.i >= game.order.length) {
      // A segunda aldeia dá logo uma carta de cada terreno à volta.
      const gain = emptyHand()
      for (const hi of VERTICES[action.at].hexes) if (game.board.tiles[hi].res !== 'deserto') gain[game.board.tiles[hi].res]++
      next = { ...next, hands: { ...next.hands, [pid]: addCards(next.hands[pid], gain) } }
    }
    return log(next, pid, 'colocou uma aldeia')
  }
  if (action.type === 'build' && action.kind === 'estrada' && s.expect === 'estrada') {
    if (!canPlaceRoad(game, pid, action.at, s.vertex)) throw new Error('A estrada tem de sair da aldeia que acabaste de pôr.')
    const roads = { ...game.roads, [action.at]: pid }
    const i = s.i + 1
    if (i >= setupOrder(game).length) return log({ ...game, roads, phase: 'roll', turn: 0, turnNo: 1, setup: { i, expect: null, vertex: null } }, pid, 'colocou uma estrada')
    return log({ ...game, roads, setup: { i, expect: 'aldeia', vertex: null } }, pid, 'colocou uma estrada')
  }
  throw new Error(s.expect === 'aldeia' ? 'Coloca uma aldeia.' : 'Coloca uma estrada junto à aldeia.')
}

export function roll(game, pid, rand = Math.random) {
  requireTurn(game, pid)
  if (game.phase !== 'roll') throw new Error('Agora não podes lançar os dados.')
  const dice = [1 + Math.floor(rand() * 6), 1 + Math.floor(rand() * 6)]
  const total = dice[0] + dice[1]
  let next = log({ ...game, dice }, pid, `lançou ${total}`)
  if (total !== 7) return { ...produce(next, total), phase: 'main' }
  const discards = {}
  for (const id of game.order) {
    const n = handSize(game.hands[id])
    if (n > 7) discards[id] = Math.floor(n / 2)
  }
  return { ...next, discards, phase: Object.keys(discards).length ? 'discard' : 'robber', afterRobber: 'main' }
}

function discard(game, pid, cards) {
  if (game.phase !== 'discard' || !game.discards[pid]) throw new Error('Não tens de descartar.')
  const clean = Object.fromEntries(RES.map((r) => [r, Math.max(0, Math.floor(cards?.[r] || 0))]))
  if (handSize(clean) !== game.discards[pid]) throw new Error(`Tens de descartar ${game.discards[pid]} cartas.`)
  if (!hasCards(game.hands[pid], clean)) throw new Error('Não tens essas cartas.')
  const discards = { ...game.discards }
  delete discards[pid]
  const next = log({ ...pay(game, pid, clean), discards }, pid, `descartou ${handSize(clean)} cartas`)
  return Object.keys(discards).length ? next : { ...next, phase: 'robber' }
}

function moveRobber(game, pid, hex, victim, rand = Math.random) {
  requireTurn(game, pid)
  if (game.phase !== 'robber') throw new Error('Agora não podes mover o ladrão.')
  if (!HEXES[hex] || hex === game.board.robber) throw new Error('Põe o ladrão noutro terreno.')
  const victims = robberVictims(game, hex, pid)
  let next = { ...game, board: { ...game.board, robber: hex } }
  if (victims.length) {
    if (!victims.includes(victim)) throw new Error('Escolhe a quem roubar.')
    const hand = game.hands[victim]
    const pool = RES.flatMap((r) => Array(hand[r]).fill(r))
    const card = pool[Math.floor(rand() * pool.length)]
    next = {
      ...next,
      hands: { ...next.hands, [victim]: { ...hand, [card]: hand[card] - 1 }, [pid]: { ...next.hands[pid], [card]: next.hands[pid][card] + 1 } },
      lastSteal: { by: pid, from: victim, res: card, turnNo: game.turnNo },
    }
    next = log(next, pid, `moveu o ladrão e roubou uma carta a @${victim}`)
  } else next = log(next, pid, 'moveu o ladrão')
  return { ...next, phase: game.afterRobber || 'main', afterRobber: null }
}

function build(game, pid, kind, at) {
  requireTurn(game, pid)
  const free = game.phase === 'estradas' && kind === 'estrada'
  if (game.phase !== 'main' && !free) throw new Error('Primeiro lança os dados.')
  if (countPieces(game, pid, kind) >= PIECES[kind]) throw new Error(`Já não tens ${kind === 'cidade' ? 'cidades' : kind + 's'}.`)
  if (!free && !hasCards(game.hands[pid], COSTS[kind])) throw new Error('Não tens cartas suficientes.')
  let next
  if (kind === 'estrada') {
    if (!canPlaceRoad(game, pid, at)) throw new Error('A estrada tem de ligar à tua rede.')
    next = { ...game, roads: { ...game.roads, [at]: pid } }
  } else if (kind === 'aldeia') {
    if (!canPlaceSettlement(game, pid, at)) throw new Error('Não podes construir aí: tem de ligar a uma estrada tua e ficar longe das outras aldeias.')
    next = { ...game, buildings: { ...game.buildings, [at]: { owner: pid, kind: 'aldeia' } } }
  } else if (kind === 'cidade') {
    if (game.buildings[at]?.owner !== pid || game.buildings[at].kind !== 'aldeia') throw new Error('Só podes melhorar uma aldeia tua.')
    next = { ...game, buildings: { ...game.buildings, [at]: { owner: pid, kind: 'cidade' } } }
  } else throw new Error('Construção inválida.')
  if (!free) next = pay(next, pid, COSTS[kind])
  next = log(next, pid, `construiu ${kind === 'cidade' ? 'uma cidade' : kind === 'aldeia' ? 'uma aldeia' : 'uma estrada'}`)
  if (free) {
    const freeRoads = game.freeRoads - 1
    next = { ...next, freeRoads, phase: freeRoads > 0 && legalRoads(next, pid).length ? 'estradas' : 'main' }
    if (next.phase === 'main') next.freeRoads = 0
  }
  if (kind !== 'cidade') next = updateLongestRoad(next)
  return next
}

function buyDev(game, pid) {
  requireTurn(game, pid)
  if (game.phase !== 'main') throw new Error('Primeiro lança os dados.')
  if (!game.devDeck.length) throw new Error('Já não há cartas de desenvolvimento.')
  if (!hasCards(game.hands[pid], COSTS.desenvolvimento)) throw new Error('Não tens cartas suficientes.')
  const [card, ...devDeck] = game.devDeck
  const next = pay({ ...game, devDeck, devHands: { ...game.devHands, [pid]: [...game.devHands[pid], { ...card, turn: game.turnNo }] } }, pid, COSTS.desenvolvimento)
  return log(next, pid, 'comprou uma carta de desenvolvimento')
}

function playDev(game, pid, action) {
  requireTurn(game, pid)
  if (!['roll', 'main'].includes(game.phase)) throw new Error('Agora não podes jogar cartas.')
  if (game.devPlayed) throw new Error('Só podes jogar uma carta de desenvolvimento por vez.')
  const card = game.devHands[pid].find((c) => c.type === action.card && c.type !== 'ponto' && c.turn < game.turnNo)
  if (!card) throw new Error(game.devHands[pid].some((c) => c.type === action.card) ? 'Não podes jogar uma carta comprada nesta vez.' : 'Não tens essa carta.')
  if (game.phase === 'roll' && card.type !== 'cavaleiro') throw new Error('Antes de lançar os dados só podes jogar o Cavaleiro.')
  let next = { ...game, devPlayed: true, devHands: { ...game.devHands, [pid]: game.devHands[pid].filter((c) => c.id !== card.id) } }
  switch (card.type) {
    case 'cavaleiro':
      next = { ...next, knights: { ...next.knights, [pid]: next.knights[pid] + 1 }, phase: 'robber', afterRobber: game.phase }
      next = updateArmy(log(next, pid, 'jogou um Cavaleiro'), pid)
      return next
    case 'estradas': {
      const can = Math.min(2, PIECES.estrada - countPieces(game, pid, 'estrada'))
      next = log(next, pid, 'jogou Construção de estradas')
      return can > 0 && legalRoads(next, pid).length ? { ...next, phase: 'estradas', freeRoads: can } : next
    }
    case 'fartura': {
      const picks = [action.res, action.res2].filter((r) => RES.includes(r))
      if (picks.length !== 2) throw new Error('Escolhe duas cartas.')
      const left = bank(game)
      const gain = emptyHand()
      for (const r of picks) if (left[r] - gain[r] > 0) gain[r]++
      return log({ ...next, hands: { ...next.hands, [pid]: addCards(next.hands[pid], gain) } }, pid, `jogou Ano de fartura (${picks.map((r) => RES_NAME[r]).join(' e ')})`)
    }
    case 'monopolio': {
      const r = action.res
      if (!RES.includes(r)) throw new Error('Escolhe um recurso.')
      let total = 0
      const hands = { ...next.hands }
      for (const id of game.order) {
        if (id === pid) continue
        total += hands[id][r]
        hands[id] = { ...hands[id], [r]: 0 }
      }
      hands[pid] = { ...hands[pid], [r]: hands[pid][r] + total }
      return log({ ...next, hands }, pid, `jogou Monopólio e levou ${total} de ${RES_NAME[r]}`)
    }
    default:
      throw new Error('Carta inválida.')
  }
}

function bankTrade(game, pid, give, get) {
  requireTurn(game, pid)
  if (game.phase !== 'main') throw new Error('Primeiro lança os dados.')
  if (!RES.includes(give) || !RES.includes(get) || give === get) throw new Error('Troca inválida.')
  const rate = portRates(game, pid)[give]
  if (game.hands[pid][give] < rate) throw new Error(`Precisas de ${rate} de ${RES_NAME[give]}.`)
  if (bank(game)[get] < 1) throw new Error('O banco não tem essa carta.')
  const next = { ...game, hands: { ...game.hands, [pid]: addCards(addCards(game.hands[pid], { [give]: rate }, -1), { [get]: 1 }) } }
  return log(next, pid, `trocou ${rate} ${RES_NAME[give]} por 1 ${RES_NAME[get]} com o banco`)
}

const cleanCards = (c) => Object.fromEntries(RES.map((r) => [r, Math.max(0, Math.floor(Number(c?.[r]) || 0))]))

function makeOffer(game, pid, give, want) {
  requireTurn(game, pid)
  if (game.phase !== 'main') throw new Error('Primeiro lança os dados.')
  const g = cleanCards(give)
  const w = cleanCards(want)
  if (!handSize(g) || !handSize(w)) throw new Error('Escolhe o que dás e o que queres.')
  if (RES.some((r) => g[r] && w[r])) throw new Error('Não podes dar e pedir o mesmo recurso.')
  if (!hasCards(game.hands[pid], g)) throw new Error('Não tens essas cartas.')
  return log({ ...game, offer: { from: pid, give: g, want: w, responses: {} } }, pid, 'propôs uma troca')
}

function respondOffer(game, pid, accept) {
  const o = game.offer
  if (!o || pid === o.from) throw new Error('Não há proposta para responder.')
  if (accept && !hasCards(game.hands[pid], o.want)) throw new Error('Não tens as cartas pedidas.')
  return { ...game, offer: { ...o, responses: { ...o.responses, [pid]: accept ? 'aceita' : 'recusa' } } }
}

function confirmTrade(game, pid, withId) {
  requireTurn(game, pid)
  const o = game.offer
  if (!o || o.from !== pid) throw new Error('Não há proposta.')
  if (o.responses[withId] !== 'aceita') throw new Error('Esse jogador não aceitou.')
  if (!hasCards(game.hands[pid], o.give) || !hasCards(game.hands[withId], o.want)) throw new Error('Já não há cartas para esta troca.')
  const hands = {
    ...game.hands,
    [pid]: addCards(addCards(game.hands[pid], o.give, -1), o.want),
    [withId]: addCards(addCards(game.hands[withId], o.want, -1), o.give),
  }
  return log({ ...game, hands, offer: null }, pid, `trocou cartas com @${withId}`)
}

function endTurn(game, pid) {
  requireTurn(game, pid)
  if (game.phase !== 'main') throw new Error(game.phase === 'roll' ? 'Primeiro lança os dados.' : 'Acaba primeiro a jogada.')
  return { ...game, turn: (game.turn + 1) % game.order.length, turnNo: game.turnNo + 1, phase: 'roll', dice: null, devPlayed: false, offer: null }
}

export function rematch(game) {
  if (!game.winner) return game
  const order = [...game.order.slice(1), game.order[0]]
  return { ...startGame(order), score: game.score, round: game.round + 1 }
}

export function applyAction(game, pid, action, rand = Math.random) {
  if (!game.order.includes(pid)) throw new Error('Não estás a jogar.')
  if (action.type === 'rematch') return rematch(game)
  if (game.winner) throw new Error('A partida já acabou.')
  if (action.type === 'discard') return discard(game, pid, action.cards)
  if (action.type === 'respond') return respondOffer(game, pid, !!action.accept)
  if (game.phase === 'setup') {
    requireTurn(game, pid)
    return setupPlace(game, pid, action)
  }
  let next
  switch (action.type) {
    case 'roll':
      next = roll(game, pid, rand)
      break
    case 'robber':
      next = moveRobber(game, pid, action.hex, action.victim, rand)
      break
    case 'build':
      next = build(game, pid, action.kind, action.at)
      break
    case 'buyDev':
      next = buyDev(game, pid)
      break
    case 'playDev':
      next = playDev(game, pid, action)
      break
    case 'bank':
      next = bankTrade(game, pid, action.give, action.get)
      break
    case 'offer':
      next = makeOffer(game, pid, action.give, action.want)
      break
    case 'cancelOffer':
      requireTurn(game, pid)
      next = { ...game, offer: null }
      break
    case 'confirmTrade':
      next = confirmTrade(game, pid, action.with)
      break
    case 'endTurn':
      next = endTurn(game, pid)
      break
    default:
      throw new Error('Ação desconhecida.')
  }
  return checkWin(next)
}

// Quem tem de fazer alguma coisa agora (para os bots e para o ecrã).
export function pendingActors(game) {
  if (game.winner) return []
  if (game.phase === 'discard') return Object.keys(game.discards)
  const cur = currentPlayer(game)
  if (game.offer) return [cur, ...game.order.filter((id) => id !== cur && !game.offer.responses[id])]
  return [cur]
}

export const colonosOnline = {
  minPlayers: 2,
  maxPlayers: 4,
  start(players) {
    return startGame(players.map((p) => p.id))
  },
  reduce(game, action, fromId) {
    return applyAction(game, fromId, action)
  },
}
