import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSet, startGame, applyAction, tick, legalMoves, autoMove, ends, handPips, sideOf, dominoOnline } from '../src/games/domino/dominoLogic.js'

test('28 pedras, 7 a cada um; a 4 não há pedras para comprar', () => {
  assert.equal(buildSet().length, 28)
  const g2 = startGame(['a', 'b'], [], 0)
  assert.equal(g2.hands.a.length, 7)
  assert.equal(g2.boneyard.length, 14)
  const g4 = startGame(['a', 'b', 'c', 'd'], [], 0)
  assert.equal(g4.boneyard.length, 0)
  assert.equal(g4.scores.length, 2, 'a 4 são duas equipas')
  // 1.ª mão: quem tem o duplo seis começa e tem de o jogar
  assert.ok(g4.hands[g4.turn].some((t) => t.id === '6-6'))
  assert.deepEqual(legalMoves(g4, g4.turn), [{ tile: '6-6', side: 'R' }])
})

test('as pedras encaixam pelos números e as pontas mudam', () => {
  let g = startGame(['a', 'b', 'c', 'd'], [], 0)
  g = applyAction(g, g.turn, { type: 'play', tile: '6-6', side: 'R' }, 0)
  assert.deepEqual(ends(g), [6, 6])
  const id = g.turn
  const fits = g.hands[id].filter((t) => t.a === 6 || t.b === 6)
  const nope = g.hands[id].find((t) => t.a !== 6 && t.b !== 6)
  if (nope) assert.throws(() => applyAction(g, id, { type: 'play', tile: nope.id, side: 'R' }, 0), /encaixa|passar/)
  if (fits.length) {
    const t = fits[0]
    g = applyAction(g, id, { type: 'play', tile: t.id, side: 'L' }, 0)
    const other = t.a === 6 ? t.b : t.a
    assert.equal(ends(g)[0], other)
    assert.equal(g.chain[0].r, 6)
  }
})

test('comprar e passar só quando não há jogada', () => {
  const g = startGame(['a', 'b'], [], 0)
  const id = g.turn
  assert.throws(() => applyAction(g, id, { type: 'draw' }, 0), /Tens pedras/)
})

test('partidas só com bots acabam (a 2, 3 e 4) e os pontos fazem sentido', () => {
  for (const ids of [['b0', 'b1'], ['b0', 'b1', 'b2'], ['b0', 'b1', 'b2', 'b3']]) {
    for (let k = 0; k < 3; k++) {
      let g = startGame(ids, ids, 0)
      let t = 0
      let steps = 0
      while (g.phase !== 'over' && steps++ < 20000) {
        if (g.phase === 'end' && g.result.side != null) assert.ok(g.result.points >= 0)
        t = g.deadline + 1
        g = tick(g, t)
      }
      assert.equal(g.phase, 'over')
      assert.ok(Math.max(...g.scores) >= 100)
      // nenhuma pedra se perdeu
      const inPlay = Object.values(g.hands).flat().length + g.boneyard.length + g.chain.length
      assert.equal(inPlay, 28)
    }
  }
})

test('jogada automática é sempre válida', () => {
  let g = startGame(['h', 'b0'], ['b0'], 0, Math.random, { timed: false })
  for (let k = 0; k < 200 && g.phase !== 'over'; k++) {
    if (g.phase === 'end') { g = applyAction(g, 'h', { type: 'next' }, 0); continue }
    const m = autoMove(g, g.turn)
    g = applyAction(g, g.turn, m, 0)
  }
  assert.ok(true)
})

test('online: completa com bots e junta 2 pessoas na mesma equipa a 4', () => {
  const g = dominoOnline.start([{ id: 'x' }, { id: 'y' }], { seats: 4 }, 0)
  assert.equal(g.order.length, 4)
  assert.equal(sideOf(g, 'x'), sideOf(g, 'y'))
  const h = dominoOnline.start([{ id: 'x' }], {}, 0)
  assert.equal(h.order.length, 2)
  assert.ok(handPips(h.hands.x) >= 0)
})
