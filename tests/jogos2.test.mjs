// Testes dos jogos novos: 99, Snake, Memória, 2 Verdades 1 Mentira, Continua a Frase, Emoji Battle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as n99 from '../src/games/noventa/noventaLogic.js'
import * as snake from '../src/games/snake/snakeLogic.js'
import * as memo from '../src/games/memoria/memoriaLogic.js'
import { verdadesOnline, lieShown, subjectOf } from '../src/games/verdades/verdadesLogic.js'
import { fraseOnline } from '../src/games/frase/fraseLogic.js'
import { emojisOnline, checkGuess, puzzleOf, hintFor } from '../src/games/emojis/emojisLogic.js'
import { PUZZLES } from '../src/games/emojis/puzzles.js'

const P = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const ctx = (now, isHost = false) => ({ now, isHost })
const card = (id, rank) => ({ id, rank, suit: 's' })

test('99: valores das cartas especiais', () => {
  assert.deepEqual(n99.cardOptions(card(1, 'A'), 90).map((o) => o.total), [91])
  assert.deepEqual(n99.cardOptions(card(1, 'A'), 10).map((o) => o.total), [11, 21])
  assert.deepEqual(n99.cardOptions(card(1, '10'), 95).map((o) => o.total), [85])
  assert.deepEqual(n99.cardOptions(card(1, '10'), 5).map((o) => o.total), [0, 15])
  assert.equal(n99.cardOptions(card(1, 'K'), 98)[0].total, 99)
  assert.equal(n99.cardOptions(card(1, '9'), 99)[0].total, 99)
  assert.equal(n99.cardOptions(card(1, '8'), 92).length, 0)
  assert.equal(n99.cardOptions(card(1, 'Q'), 89)[0].total, 99)
})

test('99: perde vida quem não consegue jogar e ganha o último', () => {
  let g = n99.startGame(['a', 'b', 'c'])
  g = { ...g, total: 95, turn: 0, hands: { a: [card(100, '2')], b: [card(101, '8'), card(102, '7'), card(103, '6')], c: [card(104, '3')] }, drawPile: [card(105, '5')] }
  g = n99.playCard(g, 'a', 100)
  // b não tinha nada que servisse com 97: perdeu uma vida e começou mão nova
  assert.equal(g.lives.b, 2)
  assert.equal(g.total, 0)
  assert.equal(n99.currentPlayer(g), 'b')
  assert.equal(g.hands.b.length, 3)
  assert.throws(() => n99.playCard(g, 'a', g.hands.a[0].id), /vez/)
  // 4 inverte o sentido com 3 jogadores
  g = { ...g, hands: { ...g.hands, b: [card(200, '4'), ...g.hands.b.slice(1)] } }
  g = n99.playCard(g, 'b', 200)
  assert.equal(g.direction, -1)
  assert.equal(n99.currentPlayer(g), 'a')
  // Partidas inteiras entre bots acabam sempre com um vencedor
  for (let k = 0; k < 200; k++) {
    let s = n99.startGame(['a', 'b', 'c', 'd'])
    let moves = 0
    while (!s.winner && moves++ < 3000) s = n99.applyMove(s, n99.currentPlayer(s), n99.botMove(s, n99.currentPlayer(s)))
    assert.ok(s.winner)
    assert.equal(Object.values(s.lives).filter((l) => l > 0).length, 1)
  }
})

test('snake: anda, come, cresce e morre', () => {
  const rand = () => 0
  let s = snake.newGame(true, rand)
  s = { ...s, food: [10, 10] }
  s = snake.step(s, rand)
  assert.equal(s.score, 1)
  assert.equal(s.snake.length, 4)
  assert.deepEqual(s.snake[0], [10, 10])
  // Não dá para virar para trás
  assert.equal(snake.turn(s, 'left').queue.length, 0)
  s = snake.turn(s, 'up')
  s = snake.step(s, rand)
  assert.deepEqual(s.snake[0], [10, 9])
  // Bater na parede
  let w = { ...snake.newGame(true), snake: [[19, 5], [18, 5], [17, 5]], dir: 'right' }
  assert.equal(snake.step(w).over, true)
  // Sem paredes atravessa
  let f = { ...snake.newGame(false), snake: [[19, 5], [18, 5], [17, 5]], dir: 'right', food: [0, 0] }
  assert.deepEqual(snake.step(f).snake[0], [0, 5])
  // Bater no próprio corpo
  let b = { ...snake.newGame(true), snake: [[5, 5], [6, 5], [6, 6], [5, 6], [4, 6]], dir: 'down', food: [0, 0] }
  assert.equal(snake.step(b).over, true)
})

