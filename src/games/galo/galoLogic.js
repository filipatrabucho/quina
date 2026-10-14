export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

export function winnerOf(board) {
  for (const line of LINES) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { mark: board[a], line }
  }
  if (board.every(Boolean)) return { mark: 'empate', line: [] }
  return null
}

export function nextMark(board) {
  const x = board.filter((c) => c === 'X').length
  const o = board.filter((c) => c === 'O').length
  return x <= o ? 'X' : 'O'
}

// Minimax completo (o tabuleiro é pequeno). Devolve a pontuação do ponto
// de vista de "me": +10 ganha, -10 perde, 0 empate; mais rápido = melhor.
function minimax(board, me, turn, depth) {
  const w = winnerOf(board)
  if (w) {
    if (w.mark === 'empate') return 0
    return w.mark === me ? 10 - depth : depth - 10
  }
  const other = turn === 'X' ? 'O' : 'X'
  let best = turn === me ? -Infinity : Infinity
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue
    board[i] = turn
    const score = minimax(board, me, other, depth + 1)
    board[i] = null
    best = turn === me ? Math.max(best, score) : Math.min(best, score)
  }
  return best
}

export function bestMove(board, me) {
  const work = [...board]
  const other = me === 'X' ? 'O' : 'X'
  let bestScore = -Infinity
  let moves = []
  for (let i = 0; i < 9; i++) {
    if (work[i]) continue
    work[i] = me
    const score = minimax(work, me, other, 1)
    work[i] = null
    if (score > bestScore) {
      bestScore = score
      moves = [i]
    } else if (score === bestScore) {
      moves.push(i)
    }
  }
  return moves[Math.floor(Math.random() * moves.length)]
}

// Dificuldade: probabilidade de o bot jogar ao acaso em vez do melhor lance.
export const BOT_LEVELS = { facil: 0.6, medio: 0.25, dificil: 0 }

export function botMove(board, me, level = 'dificil') {
  const free = board.map((c, i) => (c ? null : i)).filter((i) => i != null)
  if (free.length === 0) return null
  if (Math.random() < (BOT_LEVELS[level] ?? 0)) return free[Math.floor(Math.random() * free.length)]
  return bestMove(board, me)
}

// ---- Multiplayer (corre no anfitrião) ----
export const galoOnline = {
  minPlayers: 2,
  maxPlayers: 2,
  start(players) {
    return {
      board: Array(9).fill(null),
      marks: { [players[0].id]: 'X', [players[1].id]: 'O' },
      score: { [players[0].id]: 0, [players[1].id]: 0, empates: 0 },
      round: 1,
      result: null,
    }
  },
  reduce(game, action, fromId) {
    if (action.type === 'move') {
      if (game.result) throw new Error('A partida já acabou.')
      const mark = game.marks[fromId]
      if (!mark) throw new Error('Não estás a jogar.')
      if (nextMark(game.board) !== mark) throw new Error('Não é a tua vez.')
      const i = action.index
      if (!Number.isInteger(i) || i < 0 || i > 8 || game.board[i]) throw new Error('Casa inválida.')
      const board = [...game.board]
      board[i] = mark
      const w = winnerOf(board)
      let result = null
      let score = game.score
      if (w) {
        const winnerId = w.mark === 'empate' ? null : Object.keys(game.marks).find((id) => game.marks[id] === w.mark)
        result = { winnerId, line: w.line }
        score = { ...score, [winnerId ?? 'empates']: (score[winnerId ?? 'empates'] || 0) + 1 }
      }
      return { ...game, board, result, score }
    }
    if (action.type === 'rematch') {
      if (!game.result) return game
      // Troca quem começa (X começa sempre).
      const ids = Object.keys(game.marks)
      const marks = { [ids[0]]: game.marks[ids[1]], [ids[1]]: game.marks[ids[0]] }
      return { ...game, board: Array(9).fill(null), marks, result: null, round: game.round + 1 }
    }
    throw new Error('Ação desconhecida.')
  },
}
