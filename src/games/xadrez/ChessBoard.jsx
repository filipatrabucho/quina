import { useMemo, useState } from 'react'
import { Chess } from 'chess.js'

const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
const FILES = 'abcdefgh'
const PROMO = ['q', 'r', 'b', 'n']
const PROMO_NAME = { q: 'Dama', r: 'Torre', b: 'Bispo', n: 'Cavalo' }

/**
 * Tabuleiro clicável. Valida os lances localmente (para mostrar as casas
 * possíveis) e chama onMove({ from, to, promotion }).
 */
export default function ChessBoard({ fen, orientation = 'w', canMove, onMove, lastMove }) {
  const chess = useMemo(() => new Chess(fen), [fen])
  const [selected, setSelected] = useState(null)
  const [promotion, setPromotion] = useState(null) // { from, to }

  const legal = useMemo(
    () => (selected ? chess.moves({ square: selected, verbose: true }) : []),
    [chess, selected]
  )
  const targets = new Set(legal.map((m) => m.to))
  const myColor = chess.turn()
  const checkSquare = chess.inCheck()
    ? chess
        .board()
        .flat()
        .find((p) => p && p.type === 'k' && p.color === myColor)?.square
    : null

  const ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  const files = orientation === 'w' ? [...FILES] : [...FILES].reverse()

  const clickSquare = (sq) => {
    if (!canMove) return
    const piece = chess.get(sq)
    if (selected && targets.has(sq)) {
      const move = legal.find((m) => m.to === sq)
      if (move.promotion) {
        setPromotion({ from: selected, to: sq })
      } else {
        onMove({ from: selected, to: sq })
      }
      setSelected(null)
      return
    }
    if (piece && piece.color === myColor) setSelected(sq === selected ? null : sq)
    else setSelected(null)
  }

  return (
    <div className="chess-wrap">
      <div className="chess-board" role="group" aria-label="Tabuleiro de xadrez">
        {ranks.map((rank, ri) =>
          files.map((file, fi) => {
            const sq = `${file}${rank}`
            const piece = chess.get(sq)
            // a1 é uma casa escura
            const isDark = (FILES.indexOf(file) + rank) % 2 === 1
            const classes = [
              'chess-sq',
              isDark ? 'chess-sq--dark' : 'chess-sq--light',
              selected === sq && 'chess-sq--selected',
              lastMove && (lastMove.from === sq || lastMove.to === sq) && 'chess-sq--last',
              checkSquare === sq && 'chess-sq--check',
              targets.has(sq) && (piece ? 'chess-sq--capture' : 'chess-sq--target'),
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={sq}
                className={classes}
                onClick={() => clickSquare(sq)}
                data-square={sq}
                aria-label={`${sq}${piece ? ` ${piece.color === 'w' ? 'branco' : 'preto'} ${piece.type}` : ''}`}
              >
                {piece && <span className={`chess-piece chess-piece--${piece.color}`}>{GLYPH[piece.type]}</span>}
                {fi === 0 && <span className="chess-coord chess-coord--rank">{rank}</span>}
                {ri === 7 && <span className="chess-coord chess-coord--file">{file}</span>}
              </button>
            )
          })
        )}
      </div>
      {promotion && (
        <div className="chess-promo" role="dialog" aria-label="Escolhe a promoção">
          <p>Promover a:</p>
          <div>
            {PROMO.map((p) => (
              <button
                key={p}
                className="chess-promo__btn"
                title={PROMO_NAME[p]}
                aria-label={PROMO_NAME[p]}
                onClick={() => {
                  onMove({ ...promotion, promotion: p })
                  setPromotion(null)
                }}
              >
                <span className={`chess-piece chess-piece--${myColor}`}>{GLYPH[p]}</span>
              </button>
            ))}
          </div>
          <button className="link-btn" onClick={() => setPromotion(null)}>Cancelar</button>
        </div>
      )}
    </div>
  )
}

export function MoveList({ moves }) {
  if (!moves.length) return null
  const pairs = []
  for (let i = 0; i < moves.length; i += 2) pairs.push([moves[i], moves[i + 1]])
  return (
    <ol className="chess-moves" data-testid="chess-moves">
      {pairs.map(([w, b], i) => (
        <li key={i}>
          <span>{w}</span>
          {b && <span>{b}</span>}
        </li>
      ))}
    </ol>
  )
}
