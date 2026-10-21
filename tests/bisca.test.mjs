import test from 'node:test'
import assert from 'node:assert/strict'
import { startGame, applyAction, tick, legalCards, canSwap, botCard, teamOf, biscaOnline, handPoints } from '../src/games/bisca/biscaLogic.js'

test('dar: 3 cartas a cada um, o trunfo fica virado no fundo do monte', () => {
  for (const n of [2, 4]) {
    const ids = n === 2 ? ['a', 'b'] : ['a', 'b', 'c', 'd']
    const g = startGame(ids, [], 0)
    for (const id of ids) assert.equal(g.hands[id].length, 3)
    assert.equal(g.stock.length, 40 - 3 * n)
    assert.equal(g.stock[0].id, g.trump.card.id)
  }
})

test('com monte joga-se qualquer carta; quem ganha compra primeiro', () => {
  let g = startGame(['a', 'b'], [], 0)
  const first = g.turn
  g = applyAction(g, first, { type: 'play', card: g.hands[first][0].id }, 0)
  const second = g.turn
  assert.equal(legalCards(g, second).length, 3, 'sem obrigação de assistir enquanto há monte')
  g = applyAction(g, second, { type: 'play', card: g.hands[second][0].id }, 0)
  assert.equal(g.phase, 'trick')
  const before = g.stock.length
  g = tick(g, g.deadline + 1)
  assert.equal(g.stock.length, before - 2)
  assert.equal(g.hands.a.length, 3)
  assert.equal(g.hands.b.length, 3)
})

test('trocar o 2 de trunfo pela carta virada', () => {
  let g = startGame(['a', 'b'], [], 0)
  const id = g.turn
  // põe o 2 de trunfo na mão de quem joga
  const all = [...g.stock, ...g.hands.a, ...g.hands.b]
  const two = all.find((c) => c.suit === g.trump.suit && c.rank === '2')
  if (two.id === g.trump.card.id) return // o 2 é a carta virada: não há troca
  const other = g.hands[id][0]
  const where = g.stock.findIndex((c) => c.id === two.id)
  if (where >= 0) g.stock[where] = other
  else {
    const o = id === 'a' ? 'b' : 'a'
    g.hands[o] = g.hands[o].map((c) => (c.id === two.id ? other : c))
  }
  g.hands[id] = [two, ...g.hands[id].slice(1)]
  assert.ok(canSwap(g, id))
  const virada = g.trump.card
  g = applyAction(g, id, { type: 'swap' }, 0)
  assert.ok(g.hands[id].some((c) => c.id === virada.id))
  assert.equal(g.stock[0].id, two.id)
  assert.equal(g.trump.card.id, two.id)
  assert.ok(!canSwap(g, id))
})

test('partidas com bots (a 2 e a 4) acabam e cada mão soma 120', () => {
  for (const ids of [['b0', 'b1'], ['b0', 'b1', 'b2', 'b3']]) {
    for (let k = 0; k < 3; k++) {
      let g = startGame(ids, ids, 0)
      let t = 0
      let steps = 0
      while (g.phase !== 'over' && steps++ < 8000) {
        if (g.phase === 'end') assert.equal(g.result.points[0] + g.result.points[1], 120)
        if (g.phase === 'play') assert.ok(legalCards(g, g.turn).some((c) => c.id === botCard(g, g.turn).id))
        t = g.deadline + 1
        g = tick(g, t)
      }
      assert.equal(g.phase, 'over')
    }
  }
})

test('sem monte é obrigatório assistir', () => {
  let g = startGame(['a', 'b'], ['a', 'b'], 0)
  let t = 0
  while (g.stock.length || g.phase !== 'play' || !g.trick.length) {
    t = g.deadline + 1
    g = tick(g, t)
  }
  const id = g.turn
  const lead = g.trick[0].card.suit
  const has = g.hands[id].some((c) => c.suit === lead)
  if (has) assert.ok(legalCards(g, id).every((c) => c.suit === lead))
  assert.ok(handPoints(g)[0] + handPoints(g)[1] <= 120)
})

test('online: 1 contra 1 ou equipas com bots', () => {
  const a = biscaOnline.start([{ id: 'x' }], {}, 0)
  assert.equal(a.order.length, 2)
  const b = biscaOnline.start([{ id: 'x' }, { id: 'y' }], { seats: 4 }, 0)
  assert.equal(b.order.length, 4)
  assert.equal(teamOf(b, 'x'), teamOf(b, 'y'))
  const c = biscaOnline.start([{ id: 'x' }, { id: 'y' }, { id: 'z' }], {}, 0)
  assert.equal(c.order.length, 4)
})
