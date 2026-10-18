// Regras do Colonos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as L from '../src/games/colonos/colonosLogic.js'
import { botAction } from '../src/games/colonos/colonosBot.js'
import { HEXES, VERTICES, EDGES, hexNeighbors, edgeBetween } from '../src/games/colonos/board.js'

const fixedRoll = (a, b) => {
  const vals = [(a - 1) / 6 + 0.01, (b - 1) / 6 + 0.01]
  let i = 0
  return () => vals[i++ % 2]
}
const hand = (o = {}) => ({ madeira: 0, tijolo: 0, la: 0, trigo: 0, minerio: 0, ...o })

// Põe o jogo logo na fase principal com aldeias escolhidas à mão.
function quickGame(ids = ['a', 'b', 'c']) {
  let g = L.startGame(ids)
  while (g.phase === 'setup') {
    const p = L.currentPlayer(g)
    g = L.applyAction(g, p, botAction(g, p))
  }
  return g
}

test('colonos: tabuleiro com 19 terrenos, 54 cruzamentos, 72 caminhos e 9 portos', () => {
  for (let k = 0; k < 50; k++) {
    const b = L.makeBoard()
    assert.equal(b.tiles.length, 19)
    assert.equal(b.tiles.filter((t) => t.res === 'deserto').length, 1)
    assert.equal(b.tiles[b.robber].res, 'deserto')
    assert.deepEqual(b.tiles.filter((t) => t.num).map((t) => t.num).sort((x, y) => x - y), [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12])
    const hot = (i) => b.tiles[i].num === 6 || b.tiles[i].num === 8
    assert.ok(!b.tiles.some((_, i) => hot(i) && hexNeighbors(i).some(hot)), '6 e 8 não ficam lado a lado')
    assert.equal(b.ports.length, 9)
    assert.equal(b.ports.filter((p) => p.type === '3:1').length, 4)
  }
  assert.equal(HEXES.length, 19)
  assert.equal(VERTICES.length, 54)
  assert.equal(EDGES.length, 72)
})

test('colonos: preparação em serpente, regra da distância e recursos da 2ª aldeia', () => {
  let g = L.startGame(['a', 'b', 'c'])
  assert.deepEqual(L.setupOrder(g), ['a', 'b', 'c', 'c', 'b', 'a'])
  const v = 10
  g = L.applyAction(g, 'a', { type: 'build', kind: 'aldeia', at: v })
  assert.throws(() => L.applyAction(g, 'a', { type: 'build', kind: 'aldeia', at: 11 }), /estrada/)
  const far = EDGES.findIndex((e) => e.a !== v && e.b !== v)
  assert.throws(() => L.applyAction(g, 'a', { type: 'build', kind: 'estrada', at: far }), /sair da aldeia/)
  g = L.applyAction(g, 'a', { type: 'build', kind: 'estrada', at: VERTICES[v].edges[0] })
  assert.equal(L.currentPlayer(g), 'b')
  assert.throws(() => L.applyAction(g, 'b', { type: 'build', kind: 'aldeia', at: VERTICES[v].adj[0] }), /cruzamento livre/)
  while (g.phase === 'setup') {
    const p = L.currentPlayer(g)
    const before = L.handSize(g.hands[p])
    const second = g.setup.i >= 3 && g.setup.expect === 'aldeia'
    const act = botAction(g, p)
    g = L.applyAction(g, p, act)
    if (second) {
      const expected = VERTICES[act.at].hexes.filter((hi) => g.board.tiles[hi].res !== 'deserto').length
      assert.equal(L.handSize(g.hands[p]) - before, expected)
    }
  }
  assert.equal(g.phase, 'roll')
  assert.equal(L.currentPlayer(g), 'a')
  for (const id of ['a', 'b', 'c']) {
    assert.equal(L.countPieces(g, id, 'aldeia'), 2)
    assert.equal(L.countPieces(g, id, 'estrada'), 2)
  }
})

