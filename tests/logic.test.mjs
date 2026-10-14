// Testes da lógica dos jogos (sem browser): node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as galo from '../src/games/galo/galoLogic.js'
import * as quatro from '../src/games/quatro/quatroLogic.js'
import { xadrezOnline, replay } from '../src/games/xadrez/xadrezLogic.js'
import { chooseMove } from '../src/games/xadrez/chessBot.js'
import { memesOnline } from '../src/games/memes/memesLogic.js'
import { reduceRoom } from '../src/lib/rooms/reduceRoom.js'

const A = { id: 'a', name: 'Ana' }
const B = { id: 'b', name: 'Bruno' }
const C = { id: 'c', name: 'Carla' }

test('galo: deteta vitória, empate e o bot perfeito nunca perde', () => {
  assert.equal(galo.winnerOf(['X', 'X', 'X', null, null, null, null, null, null]).mark, 'X')
  assert.equal(galo.winnerOf(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']).mark, 'empate')
  // Bot bloqueia uma vitória iminente
  assert.equal(galo.bestMove(['X', 'X', null, null, 'O', null, null, null, null], 'O'), 2)
  // Bot fecha a vitória
  assert.equal(galo.bestMove(['O', 'O', null, 'X', 'X', null, null, null, null], 'O'), 2)
  // 200 jogos aleatórios contra o bot difícil: nunca perde
  for (let g = 0; g < 200; g++) {
    const board = Array(9).fill(null)
    let turn = 'X'
    while (!galo.winnerOf(board)) {
      const free = board.map((c, i) => (c ? null : i)).filter((i) => i != null)
      const i = turn === 'O' ? galo.botMove(board, 'O', 'dificil') : free[Math.floor(Math.random() * free.length)]
      board[i] = turn
      turn = turn === 'X' ? 'O' : 'X'
    }
    assert.notEqual(galo.winnerOf(board).mark, 'X')
  }
})

test('galo online: turnos, vitória, placar e desforra', () => {
  let g = galo.galoOnline.start([A, B])
  assert.throws(() => galo.galoOnline.reduce(g, { type: 'move', index: 0 }, 'b'), /vez/)
  for (const [who, i] of [['a', 0], ['b', 3], ['a', 1], ['b', 4]]) g = galo.galoOnline.reduce(g, { type: 'move', index: i }, who)
  assert.throws(() => galo.galoOnline.reduce(g, { type: 'move', index: 0 }, 'a'), /inválida/)
  g = galo.galoOnline.reduce(g, { type: 'move', index: 2 }, 'a')
  assert.equal(g.result.winnerId, 'a')
  assert.deepEqual(g.result.line, [0, 1, 2])
  assert.equal(g.score.a, 1)
  g = galo.galoOnline.reduce(g, { type: 'rematch' }, 'b')
  assert.equal(g.marks.b, 'X')
  assert.equal(g.result, null)
})

test('4 em linha: gravidade, vitória diagonal, coluna cheia e bot', () => {
  let b = quatro.emptyBoard()
  // diagonal para o jogador 1
  const seq = [[0, 1], [1, 2], [1, 1], [2, 2], [2, 2], [2, 1], [3, 2], [3, 2], [3, 2], [3, 1]]
  for (const [c, p] of seq) b = quatro.play(b, c, p)
  const w = quatro.winnerOf(b)
  assert.equal(w.player, 1)
  assert.equal(w.cells.length, 4)
  let full = quatro.emptyBoard()
  for (let i = 0; i < 6; i++) full = quatro.play(full, 0, (i % 2) + 1)
  assert.equal(quatro.play(full, 0, 1), null)
  // Bot ganha quando pode e bloqueia quando tem de ser
  let t = quatro.emptyBoard()
  for (const c of [0, 1, 2]) t = quatro.play(t, c, 2)
  assert.equal(quatro.botMove(t, 2, 'medio'), 3)
  assert.equal(quatro.botMove(t, 1, 'medio'), 3)
  // Bot difícil responde em tempo útil
  const t0 = Date.now()
  quatro.botMove(quatro.emptyBoard(), 1, 'dificil')
  assert.ok(Date.now() - t0 < 3000)
})

test('4 em linha online', () => {
  let g = quatro.quatroOnline.start([A, B])
  for (const [who, c] of [['a', 0], ['b', 1], ['a', 0], ['b', 1], ['a', 0], ['b', 1]]) g = quatro.quatroOnline.reduce(g, { type: 'drop', col: c }, who)
  assert.throws(() => quatro.quatroOnline.reduce(g, { type: 'drop', col: 2 }, 'b'), /vez/)
  g = quatro.quatroOnline.reduce(g, { type: 'drop', col: 0 }, 'a')
  assert.equal(g.result.winnerId, 'a')
  g = quatro.quatroOnline.reduce(g, { type: 'rematch' }, 'a')
  assert.deepEqual(g.order, ['b', 'a'])
})

test('xadrez online: lances válidos, mate pastor, desistência e empate', () => {
  let g = xadrezOnline.start([A, B])
  assert.throws(() => xadrezOnline.reduce(g, { type: 'move', from: 'e7', to: 'e5' }, 'b'), /vez/)
  assert.throws(() => xadrezOnline.reduce(g, { type: 'move', from: 'e2', to: 'e5' }, 'a'), /inválido/)
  const mate = [['a', 'e2', 'e4'], ['b', 'e7', 'e5'], ['a', 'f1', 'c4'], ['b', 'b8', 'c6'], ['a', 'd1', 'h5'], ['b', 'g8', 'f6'], ['a', 'h5', 'f7']]
  for (const [who, from, to] of mate) g = xadrezOnline.reduce(g, { type: 'move', from, to }, who)
  assert.deepEqual(g.result, { winnerId: 'a', reason: 'xeque-mate' })
  assert.equal(g.moves.at(-1), 'Qxf7#')
  g = xadrezOnline.reduce(g, { type: 'rematch' }, 'b')
  assert.equal(g.white, 'b')
  g = xadrezOnline.reduce(g, { type: 'offerDraw' }, 'a')
  assert.equal(xadrezOnline.reduce(g, { type: 'acceptDraw' }, 'a').result, null)
  const drawn = xadrezOnline.reduce(g, { type: 'acceptDraw' }, 'b')
  assert.equal(drawn.result.reason, 'acordo')
  const resigned = xadrezOnline.reduce(g, { type: 'resign' }, 'b')
  assert.equal(resigned.result.winnerId, 'a')
  // promoção (por defeito, dama)
  let p = { ...xadrezOnline.start([A, B]) }
  const line = ['a4', 'h5', 'a5', 'h4', 'a6', 'h3', 'axb7', 'hxg2']
  p.moves = line
  p = xadrezOnline.reduce(p, { type: 'move', from: 'b7', to: 'a8' }, 'a')
  assert.equal(p.moves.at(-1), 'bxa8=Q')
  p = xadrezOnline.reduce(p, { type: 'move', from: 'g2', to: 'h1', promotion: 'n' }, 'b')
  assert.equal(p.moves.at(-1), 'gxh1=N')
  assert.equal(replay(p.moves).turn(), 'w')
})

test('bot de xadrez: encontra o mate e não oferece a dama', () => {
  const mateIn1 = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'
  assert.deepEqual(chooseMove(mateIn1, 'medio'), { from: 'h5', to: 'f7', promotion: undefined })
  // Dama branca atacada por um peão: o bot tira-a dali, sem a entregar
  const hanging = 'rnbqkbnr/pp1ppppp/8/2p5/3Q4/8/PPP1PPPP/RNB1KBNR w KQkq - 0 3'
  for (const level of ['medio', 'dificil']) {
    const m = chooseMove(hanging, level)
    assert.equal(m.from, 'd4')
    assert.ok(!['d7', 'g7'].includes(m.to), `entregou a dama em ${m.to}`)
  }
})

test('memes: rondas, votos, pontos e fim do jogo', () => {
  const templates = Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, name: `T${i}`, url: `x${i}`, boxes: 2 }))
  const ctx = (now, isHost = false) => ({ now, isHost })
  let g = memesOnline.start([A, B, C], { templates, settings: { rounds: 2 } }, 0)
  assert.equal(g.phase, 'writing')
  assert.equal(new Set(Object.values(g.templates).map((t) => t.id)).size, 3)
  const cap = (t) => [{ text: t, x: 50, y: 10 }, { text: '', x: 50, y: 90 }]
  g = memesOnline.reduce(g, { type: 'reroll' }, 'a', ctx(1))
  assert.throws(() => memesOnline.reduce(g, { type: 'reroll' }, 'a', ctx(1)), /uma vez/)
  g = memesOnline.reduce(g, { type: 'submit', captions: cap('a1'), done: true }, 'a', ctx(1))
  g = memesOnline.reduce(g, { type: 'submit', captions: cap('b1'), done: true }, 'b', ctx(1))
  // c só escreveu, não terminou: o tempo acaba e o meme dele conta na mesma
  g = memesOnline.reduce(g, { type: 'submit', captions: cap('c1'), done: false }, 'c', ctx(1))
  assert.equal(g.phase, 'writing')
  g = memesOnline.reduce(g, { type: 'tick' }, 'a', ctx(91000))
  assert.equal(g.phase, 'voting')
  assert.equal(g.order.length, 3)
  assert.throws(() => memesOnline.reduce(g, { type: 'vote', target: 'a' }, 'a', ctx(91001)), /próprio/)
  g = memesOnline.reduce(g, { type: 'vote', target: 'b' }, 'a', ctx(91001))
  g = memesOnline.reduce(g, { type: 'vote', target: 'b' }, 'c', ctx(91001))
  g = memesOnline.reduce(g, { type: 'vote', target: 'a' }, 'b', ctx(91001))
  assert.equal(g.phase, 'results')
  assert.equal(g.scores.b, 250)
  assert.equal(g.scores.a, 100)
  assert.equal(g.scores.c, 0)
  assert.throws(() => memesOnline.reduce(g, { type: 'next' }, 'b', ctx(91002, false)), /anfitrião/)
  g = memesOnline.reduce(g, { type: 'next' }, 'a', ctx(91002, true))
  assert.equal(g.phase, 'writing')
  assert.equal(g.round, 2)
  // Ronda sem memes escritos: salta a votação
  g = memesOnline.reduce(g, { type: 'tick' }, 'a', ctx(999999))
  assert.equal(g.phase, 'results')
  g = memesOnline.reduce(g, { type: 'tick' }, 'a', ctx(9999999))
  assert.equal(g.phase, 'final')
  g = memesOnline.reduce(g, { type: 'restart' }, 'a', ctx(9999999, true))
  assert.equal(g.round, 1)
  assert.equal(g.scores.b, 0)
})

test('sala: lobby, lotação, início e espectadores', () => {
  const logic = galo.galoOnline
  let s = { v: 1, code: 'X', hostId: 'a', status: 'lobby', maxPlayers: 2, players: [A], game: null }
  s = reduceRoom(s, { type: 'join', player: B }, 'b', logic)
  s = reduceRoom(s, { type: 'join', player: C }, 'c', logic)
  assert.deepEqual(s.players.map((p) => p.id), ['a', 'b'])
  assert.throws(() => reduceRoom(s, { type: 'start' }, 'b', logic), /anfitrião/)
  s = reduceRoom(s, { type: 'start' }, 'a', logic)
  assert.equal(s.status, 'playing')
  assert.throws(() => reduceRoom(s, { type: 'move', index: 0 }, 'c', logic), /espectador/)
  s = reduceRoom(s, { type: 'move', index: 4 }, 'a', logic)
  assert.equal(s.game.board[4], 'X')
})
