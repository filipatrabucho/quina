import { Chess } from 'chess.js'

// Bot de xadrez simples: alfa-beta + tabelas de posição + busca de
// capturas no fim (para não deixar peças penduradas).
const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }

// Tabelas do ponto de vista das brancas, linha 8 primeiro (índice 0 = a8).
const PST = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
}

// Avaliação do ponto de vista das brancas.
function evaluate(chess) {
  let score = 0
  const board = chess.board()
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c]
      if (!sq) continue
      const idx = sq.color === 'w' ? r * 8 + c : (7 - r) * 8 + c
      const v = VALUE[sq.type] + PST[sq.type][idx]
      score += sq.color === 'w' ? v : -v
    }
  }
  return score
}

function orderMoves(moves) {
  return moves.sort((a, b) => {
    const sa = (a.captured ? 10 * VALUE[a.captured] - VALUE[a.piece] : 0) + (a.promotion ? 800 : 0)
    const sb = (b.captured ? 10 * VALUE[b.captured] - VALUE[b.piece] : 0) + (b.promotion ? 800 : 0)
    return sb - sa
  })
}

const MATE = 1000000

function quiesce(chess, alpha, beta, sign, depth, counter) {
  counter.n++
  const stand = sign * evaluate(chess)
  if (depth === 0) return stand
  if (stand >= beta) return beta
  if (stand > alpha) alpha = stand
  const captures = orderMoves(chess.moves({ verbose: true }).filter((m) => m.captured))
  for (const m of captures) {
    chess.move(m)
    const score = -quiesce(chess, -beta, -alpha, -sign, depth - 1, counter)
    chess.undo()
    if (score >= beta) return beta
    if (score > alpha) alpha = score
  }
  return alpha
}

function negamax(chess, depth, alpha, beta, sign, ply, counter) {
  counter.n++
  if (chess.isCheckmate()) return -MATE + ply
  if (chess.isDraw() || chess.isStalemate()) return 0
  if (depth === 0) return quiesce(chess, alpha, beta, sign, 3, counter)
  let best = -Infinity
  for (const m of orderMoves(chess.moves({ verbose: true }))) {
    chess.move(m)
    const score = -negamax(chess, depth - 1, -beta, -alpha, -sign, ply + 1, counter)
    chess.undo()
    if (score > best) best = score
    if (score > alpha) alpha = score
    if (alpha >= beta) break
  }
  return best
}

export const BOT_DEPTH = { facil: 1, medio: 2, dificil: 3 }

export function chooseMove(fen, level = 'medio') {
  const chess = new Chess(fen)
  const moves = orderMoves(chess.moves({ verbose: true }))
  if (moves.length === 0) return null
  if (level === 'facil' && Math.random() < 0.3) {
    const m = moves[Math.floor(Math.random() * moves.length)]
    return { from: m.from, to: m.to, promotion: m.promotion }
  }
  const depth = BOT_DEPTH[level] ?? 2
  const sign = chess.turn() === 'w' ? 1 : -1
  const counter = { n: 0 }
  let bestScore = -Infinity
  let best = []
  let alpha = -Infinity
  for (const m of moves) {
    chess.move(m)
    const score = -negamax(chess, depth - 1, -Infinity, -alpha + 1, -sign, 1, counter)
    chess.undo()
    if (score > bestScore) {
      bestScore = score
      best = [m]
    } else if (score === bestScore) {
      best.push(m)
    }
    if (score > alpha) alpha = score
  }
  const m = best[Math.floor(Math.random() * best.length)]
  return { from: m.from, to: m.to, promotion: m.promotion }
}