test('colonos: dados produzem recursos e o ladrão bloqueia', () => {
  let g = quickGame()
  g = { ...g, hands: { a: hand(), b: hand(), c: hand() } }
  const [vStr, b] = Object.entries(g.buildings).find(([, x]) => x.owner === 'a')
  const v = Number(vStr)
  const hi = VERTICES[v].hexes.find((h) => g.board.tiles[h].num && g.board.tiles[h].num !== 7)
  const { res, num } = g.board.tiles[hi]
  const dice = num <= 7 ? [1, num - 1] : [6, num - 6]
  const rolled = L.applyAction({ ...g, board: { ...g.board, robber: g.board.tiles.findIndex((t) => t.res === 'deserto') } }, 'a', { type: 'roll' }, fixedRoll(...dice))
  assert.equal(rolled.dice[0] + rolled.dice[1], num)
  assert.ok(rolled.hands.a[res] >= 1, 'recebe recurso')
  assert.equal(b.kind, 'aldeia')
  const blocked = L.applyAction({ ...g, board: { ...g.board, robber: hi } }, 'a', { type: 'roll' }, fixedRoll(...dice))
  // Com o ladrão em cima, esse terreno não dá nada ao jogador nesse cruzamento
  const fromOthers = VERTICES[v].hexes.filter((h) => h !== hi && g.board.tiles[h].num === num && g.board.tiles[h].res === res).length
  assert.equal(blocked.hands.a[res], fromOthers > 0 ? blocked.hands.a[res] : 0)
})

test('colonos: 7 obriga a descartar metade e o ladrão rouba uma carta', () => {
  let g = quickGame()
  g = { ...g, hands: { a: hand({ madeira: 2 }), b: hand({ trigo: 9 }), c: hand({ la: 3 }) } }
  g = L.applyAction(g, 'a', { type: 'roll' }, fixedRoll(3, 4))
  assert.equal(g.phase, 'discard')
  assert.deepEqual(g.discards, { b: 4 })
  assert.throws(() => L.applyAction(g, 'a', { type: 'robber', hex: 0 }), /mover o ladrão/)
  assert.throws(() => L.applyAction(g, 'b', { type: 'discard', cards: { trigo: 3 } }), /4/)
  g = L.applyAction(g, 'b', { type: 'discard', cards: { trigo: 4 } })
  assert.equal(g.phase, 'robber')
  assert.equal(g.hands.b.trigo, 5)
  assert.throws(() => L.applyAction(g, 'a', { type: 'robber', hex: g.board.robber }), /outro terreno/)
  const target = HEXES.findIndex((h, i) => i !== g.board.robber && L.robberVictims(g, i, 'a').includes('b'))
  if (target >= 0) {
    const before = L.handSize(g.hands.b)
    assert.throws(() => L.applyAction(g, 'a', { type: 'robber', hex: target }), /roubar/)
    const after = L.applyAction(g, 'a', { type: 'robber', hex: target, victim: 'b' })
    assert.equal(L.handSize(after.hands.b), before - 1)
    assert.equal(L.handSize(after.hands.a), 3)
    assert.equal(after.phase, 'main')
  }
})

test('colonos: custos, estradas ligadas, aldeias, cidades e limites do banco', () => {
  let g = quickGame()
  g = { ...g, phase: 'main', hands: { ...g.hands, a: hand({ madeira: 5, tijolo: 5, la: 2, trigo: 4, minerio: 3 }) } }
  const far = EDGES.findIndex((e, i) => !L.canPlaceRoad(g, 'a', i) && !g.roads[i])
  assert.throws(() => L.applyAction(g, 'a', { type: 'build', kind: 'estrada', at: far }), /ligar/)
  const road = L.legalRoads(g, 'a')[0]
  g = L.applyAction(g, 'a', { type: 'build', kind: 'estrada', at: road })
  assert.equal(g.hands.a.madeira, 4)
  const city = L.legalCities(g, 'a')[0]
  g = L.applyAction(g, 'a', { type: 'build', kind: 'cidade', at: city })
  assert.equal(g.buildings[city].kind, 'cidade')
  assert.equal(g.hands.a.minerio, 0)
  assert.equal(L.points(g, 'a'), 3)
  assert.throws(() => L.applyAction(g, 'a', { type: 'build', kind: 'cidade', at: L.legalCities(g, 'a')[0] }), /suficientes/)
  // banco: 19 de cada no total
  const b = L.bank(g)
  for (const r of L.RES) assert.equal(b[r] + ['a', 'b', 'c'].reduce((s, id) => s + g.hands[id][r], 0), 19)
})

test('colonos: estrada mais longa (5+) e cortada por aldeia de outro', () => {
  let g = L.startGame(['a', 'b'])
  // Caminho de 6 arestas ao longo de uma linha de vértices
  const path = [0]
  while (path.length < 7) {
    const last = path[path.length - 1]
    const next = VERTICES[last].adj.find((n) => !path.includes(n) && VERTICES[n].adj.length >= 2 && !path.some((p) => VERTICES[p].adj.includes(n) && p !== last))
    path.push(next)
  }
  const roads = {}
  for (let i = 0; i < 6; i++) roads[edgeBetween(path[i], path[i + 1])] = 'a'
  g = { ...g, phase: 'main', setup: { i: 4 }, roads, buildings: { [path[0]]: { owner: 'a', kind: 'aldeia' } } }
  assert.equal(L.longestRoad(g, 'a'), 6)
  // b constrói uma aldeia no meio: a estrada parte-se em 3 + 3
  const cut = { ...g, buildings: { ...g.buildings, [path[3]]: { owner: 'b', kind: 'aldeia' } } }
  assert.equal(L.longestRoad(cut, 'a'), 3)
})

