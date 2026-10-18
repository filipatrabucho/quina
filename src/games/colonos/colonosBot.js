// Bot simples para o Colonos: procura bons cruzamentos, constrói o que pode
// e guarda as cartas para cidades e aldeias.
import { HEXES, VERTICES, EDGES } from './board.js'
import {
  RES, COSTS, PIECES, PIPS, currentPlayer, handSize, legalSettlements, legalRoads, legalCities, robberVictims,
  portRates, bank, countPieces, points,
} from './colonosLogic.js'

const has = (hand, cost) => RES.every((r) => (hand[r] || 0) >= (cost[r] || 0))

function vertexValue(game, v, pid) {
  let value = 0
  const seen = new Set()
  for (const hi of VERTICES[v].hexes) {
    const t = game.board.tiles[hi]
    if (t.res === 'deserto') continue
    value += PIPS[t.num] || 0
    if (!seen.has(t.res)) value += 1.5
    seen.add(t.res)
    if (hi === game.board.robber) value -= 2
  }
  // Prefere recursos que ainda não tem.
  if (pid) {
    const owned = new Set()
    for (const [bv, b] of Object.entries(game.buildings)) if (b.owner === pid) for (const hi of VERTICES[bv].hexes) owned.add(game.board.tiles[hi].res)
    for (const r of seen) if (!owned.has(r)) value += 2
  }
  return value
}

const best = (list, score) => list.reduce((a, b) => (score(b) > score(a) ? b : a), list[0])

// Estrada que aproxima de um bom cruzamento livre.
function bestRoad(game, pid) {
  const roads = legalRoads(game, pid)
  if (!roads.length) return null
  const score = (e) => {
    const { a, b } = EDGES[e]
    let s = 0
    for (const v of [a, b]) {
      if (legalSettlements({ ...game, roads: { ...game.roads, [e]: pid } }, pid).includes(v)) s = Math.max(s, vertexValue(game, v, pid) + 3)
      for (const n of VERTICES[v].adj) if (!game.buildings[n] && VERTICES[n].adj.every((m) => !game.buildings[m])) s = Math.max(s, vertexValue(game, n, pid) * 0.6)
    }
    return s + Math.random() * 0.5
  }
  return best(roads, score)
}

function discardPlan(hand, n) {
  const h = { ...hand }
  const out = Object.fromEntries(RES.map((r) => [r, 0]))
  const keep = { minerio: 3, trigo: 2, madeira: 1, tijolo: 1, la: 1 }
  for (let k = 0; k < n; k++) {
    const r = RES.filter((x) => h[x] > 0).sort((a, b) => h[b] - keep[b] - (h[a] - keep[a]))[0]
    h[r]--
    out[r]++
  }
  return out
}

function leader(game, pid) {
  return game.order.filter((id) => id !== pid).sort((a, b) => points(game, b) - points(game, a))[0]
}

function robberMove(game, pid) {
  const lead = leader(game, pid)
  const options = HEXES.map((_, i) => i).filter((i) => i !== game.board.robber)
  const score = (hi) => {
    let s = 0
    for (const v of HEXES[hi].vertices) {
      const b = game.buildings[v]
      if (!b) continue
      const w = (b.kind === 'cidade' ? 2 : 1) * (PIPS[game.board.tiles[hi].num] || 0)
      s += b.owner === pid ? -3 * w : w * (b.owner === lead ? 1.5 : 1)
    }
    return s + Math.random() * 0.3
  }
  const hex = best(options, score)
  const victims = robberVictims(game, hex, pid)
  const victim = victims.sort((a, b) => points(game, b) - points(game, a))[0]
  return { type: 'robber', hex, victim }
}

