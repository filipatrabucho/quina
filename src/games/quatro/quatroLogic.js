export const ROWS = 6
export const COLS = 7

export function emptyBoard() {
  return Array(ROWS * COLS).fill(0)
}

// Tabuleiro em array: índice = linha * COLS + coluna; linha 0 é a de cima.
export function dropRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r * COLS + col]) return r
  }
  return -1
}

export function validCols(board) {
  const cols = []
  for (let c = 0; c < COLS; c++) if (!board[c]) cols.push(c)
  return cols
}

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]]

export function winnerOf(board) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r * COLS + c]
      if (!p) continue
      for (const [dr, dc] of DIRS) {
        const cells = [r * COLS + c]
        let rr = r + dr
        let cc = c + dc
        while (cells.length < 4 && rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr * COLS + cc] === p) {
          cells.push(rr * COLS + cc)
          rr += dr
          cc += dc
        }
        if (cells.length === 4) return { player: p, cells }
      }
    }
  }
  if (board.every(Boolean)) return { player: 0, cells: [] }
  return null
}

export function play(board, col, player) {
  const r = dropRow(board, col)
  if (r < 0) return null
  const next = [...board]
  next[r * COLS + col] = player
  return next
}

// ---- Bot: minimax com cortes alfa-beta ----
function scoreWindow(a, b, c, d, me) {
  const w = [a, b, c, d]
  const mine = w.filter((x) => x === me).length
  const theirs = w.filter((x) => x && x !== me).length
  const empty = 4 - mine - theirs
  if (mine === 4) return 1000
  if (mine === 3 && empty === 1) return 6
  if (mine === 2 && empty === 2) return 2
  if (theirs === 3 && empty === 1) return -8
  if (theirs === 2 && empty === 2) return -1
  return 0
}

function evaluate(board, me) {
  let score = 0
  for (let r = 0; r < ROWS; r++) if (board[r * COLS + 3] === me) score += 3
  const at = (r, c) => board[r * COLS + c]
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 3 < COLS) score += scoreWindow(at(r, c), at(r, c + 1), at(r, c + 2), at(r, c + 3), me)
      if (r + 3 < ROWS) score += scoreWindow(at(r, c), at(r + 1, c), at(r + 2, c), at(r + 3, c), me)
      if (r + 3 < ROWS && c + 3 < COLS) score += scoreWindow(at(r, c), at(r + 1, c + 1), at(r + 2, c + 2), at(r + 3, c + 3), me)
      if (r + 3 < ROWS && c - 3 >= 0) score += scoreWindow(at(r, c), at(r + 1, c - 1), at(r + 2, c - 2), at(r + 3, c - 3), me)
    }
  }
  return score
}

const ORDER = [3, 2, 4, 1, 5, 0, 6]

function alphabeta(board, depth, alpha, beta, maximizing, me, other) {
  const w = winnerOf(board)
  if (w) {
    if (w.player === 0) return 0
    return w.player === me ? 100000 + depth : -100000 - depth
  }
  if (depth === 0) return evaluate(board, me)
  const cols = ORDER.filter((c) => !board[c])
  if (maximizing) {
    let value = -Infinity
    for (const c of cols) {
      value = Math.max(value, alphabeta(play(board, c, me), depth - 1, alpha, beta, false, me, other))
      alpha = Math.max(alpha, value)
      if (alpha >= beta) break
    }
    return value
  }
  let value = Infinity
  for (const c of cols) {
    value = Math.min(value, alphabeta(play(board, c, other), depth - 1, alpha, beta, true, me, other))
    beta = Math.min(beta, value)
    if (alpha >= beta) break
  }
  return value
}

export const BOT_DEPTH = { facil: 1, medio: 3, dificil: 6 }

export function botMove(board, me, level = 'medio') {
  const other = me === 1 ? 2 : 1
  const cols = ORDER.filter((c) => !board[c])
  if (cols.length === 0) return null
  if (level === 'facil' && Math.random() < 0.35) return cols[Math.floor(Math.random() * cols.length)]
  const depth = BOT_DEPTH[level] ?? 3
  let best = -Infinity
  let choices = []
  for (const c of cols) {
    const score = alphabeta(play(board, c, me), depth - 1, -Infinity, Infinity, false, me, other)
    if (score > best) {
      best = score
      choices = [c]
    } else if (score === best) {
      choices.push(c)
    }
  }
  return choices[Math.floor(Math.random() * choices.length)]
}

// ---- Multiplayer (corre no anfitrião) ----
export const quatroOnline = {
  minPlayers: 2,
  maxPlayers: 2,
  start(players) {
    return {
      board: emptyBoard(),
      order: [players[0].id, players[1].id], // order[0] tem as peças 1 e começa
      turn: 0,
      lastMove: null,
      result: null,
      score: { [players[0].id]: 0, [players[1].id]: 0, empates: 0 },
      round: 1,
    }
  },
  reduce(game, action, fromId) {
    if (action.type === 'drop') {
      if (game.result) throw new Error('A partida já acabou.')
      const seat = game.order.indexOf(fromId)
      if (seat < 0) throw new Error('Não estás a jogar.')
      if (seat !== game.turn) throw new Error('Não é a tua vez.')
      const col = action.col
      if (!Number.isInteger(col) || col < 0 || col >= COLS) throw new Error('Coluna inválida.')
      const row = dropRow(game.board, col)
      if (row < 0) throw new Error('Essa coluna está cheia.')
      const board = play(game.board, col, seat + 1)
      const w = winnerOf(board)
      let result = null
      let score = game.score
      if (w) {
        const winnerId = w.player === 0 ? null : game.order[w.player - 1]
        result = { winnerId, cells: w.cells }
        const k = winnerId ?? 'empates'
        score = { ...score, [k]: (score[k] || 0) + 1 }
      }
      return { ...game, board, turn: 1 - game.turn, lastMove: row * COLS + col, result, score }
    }
    if (action.type === 'rematch') {
      if (!game.result) return game
      return {
        ...game,
        board: emptyBoard(),
        order: [game.order[1], game.order[0]],
        turn: 0,
        lastMove: null,
        result: null,
        round: game.round + 1,
      }
    }
    throw new Error('Ação desconhecida.')
  },
}
