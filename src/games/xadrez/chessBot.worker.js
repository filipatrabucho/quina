import { chooseMove } from './chessBot.js'

self.onmessage = (e) => {
  const { id, fen, level } = e.data
  self.postMessage({ id, move: chooseMove(fen, level) })
}