test('memória: pares, turnos e vencedor', () => {
  let g = memo.memoriaOnline.start([{ id: 'a' }, { id: 'b' }], { size: 'facil' }, 0)
  assert.equal(g.cards.length, 12)
  const pairOf = (i) => g.cards.findIndex((c, k) => k !== i && c.face === g.cards[i].face)
  const wrongOf = (i) => g.cards.findIndex((c, k) => k !== i && c.face !== g.cards[i].face && !c.matched)
  // Falha: fica à espera e depois passa a vez
  g = memo.memoriaOnline.reduce(g, { type: 'flip', index: 0 }, 'a', ctx(1))
  g = memo.memoriaOnline.reduce(g, { type: 'flip', index: wrongOf(0) }, 'a', ctx(2))
  assert.ok(g.hideAt)
  assert.throws(() => memo.memoriaOnline.reduce(g, { type: 'flip', index: 3 }, 'a', ctx(3)), /Espera/)
  g = memo.memoriaOnline.reduce(g, { type: 'tick' }, 'a', ctx(2 + memo.HIDE_MS, true))
  assert.equal(g.turn, 1)
  assert.equal(g.open.length, 0)
  assert.throws(() => memo.memoriaOnline.reduce(g, { type: 'flip', index: 0 }, 'a', ctx(5000)), /vez/)
  // b acerta tudo (joga sempre outra vez)
  let t = 6000
  while (!g.done) {
    const i = g.cards.findIndex((c) => !c.matched)
    g = memo.memoriaOnline.reduce(g, { type: 'flip', index: i }, 'b', ctx(t++))
    g = memo.memoriaOnline.reduce(g, { type: 'flip', index: pairOf(i) }, 'b', ctx(t++))
    assert.equal(g.turn, 1)
  }
  assert.deepEqual(g.winners, ['b'])
  assert.equal(g.pairs.b, 6)
  assert.equal(g.scores.b, 1)
})

test('2 verdades 1 mentira: escrever, adivinhar, pontuar', () => {
  let g = verdadesOnline.start(P, { settings: { writeSeconds: 60, guessSeconds: 20 } }, 0)
  const entry = (lie) => ({ statements: ['um', 'dois', 'três'], lie, done: true })
  g = verdadesOnline.reduce(g, { type: 'submit', entry: entry(0) }, 'a', ctx(1))
  g = verdadesOnline.reduce(g, { type: 'submit', entry: { statements: ['x', '', 'z'], lie: 1, done: true } }, 'b', ctx(2))
  assert.equal(g.entries.b.done, false) // frase vazia não conta como pronto
  g = verdadesOnline.reduce(g, { type: 'submit', entry: entry(2) }, 'b', ctx(3))
  g = verdadesOnline.reduce(g, { type: 'submit', entry: entry(1) }, 'c', ctx(4))
  assert.equal(g.phase, 'adivinhar')
  assert.equal(g.queue.length, 3)
  const subject = subjectOf(g)
  const others = P.map((p) => p.id).filter((id) => id !== subject)
  assert.throws(() => verdadesOnline.reduce(g, { type: 'vote', index: 0 }, subject, ctx(5)), /tuas/)
  const lie = lieShown(g)
  g = verdadesOnline.reduce(g, { type: 'vote', index: lie }, others[0], ctx(6))
  g = verdadesOnline.reduce(g, { type: 'vote', index: (lie + 1) % 3 }, others[1], ctx(7))
  assert.equal(g.phase, 'revelar')
  assert.equal(g.scores[others[0]], 100)
  assert.equal(g.scores[subject], 50)
  assert.equal(g.scores[others[1]], 0)
  // Avança pelo tempo até ao fim
  let now = 8
  while (g.phase !== 'final') {
    now = (g.deadline || now) + 1
    g = verdadesOnline.reduce(g, { type: 'tick' }, 'a', ctx(now, true))
  }
  assert.equal(g.phase, 'final')
})

