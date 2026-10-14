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

// ---- Multiplayer (corre no anfitrião) ----
export const xadrezOnline = {
  minPlayers: 2,
  maxPlayers: 2,
  start(players) {
    return {
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
  reduce(game, action, fromId) {
    const color = fromId === game.white ? 'w' : fromId === game.black ? 'b' : null
    if (!color) throw new Error('Não estás a jogar.')
    const finish = (g, winnerId, reason) => {
      const k = winnerId ?? 'empates'
      return { ...g, result: { winnerId, reason }, drawOffer: null, score: { ...g.score, [k]: (g.score[k] || 0) + 1 } }
    }

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
        let next = {
          ...game,
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