test('colonos: cartas de desenvolvimento e maior exército', () => {
  let g = quickGame(['a', 'b'])
  g = { ...g, phase: 'main', hands: { ...g.hands, a: hand({ la: 3, trigo: 3, minerio: 3 }) }, devDeck: [{ id: 90, type: 'cavaleiro' }, { id: 91, type: 'cavaleiro' }, { id: 92, type: 'cavaleiro' }] }
  g = L.applyAction(g, 'a', { type: 'buyDev' })
  assert.throws(() => L.applyAction(g, 'a', { type: 'playDev', card: 'cavaleiro' }), /comprada/)
  g = L.applyAction(g, 'a', { type: 'buyDev' })
  g = L.applyAction(g, 'a', { type: 'buyDev' })
  // passa a vez duas vezes e joga um cavaleiro por vez
  for (let k = 0; k < 3; k++) {
    g = L.applyAction(g, 'a', { type: 'endTurn' })
    g = { ...g, phase: 'main' }
    g = L.applyAction(g, 'b', { type: 'endTurn' })
    g = L.applyAction(g, 'a', { type: 'playDev', card: 'cavaleiro' })
    assert.equal(g.phase, 'robber')
    assert.throws(() => L.applyAction(g, 'a', { type: 'playDev', card: 'cavaleiro' }), /Agora não podes|uma carta/)
    const hex = HEXES.findIndex((_, i) => i !== g.board.robber && L.robberVictims(g, i, 'a').length === 0)
    g = L.applyAction(g, 'a', { type: 'robber', hex })
    assert.equal(g.phase, 'roll', 'cavaleiro antes dos dados volta a lançar')
    g = L.applyAction(g, 'a', { type: 'roll' }, fixedRoll(2, 2))
  }
  assert.equal(g.knights.a, 3)
  assert.equal(g.awards.exercito, 'a')
})

test('colonos: trocas com o banco e entre jogadores', () => {
  let g = quickGame(['a', 'b'])
  g = { ...g, phase: 'main', hands: { a: hand({ madeira: 4, trigo: 1 }), b: hand({ minerio: 2 }) } }
  const rates = L.portRates(g, 'a')
  if (rates.madeira === 4) {
    g = L.applyAction(g, 'a', { type: 'bank', give: 'madeira', get: 'la' })
    assert.equal(g.hands.a.madeira, 0)
    assert.equal(g.hands.a.la, 1)
  }
  assert.throws(() => L.applyAction(g, 'b', { type: 'offer', give: { minerio: 1 }, want: { trigo: 1 } }), /vez/)
  g = L.applyAction(g, 'a', { type: 'offer', give: { trigo: 1 }, want: { minerio: 2 } })
  assert.throws(() => L.applyAction(g, 'a', { type: 'confirmTrade', with: 'b' }), /aceitou/)
  g = L.applyAction(g, 'b', { type: 'respond', accept: true })
  g = L.applyAction(g, 'a', { type: 'confirmTrade', with: 'b' })
  assert.equal(g.hands.a.minerio, 2)
  assert.equal(g.hands.b.trigo, 1)
  assert.equal(g.offer, null)
})

test('colonos: partidas inteiras entre bots acabam com alguém nos 10 pontos', () => {
  for (let k = 0; k < 15; k++) {
    let g = L.startGame(['a', 'b', 'c', 'd'])
    let n = 0
    while (!g.winner && n++ < 20000) {
      const id = L.pendingActors(g).find((p) => botAction(g, p))
      g = L.applyAction(g, id, botAction(g, id))
      const b = L.bank(g)
      assert.ok(L.RES.every((r) => b[r] >= 0), 'o banco nunca fica negativo')
    }
    assert.ok(g.winner)
    assert.ok(L.points(g, g.winner, true) >= 10)
    for (const id of g.order) {
      assert.ok(L.countPieces(g, id, 'aldeia') <= 5 && L.countPieces(g, id, 'cidade') <= 4 && L.countPieces(g, id, 'estrada') <= 15)
    }
  }
})
