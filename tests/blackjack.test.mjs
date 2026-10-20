import test from 'node:test'
import assert from 'node:assert/strict'
import { handValue, startGame, applyAction, tick, isBot, blackjackOnline, START_CHIPS, BET_MS, TURN_MS, BOT_DELAY_MS } from '../src/games/blackjack/blackjackLogic.js'

const c = (rank, suit = 's') => ({ id: Math.random(), rank, suit })
// Prepara o sapato para sair por esta ordem (pop tira do fim).
const stack = (g, cards) => ({ ...g, shoe: [...Array(200).fill(c('2', 'c')), ...cards.slice().reverse()] })

test('valor da mão: ases contam 11 ou 1', () => {
  assert.deepEqual(handValue([c('A'), c('K')]), { total: 21, soft: true })
  assert.deepEqual(handValue([c('A'), c('A'), c('9')]), { total: 21, soft: true })
  assert.deepEqual(handValue([c('A'), c('9'), c('5')]), { total: 15, soft: false })
  assert.equal(handValue([c('K'), c('Q'), c('5')]).total, 25)
})

test('mão normal: pedir, ficar, a banca pede até 17 e paga 1:1', () => {
  // ordem de distribuição: jogador, banca, jogador, banca, depois cartas a pedir
  let g = stack(startGame(['a']), [c('10'), c('9'), c('5'), c('7'), c('4'), c('2')])
  g = applyAction(g, 'a', { type: 'bet', amount: 100 })
  assert.equal(g.phase, 'play')
  assert.equal(g.chips.a, START_CHIPS - 100)
  g = applyAction(g, 'a', { type: 'hit' }) // 10+5+4 = 19
  g = applyAction(g, 'a', { type: 'stand' })
  assert.equal(g.phase, 'done')
  assert.equal(handValue(g.dealer).total, 18) // 9+7+2
  assert.equal(g.results.a.outcomes[0].outcome, 'ganhou')
  assert.equal(g.chips.a, START_CHIPS + 100)
})

test('Blackjack paga 3:2 e a banca com Blackjack ganha logo', () => {
  let g = stack(startGame(['a']), [c('A'), c('9'), c('K'), c('7')])
  g = applyAction(g, 'a', { type: 'bet', amount: 100 })
  assert.equal(g.phase, 'done')
  assert.equal(g.results.a.outcomes[0].outcome, 'blackjack')
  assert.equal(g.chips.a, START_CHIPS + 150)
  let h = stack(startGame(['a']), [c('10'), c('A'), c('9'), c('K')])
  h = applyAction(h, 'a', { type: 'bet', amount: 100 })
  assert.equal(h.phase, 'done')
  assert.equal(h.results.a.outcomes[0].outcome, 'perdeu')
  assert.equal(h.chips.a, START_CHIPS - 100)
})

test('rebentar e dobrar', () => {
  let g = stack(startGame(['a']), [c('10'), c('9'), c('6'), c('8'), c('K')])
  g = applyAction(g, 'a', { type: 'bet', amount: 50 })
  g = applyAction(g, 'a', { type: 'hit' }) // 26
  assert.equal(g.results.a.outcomes[0].outcome, 'rebentou')
  assert.equal(g.chips.a, START_CHIPS - 50)
  let d = stack(startGame(['a']), [c('6'), c('9'), c('5'), c('8'), c('10')])
  d = applyAction(d, 'a', { type: 'bet', amount: 100 })
  d = applyAction(d, 'a', { type: 'double' }) // 21 com 3 cartas, aposta 200
  assert.equal(d.phase, 'done')
  assert.equal(d.results.a.outcomes[0].outcome, 'ganhou')
  assert.equal(d.chips.a, START_CHIPS + 200)
})

test('dividir um par cria duas mãos com aposta cada', () => {
  let g = stack(startGame(['a']), [c('8'), c('10'), c('8', 'h'), c('7'), c('3'), c('2'), c('K'), c('K')])
  g = applyAction(g, 'a', { type: 'bet', amount: 100 })
  g = applyAction(g, 'a', { type: 'split' })
  assert.equal(g.hands.a.length, 2)
  assert.equal(g.chips.a, START_CHIPS - 200)
  assert.throws(() => applyAction(g, 'a', { type: 'split' }), /uma vez/)
  g = applyAction(g, 'a', { type: 'stand' })
  g = applyAction(g, 'a', { type: 'stand' })
  assert.equal(g.phase, 'done')
  assert.equal(g.results.a.outcomes.length, 2)
})