// Uma ação do bot `pid` (ou null se não tiver nada para fazer).
export function botAction(game, pid) {
  if (game.winner) return null
  if (game.phase === 'discard') return game.discards[pid] ? { type: 'discard', cards: discardPlan(game.hands[pid], game.discards[pid]) } : null
  const cur = currentPlayer(game)
  if (game.offer && cur !== pid) {
    if (game.offer.responses[pid]) return null
    const hand = game.hands[pid]
    const ok = has(hand, game.offer.want) && handSize(game.offer.give) >= handSize(game.offer.want) && points(game, cur) < 8
    return { type: 'respond', accept: ok }
  }
  if (cur !== pid) return null
  const hand = game.hands[pid]

  if (game.phase === 'setup') {
    if (game.setup.expect === 'aldeia') return { type: 'build', kind: 'aldeia', at: best(legalSettlements(game, pid, true), (v) => vertexValue(game, v, pid) + Math.random() * 0.3) }
    const roads = legalRoads(game, pid, game.setup.vertex)
    const score = (e) => {
      const o = EDGES[e].a === game.setup.vertex ? EDGES[e].b : EDGES[e].a
      return Math.max(0, ...VERTICES[o].adj.filter((n) => n !== game.setup.vertex && !game.buildings[n]).map((n) => vertexValue(game, n, pid))) + Math.random() * 0.3
    }
    return { type: 'build', kind: 'estrada', at: best(roads, score) }
  }

  if (game.phase === 'robber') return robberMove(game, pid)
  if (game.phase === 'estradas') {
    const e = bestRoad(game, pid)
    return e == null ? null : { type: 'build', kind: 'estrada', at: e }
  }

  const playable = (type) => !game.devPlayed && game.devHands[pid].some((c) => c.type === type && c.turn < game.turnNo)
  const robberOnMe = HEXES[game.board.robber].vertices.some((v) => game.buildings[v]?.owner === pid)

  if (game.phase === 'roll') {
    if (playable('cavaleiro') && robberOnMe) return { type: 'playDev', card: 'cavaleiro' }
    return { type: 'roll' }
  }
  if (game.phase !== 'main') return null
  if (game.offer) return { type: game.order.some((id) => game.offer.responses[id] === 'aceita') ? 'confirmTrade' : 'cancelOffer', with: game.order.find((id) => game.offer.responses[id] === 'aceita') }

  if (playable('cavaleiro') && (robberOnMe || game.knights[pid] >= 2)) return { type: 'playDev', card: 'cavaleiro' }
  if (playable('monopolio')) {
    const totals = RES.map((r) => [r, game.order.filter((id) => id !== pid).reduce((a, id) => a + game.hands[id][r], 0)])
    const [r, n] = totals.sort((a, b) => b[1] - a[1])[0]
    if (n >= 3) return { type: 'playDev', card: 'monopolio', res: r }
  }
  if (playable('fartura')) {
    const need = RES.filter((r) => (COSTS.cidade[r] || 0) > hand[r] || (COSTS.aldeia[r] || 0) > hand[r])
    const left = bank(game)
    const pick = [...need, 'minerio', 'trigo'].filter((r) => left[r] > 0)
    if (pick.length) return { type: 'playDev', card: 'fartura', res: pick[0], res2: pick[1] || pick[0] }
  }
  if (playable('estradas') && legalRoads(game, pid).length && countPieces(game, pid, 'estrada') < PIECES.estrada - 1) return { type: 'playDev', card: 'estradas' }

  if (has(hand, COSTS.cidade) && countPieces(game, pid, 'cidade') < PIECES.cidade) {
    const cities = legalCities(game, pid)
    if (cities.length) return { type: 'build', kind: 'cidade', at: best(cities, (v) => vertexValue(game, v)) }
  }
  const spots = legalSettlements(game, pid)
  if (has(hand, COSTS.aldeia) && spots.length && countPieces(game, pid, 'aldeia') < PIECES.aldeia) {
    return { type: 'build', kind: 'aldeia', at: best(spots, (v) => vertexValue(game, v, pid)) }
  }
  if (has(hand, COSTS.estrada) && countPieces(game, pid, 'estrada') < PIECES.estrada && (spots.length === 0 || game.roadLengths[pid] < 6) && !has(hand, { ...COSTS.aldeia, madeira: 2, tijolo: 2 })) {
    const e = bestRoad(game, pid)
    if (e != null && (spots.length === 0 || Math.random() < 0.5)) return { type: 'build', kind: 'estrada', at: e }
  }
  if (has(hand, COSTS.desenvolvimento) && game.devDeck.length && !(spots.length && has(hand, { madeira: 1, tijolo: 1 }))) {
    return { type: 'buyDev' }
  }
  // Troca com o banco o que tem a mais pelo que falta.
  const rates = portRates(game, pid)
  const target = !legalCities(game, pid).length || hand.trigo + hand.minerio < 3 ? COSTS.aldeia : COSTS.cidade
  const missing = RES.find((r) => (target[r] || 0) > hand[r])
  if (missing && bank(game)[missing] > 0) {
    const spare = RES.find((r) => r !== missing && hand[r] - (target[r] || 0) >= rates[r])
    if (spare) return { type: 'bank', give: spare, get: missing }
  }
  return { type: 'endTurn' }
}
