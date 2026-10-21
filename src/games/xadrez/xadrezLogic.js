import { Chess } from 'chess.js'

export function gameStatus(chess) {
  if (chess.isCheckmate()) return { over: true, reason: 'xeque-mate', winner: chess.turn() === 'w' ? 'b' : 'w' }
  if (chess.isStalemate()) return { over: true, reason: 'afogamento', winner: null }
  if (chess.isThreefoldRepetition()) return { over: true, reason: 'repetição', winner: null }
  if (chess.isInsufficientMaterial()) return { over: true, reason: 'material insuficiente', winner: null }
  if (chess.isDraw()) return { over: true, reason: 'regra dos 50 lances', winner: null }
  return { over: false, check: chess.inCheck() }
}

// Reconstrói o jogo a partir da lista de lances (mantém a deteção de
// repetições, que um FEN sozinho perde).
export function replay(moves) {
  const chess = new Chess()
  for (const m of moves) chess.move(m)
  return chess
}

// ---- Relógio ----
// Ritmos: minutos + segundos de incremento por lance. null = sem relógio.
export const CLOCKS = [
  { key: 'sem', label: 'Sem relógio', base: 0, inc: 0 },
  { key: '1+0', label: '1 min', base: 60000, inc: 0 },
  { key: '3+2', label: '3+2', base: 180000, inc: 2000 },
  { key: '5+0', label: '5 min', base: 300000, inc: 0 },
  { key: '10+0', label: '10 min', base: 600000, inc: 0 },
]
// O relógio só começa depois do 1.º lance das brancas.
export function newClock(key) {
  const c = CLOCKS.find((x) => x.key === key)
  return c && c.base ? { key: c.key, inc: c.inc, w: c.base, b: c.base, turnStart: null } : null
}
// Tempo que resta a cada um agora.
export function clockLeft(clock, turn, now) {
  if (!clock) return null
  const run = clock.turnStart != null ? Math.max(0, now - clock.turnStart) : 0
  return { w: clock.w - (turn === 'w' ? run : 0), b: clock.b - (turn === 'b' ? run : 0) }
}
// Depois de um lance de `color`: desconta o tempo gasto, soma o incremento e passa a vez.
export function clockAfterMove(clock, color, now) {
  if (!clock) return null
  const spent = clock.turnStart != null ? now - clock.turnStart : 0
  const left = clock[color] - spent
  return { ...clock, [color]: left > 0 ? left + (clock.turnStart != null ? clock.inc : 0) : 0, turnStart: now }
}

// ---- Multiplayer (corre no anfitrião) ----
export const xadrezOnline = {
  minPlayers: 2,
  maxPlayers: 2,
  tick: true,
  tickMs: 500,
  start(players, action = {}) {
    return {
      clock: newClock(action.clock),
      white: players[0].id,
      black: players[1].id,
      moves: [], // em SAN
      fen: new Chess().fen(),
      lastMove: null,
      result: null, // { winnerId|null, reason }
      drawOffer: null,
      score: { [players[0].id]: 0, [players[1].id]: 0, empates: 0 },
      round: 1,
    }
  },
  reduce(game, action, fromId, { now = Date.now() } = {}) {
    const finish = (g, winnerId, reason) => {
      const k = winnerId ?? 'empates'
      return { ...g, result: { winnerId, reason }, drawOffer: null, score: { ...g.score, [k]: (g.score[k] || 0) + 1 } }
    }
    if (action.type === 'tick') {
      // Acabou o tempo de quem tem a vez?
      if (game.result || !game.clock || game.clock.turnStart == null) return game
      const turn = game.moves.length % 2 === 0 ? 'w' : 'b'
      if (clockLeft(game.clock, turn, now)[turn] > 0) return game
      return finish({ ...game, clock: { ...game.clock, [turn]: 0 } }, turn === 'w' ? game.black : game.white, 'tempo')
    }
    const color = fromId === game.white ? 'w' : fromId === game.black ? 'b' : null
    if (!color) throw new Error('Não estás a jogar.')

    switch (action.type) {
      case 'move': {
        if (game.result) throw new Error('A partida já acabou.')
        const chess = replay(game.moves)
        if (chess.turn() !== color) throw new Error('Não é a tua vez.')
        let move
        try {
          move = chess.move({ from: action.from, to: action.to, promotion: action.promotion || 'q' })
        } catch {
          throw new Error('Lance inválido.')
        }
        const clock = clockAfterMove(game.clock, color, now)
        if (clock && clock[color] <= 0) return finish({ ...game, clock }, color === 'w' ? game.black : game.white, 'tempo')
        let next = {
          ...game,
          clock,
          moves: [...game.moves, move.san],
          fen: chess.fen(),
          lastMove: { from: move.from, to: move.to },
          drawOffer: null,
        }
        const st = gameStatus(chess)
        if (st.over) {
          const winnerId = st.winner === 'w' ? game.white : st.winner === 'b' ? game.black : null
          next = finish(next, winnerId, st.reason)
        }
        return next
      }
      case 'resign': {
        if (game.result) return game
        return finish(game, color === 'w' ? game.black : game.white, 'desistência')
      }
      case 'offerDraw': {
        if (game.result) return game
        return { ...game, drawOffer: fromId }
      }
      case 'acceptDraw': {
        if (game.result || !game.drawOffer || game.drawOffer === fromId) return game
        return finish(game, null, 'acordo')
      }
      case 'declineDraw': {
        if (!game.drawOffer || game.drawOffer === fromId) return game
        return { ...game, drawOffer: null }
      }
      case 'rematch': {
        if (!game.result) return game
        return {
          ...game,
          white: game.black,
          black: game.white,
          clock: game.clock ? newClock(game.clock.key) : null,
          moves: [],
          fen: new Chess().fen(),
          lastMove: null,
          result: null,
          drawOffer: null,
          round: game.round + 1,
        }
      }
      default:
        throw new Error('Ação desconhecida.')
    }
  },
}