test('continua a frase: votos e rondas', () => {
  let g = fraseOnline.start(P, { settings: { rounds: 2, seconds: 30 } }, 0)
  assert.ok(g.prompt)
  for (const id of ['a', 'b', 'c']) g = fraseOnline.reduce(g, { type: 'submit', text: `fim ${id}`, done: true }, id, ctx(1))
  assert.equal(g.phase, 'votar')
  assert.throws(() => fraseOnline.reduce(g, { type: 'vote', target: 'a' }, 'a', ctx(2)), /tua/)
  g = fraseOnline.reduce(g, { type: 'vote', target: 'a' }, 'b', ctx(2))
  g = fraseOnline.reduce(g, { type: 'vote', target: 'a' }, 'c', ctx(3))
  g = fraseOnline.reduce(g, { type: 'vote', target: 'b' }, 'a', ctx(4))
  assert.equal(g.phase, 'resultados')
  assert.equal(g.scores.a, 250)
  assert.equal(g.scores.b, 100)
  g = fraseOnline.reduce(g, { type: 'next' }, 'a', ctx(5, true))
  assert.equal(g.round, 2)
  // Ronda 2 sem ninguém a escrever: o tempo acaba e salta a votação
  g = fraseOnline.reduce(g, { type: 'tick' }, 'a', ctx(g.deadline + 1, true))
  assert.equal(g.phase, 'resultados')
  g = fraseOnline.reduce(g, { type: 'tick' }, 'a', ctx(g.deadline + 1, true))
  assert.equal(g.phase, 'final')
})

test('emoji battle: respostas PT/EN, gralhas e pontos', () => {
  const titanic = PUZZLES.find((p) => p.a[0] === 'Titanic')
  const leao = PUZZLES.find((p) => p.a[0] === 'O Rei Leão')
  assert.equal(checkGuess('titanik', titanic), 'certo')
  assert.equal(checkGuess('The Lion King', leao), 'certo')
  assert.equal(checkGuess('rei leao', leao), 'certo')
  assert.equal(checkGuess('Shrek', leao), 'errado')
  assert.equal(hintFor('O Rei Leão'), 'O   R _ _   L _ _ _')
  // Todas as respostas são únicas entre enigmas
  for (const p of PUZZLES) for (const q of PUZZLES) if (p !== q) for (const a of p.a) assert.notEqual(checkGuess(a, q), 'certo', `${a} bate com ${q.a[0]}`)

  let g = emojisOnline.start(P, { settings: { rounds: 2, seconds: 30 } }, 0)
  const answer = puzzleOf(g).a[0]
  g = emojisOnline.reduce(g, { type: 'guess', text: 'zzzz' }, 'a', ctx(1000))
  assert.equal(g.tries.a, 1)
  g = emojisOnline.reduce(g, { type: 'guess', text: answer }, 'a', ctx(1000))
  assert.ok(g.solved.a.points > 170) // rápido e primeiro
  g = emojisOnline.reduce(g, { type: 'guess', text: answer }, 'b', ctx(25000))
  assert.ok(g.solved.b.points < g.solved.a.points)
  g = emojisOnline.reduce(g, { type: 'guess', text: answer }, 'c', ctx(26000))
  assert.equal(g.phase, 'revelar')
  g = emojisOnline.reduce(g, { type: 'tick' }, 'a', ctx(g.deadline + 1, true))
  assert.equal(g.round, 2)
  g = emojisOnline.reduce(g, { type: 'tick' }, 'a', ctx(g.deadline + 1, true))
  g = emojisOnline.reduce(g, { type: 'tick' }, 'a', ctx(g.deadline + 1, true))
  assert.equal(g.phase, 'final')
})
