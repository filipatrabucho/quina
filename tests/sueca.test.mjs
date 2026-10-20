import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSuecaDeck, startGame, applyAction, tick, legalCards, trickWinner, botCard, cardValue, teamOf, suecaOnline, BOT_DELAY_MS, TRICK_MS } from '../src/games/sueca/suecaLogic.js'

test('baralho de 40 cartas e 120 pontos', () => {
  const d = buildSuecaDeck()
  assert.equal(d.length, 40)
  assert.ok(!d.some((c) => ['8', '9', '10'].includes(c.rank)))
  assert.equal(d.reduce((s, c) => s + cardValue(c), 0), 120)
})

test('dar: 10 cartas a cada um e o trunfo é de quem baralha', () => {
  const g = startGame(['a', 'b', 'c', 'd'], [], 0)
  for (const id of g.order) assert.equal(g.hands[id].length, 10)
  assert.ok(g.hands[g.dealer].some((c) => c.id === g.trump.card.id))
  assert.equal(g.turn, g.order[(g.order.indexOf(g.dealer) + 1) % 4], 'começa quem está a seguir a quem baralha')
})

test('vencedor da vaza: trunfo ganha; sem trunfo, a mais alta do naipe', () => {
  const t = (cards) => cards.map(([rank, suit], i) => ({ id: `p${i}`, card: { rank, suit } }))
  assert.equal(trickWinner(t([['K', 'h'], ['A', 'h'], ['7', 'h'], ['2', 'h']]), 's'), 1)
  assert.equal(trickWinner(t([['K', 'h'], ['7', 'h'], ['Q', 'h'], ['J', 'h']]), 's'), 1, 'o 7 é a segunda mais forte')
  assert.equal(trickWinner(t([['A', 'h'], ['2', 's'], ['A', 'd'], ['3', 's']]), 's'), 3)
  assert.equal(trickWinner(t([['5', 'h'], ['A', 'd'], ['6', 'h'], ['K', 'c']]), 's'), 2, 'outros naipes não ganham')
})

test('é obrigatório assistir', () => {
  let g = startGame(['a', 'b', 'c', 'd'], [], 0)
  const first = g.turn
  const card = g.hands[first][0]
  g = applyAction(g, first, { type: 'play', card: card.id }, 0)
  const second = g.turn
  const follow = g.hands[second].filter((c) => c.suit === card.suit)
  const other = g.hands[second].find((c) => c.suit !== card.suit)
  if (follow.length && other) assert.throws(() => applyAction(g, second, { type: 'play', card: other.id }, 0), /assistir/)
  assert.ok(legalCards(g, second).every((c) => !follow.length || c.suit === card.suit))
})

test('partidas só com bots acabam a 4 jogos e os pontos de cada mão somam 120', () => {
  for (let k = 0; k < 3; k++) {
    const ids = ['b0', 'b1', 'b2', 'b3']
    let g = startGame(ids, ids, 0)
    let t = 0
    let steps = 0
    while (g.phase !== 'over' && steps++ < 5000) {
      if (g.phase === 'end') assert.equal(g.result.points[0] + g.result.points[1], 120)
      t = g.deadline + 1
      g = tick(g, t)
    }
    assert.equal(g.phase, 'over')
    assert.ok(g.games[g.winner] >= 4)
  }
})

test('bots jogam sempre cartas legais e a pessoa sem tempo (contra bots) não perde a vez', () => {
  let g = startGame(['h', 'bot0', 'bot1', 'bot2'], ['bot0', 'bot1', 'bot2'], 0, Math.random, { timed: false })
  let t = 0
  for (let k = 0; k < 400 && g.phase !== 'over'; k++) {
    if (g.phase === 'play' && g.turn === 'h') {
      assert.equal(g.deadline, null)
      g = applyAction(g, 'h', { type: 'play', card: botCard(g, 'h').id }, t)
      continue
    }
    if (g.phase === 'end') {
      g = applyAction(g, 'h', { type: 'next' }, t)
      continue
    }
    t = g.deadline + 1
    if (g.phase === 'play') assert.ok(legalCards(g, g.turn).some((c) => c.id === botCard(g, g.turn).id))
    g = tick(g, t)
  }
  assert.ok(BOT_DELAY_MS < TRICK_MS * 2)
})

test('online: completa com bots e junta 2 pessoas na mesma equipa', () => {
  const g = suecaOnline.start([{ id: 'a' }, { id: 'b' }], {}, 0)
  assert.equal(g.order.length, 4)
  assert.equal(teamOf(g, 'a'), teamOf(g, 'b'))
  const h = suecaOnline.start([{ id: 'a' }, { id: 'b' }], { together: false }, 0)
  assert.notEqual(teamOf(h, 'a'), teamOf(h, 'b'))
})
