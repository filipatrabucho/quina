import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { perft, search, moveFrom, moveTo } from '../src/games/xadrez/engine.js'
import { chooseMove } from '../src/games/xadrez/chessBot.js'

test('gerador de lances certo (perft)', () => {
  assert.equal(perft('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 3), 8902)
  assert.equal(perft('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3), 97862)
  assert.equal(perft('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 4), 43238)
  assert.equal(perft('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 3), 9467)
})

test('encontra o mate e não deixa a dama pendurada', () => {
  const r = search('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', { timeMs: 300 })
  assert.equal(moveFrom(r.move) + moveTo(r.move), 'd1d8')
  // a dama preta em d5 está atacada pelo cavalo: o bot das pretas tem de a salvar ou trocar
  const fen = 'rnb1kbnr/ppp1pppp/8/3q4/8/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 3'
  const m = chooseMove(fen, 'medio')
  assert.equal(m.from, 'd5', 'mexe a dama atacada')
})

test('responde depressa e com lances legais em todos os níveis', () => {
  const chess = new Chess()
  for (let i = 0; i < 16 && !chess.isGameOver(); i++) {
    const level = ['facil', 'medio', 'dificil'][i % 3]
    const t = Date.now()
    const m = chooseMove(chess.fen(), level === 'dificil' ? 'medio' : level)
    assert.ok(Date.now() - t < 1500, 'tempo limitado')
    chess.move(m) // lança erro se o lance for ilegal
  }
})

test('relógio online: desconta, soma incremento e perde por tempo', async () => {
  const { xadrezOnline, clockLeft } = await import('../src/games/xadrez/xadrezLogic.js')
  let g = xadrezOnline.start([{ id: 'a' }, { id: 'b' }], { clock: '3+2' }, 0)
  assert.equal(g.clock.w, 180000)
  g = xadrezOnline.reduce(g, { type: 'move', from: 'e2', to: 'e4' }, 'a', { now: 1000 })
  assert.equal(g.clock.w, 180000, 'o 1.º lance das brancas não conta tempo')
  g = xadrezOnline.reduce(g, { type: 'move', from: 'e7', to: 'e5' }, 'b', { now: 11000 })
  assert.equal(g.clock.b, 180000 - 10000 + 2000)
  assert.equal(clockLeft(g.clock, 'w', 21000).w, 170000)
  assert.equal(xadrezOnline.reduce(g, { type: 'tick' }, 'a', { now: 100000 }), g, 'ainda tem tempo')
  const lost = xadrezOnline.reduce(g, { type: 'tick' }, 'a', { now: 11000 + 180001 })
  assert.deepEqual(lost.result, { winnerId: 'b', reason: 'tempo' })
  const none = xadrezOnline.start([{ id: 'a' }, { id: 'b' }], {}, 0)
  assert.equal(none.clock, null)
})