test('mesa online: espera por todos, o tempo resolve quem não joga', () => {
  let g = startGame(['a', 'b'], 0)
  g = applyAction(g, 'a', { type: 'bet', amount: 20 }, 10)
  assert.equal(g.phase, 'bet', 'espera pelo b')
  g = tick(g, BET_MS + 1)
  assert.equal(g.phase === 'play' || g.phase === 'done', true, 'sem a aposta do b, a mão começa só com o a')
  assert.equal(g.hands.b, undefined)
  if (g.phase === 'play') {
    const t = g.deadline
    g = tick(g, t + 1)
    assert.ok(g.phase === 'done' || g.turn?.h === 1 || g.turn === null, 'quem não joga a tempo fica')
  }
  assert.throws(() => applyAction(startGame(['a']), 'z', { type: 'bet', amount: 10 }), /mesa/)
  assert.throws(() => applyAction(startGame(['a']), 'a', { type: 'bet', amount: 5 }), /mínima/)
  assert.ok(TURN_MS > 0)
})

test('sem fichas: recomeçar com 1000', () => {
  let g = startGame(['a'])
  assert.throws(() => applyAction(g, 'a', { type: 'rebuy' }), /Ainda/)
  g = { ...g, chips: { a: 0 } }
  g = applyAction(g, 'a', { type: 'rebuy' })
  assert.equal(g.chips.a, START_CHIPS)
})

test('as fichas vêm da carteira (e quem não tem carteira começa com 1000)', () => {
  const g = startGame(['a', 'b', 'c'], 0, Math.random, { chips: { a: 2350, b: 0 } })
  assert.equal(g.chips.a, 2350)
  assert.equal(g.chips.b, 0, 'sem fichas fica sem fichas (pode recomeçar)')
  assert.equal(g.chips.c, START_CHIPS)
  const r = applyAction(g, 'b', { type: 'rebuy' })
  assert.equal(r.chips.b, START_CHIPS)
})

test('bots apostam sozinhos, jogam com tempo e a mão acaba', () => {
  let g = startGame(['h', 'bot0', 'bot1'], 0, Math.random, { bots: ['bot0', 'bot1'], timed: false })
  assert.equal(g.deadline, null, 'sozinho: sem tempo para apostar')
  assert.ok(g.bets.bot0 >= 10 && g.bets.bot1 >= 10, 'os bots já apostaram')
  assert.equal(g.phase, 'bet', 'espera pela pessoa')
  let t = 0
  for (let round = 0; round < 30; round++) {
    g = applyAction(g, 'h', { type: 'bet', amount: 10 }, t)
    let guard = 0
    while (g.phase === 'play' && guard++ < 50) {
      if (g.turn.id === 'h') {
        assert.equal(g.deadline, null, 'sozinho: sem tempo para jogar')
        g = applyAction(g, 'h', { type: 'stand' }, t)
      } else {
        assert.ok(isBot(g, g.turn.id))
        t = g.deadline + 1
        g = tick(g, t)
      }
    }
    assert.equal(g.phase, 'done')
    if (g.chips.h < 10) g = applyAction(g, 'h', { type: 'rebuy' })
    g = applyAction(g, 'h', { type: 'next' }, t)
  }
})

test('online: o anfitrião junta bots e usa as carteiras', () => {
  const g = blackjackOnline.start([{ id: 'a' }, { id: 'b' }], { bots: 9, chips: { a: 5000 } }, 0)
  assert.deepEqual(g.order, ['a', 'b', 'bot0', 'bot1', 'bot2'], 'no máximo 5 lugares')
  assert.equal(g.chips.a, 5000)
  assert.equal(g.chips.b, START_CHIPS)
  assert.ok(BOT_DELAY_MS < TURN_MS)
})
