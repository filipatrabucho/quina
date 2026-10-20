import test from 'node:test'
import assert from 'node:assert/strict'
import { bestHand, compareScores, handName } from '../src/games/poker/pokerHands.js'
import { startGame, applyAction, legalActions, buildPots, tick, botDecision, isBot, START_CHIPS, BOT_DELAY_MS } from '../src/games/poker/pokerLogic.js'

let n = 0
const C = (s) => s.split(' ').map((t) => ({ id: n++, rank: t.slice(0, -1), suit: t.slice(-1) }))
const score = (s) => bestHand(C(s)).score

test('mãos: categorias e desempates', () => {
  assert.equal(handName(score('As Ks Qs Js 10s 2d 3c')), 'Sequência de cor real')
  assert.equal(handName(score('9h 9d 9s 9c Kd 2h 3h')), 'Póquer de noves')
  assert.equal(handName(score('Kh Kd Ks 4c 4d 2h 7s')), 'Full house, reis e quatros')
  assert.equal(handName(score('2h 7h 9h Jh Kh As 3d')), 'Cor')
  assert.equal(handName(score('Ah 2d 3s 4c 5h Kd Qd')), 'Sequência')
  assert.equal(handName(score('Ah Ad 3s 3c 9h Kd Qd')), 'Dois pares, ases e três')
  assert.ok(compareScores(score('Ah Kd 9s 7c 4h 3d 2c'), score('Ah Qd 9s 7c 4h 3d 2c')) > 0, 'carta alta: o K desempata')
  assert.ok(compareScores(score('5h 4d 3s 2c Ah Kd Qd'), score('6h 5d 4s 3c 2h Kd Jd')) < 0, 'roda (A-5) perde para 6 alto')
  assert.equal(compareScores(score('Ah Kd Qs Jc 10h 2d 3c'), score('Ad Kh Qc Js 10d 4d 5c')), 0, 'mesma sequência = empate')
})

// Mesa de testes com cartas e posições conhecidas.
function table(ids, chips) {
  let g = startGame(ids, [], 0, () => 0)
  if (chips) g = { ...g, chips: { ...g.chips, ...chips } }
  return g
}

test('blinds, vez de jogar e uma mão até ao fim por desistência', () => {
  const g0 = startGame(['a', 'b', 'c'], [], 0, () => 0)
  assert.equal(g0.phase, 'preflop')
  const sum = Object.values(g0.chips).reduce((x, y) => x + y, 0) + Object.values(g0.contrib).reduce((x, y) => x + y, 0)
  assert.equal(sum, START_CHIPS * 3, 'as fichas não se perdem')
  assert.equal(g0.contrib[g0.sb], 10)
  assert.equal(g0.contrib[g0.bb], 20)
  let g = g0
  const first = g.toAct
  assert.notEqual(first, g.bb)
  assert.throws(() => applyAction(g, g.bb, { type: 'check' }), /vez/)
  // dois desistem: o big blind ganha
  g = applyAction(g, g.toAct, { type: 'fold' })
  g = applyAction(g, g.toAct, { type: 'fold' })
  assert.equal(g.phase, 'showdown')
  assert.equal(g.result.kind, 'fold')
  assert.deepEqual(g.result.winners[0].ids, [g0.bb])
  assert.equal(g.chips[g0.bb], START_CHIPS + 10)
})

test('todos pagam e passam até ao showdown; as fichas batem certo', () => {
  let g = startGame(['a', 'b', 'c', 'd'], [], 0)
  let guard = 0
  while (g.phase !== 'showdown' && guard++ < 50) {
    const o = legalActions(g, g.toAct)
    g = applyAction(g, g.toAct, { type: o.canCheck ? 'check' : 'call' })
  }
  assert.equal(g.phase, 'showdown')
  assert.equal(g.board.length, 5)
  assert.equal(g.result.kind, 'showdown')
  const total = Object.values(g.chips).reduce((x, y) => x + y, 0)
  assert.equal(total, START_CHIPS * 4)
})

test('aumentar obriga os outros a responder e respeita o mínimo', () => {
  let g = startGame(['a', 'b', 'c'], [], 0)
  const p = g.toAct
  assert.throws(() => applyAction(g, p, { type: 'raise', to: 30 }), /mínimo é 40/)
  g = applyAction(g, p, { type: 'raise', to: 60 })
  assert.equal(g.currentBet, 60)
  assert.notEqual(g.toAct, p)
  assert.equal(legalActions(g, g.toAct).call, 60 - (g.bets[g.toAct] || 0))
})

test('potes laterais: quem fez all-in só ganha o que pôde cobrir', () => {
  const g = {
    order: ['a', 'b', 'c'],
    holes: { a: [1], b: [1], c: [1] },
    folded: {},
    contrib: { a: 100, b: 300, c: 300 },
  }
  const pots = buildPots(g)
  assert.deepEqual(pots.map((p) => p.amount), [300, 400])
  assert.deepEqual(pots[0].eligible, ['a', 'b', 'c'])
  assert.deepEqual(pots[1].eligible, ['b', 'c'])
  const withFold = buildPots({ ...g, folded: { c: true }, contrib: { a: 100, b: 300, c: 500 } })
  assert.equal(withFold.reduce((x, p) => x + p.amount, 0), 900, 'as fichas de quem desistiu ficam no pote')
})

test('all-in e mostrar as cartas até ao fim', () => {
  let g = startGame(['a', 'b'], [], 0)
  g = applyAction(g, g.toAct, { type: 'raise', to: START_CHIPS })
  g = applyAction(g, g.toAct, { type: 'call' })
  assert.equal(g.board.length, 5, 'mostra o board todo')
  assert.ok(g.phase === 'showdown' || g.phase === 'over')
  const total = Object.values(g.chips).reduce((x, y) => x + y, 0)
  assert.equal(total, START_CHIPS * 2)
})

test('torneios só com bots acabam com um vencedor', () => {
  for (let k = 0; k < 2; k++) {
    const ids = ['b0', 'b1', 'b2', 'b3']
    let g = startGame(ids, ids, 0)
    let t = 0
    let steps = 0
    while (g.phase !== 'over' && steps++ < 20000) {
      t += BOT_DELAY_MS + 10
      if (g.phase === 'showdown') t = g.deadline + 1
      g = tick(g, t)
    }
    assert.equal(g.phase, 'over', 'o torneio acaba')
    assert.equal(g.chips[g.winner], START_CHIPS * 4)
  }
})

test('bot nunca faz uma jogada ilegal', () => {
  let g = startGame(['h', 'b0', 'b1'], ['b0', 'b1'], 0)
  for (let k = 0; k < 300 && g.phase !== 'over'; k++) {
    if (g.phase === 'showdown') { g = applyAction(g, 'h', { type: 'next' }); continue }
    const id = g.toAct
    const d = isBot(g, id) ? botDecision(g, id) : { type: legalActions(g, id).canCheck ? 'check' : 'call' }
    g = applyAction(g, id, d)
  }
  assert.ok(true)
})
