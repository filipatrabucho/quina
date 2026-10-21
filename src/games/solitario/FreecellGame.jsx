import { useEffect, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import { gameBreak } from '../../lib/ads.js'
import { recordResultOnce } from '../../lib/social.js'
import { deal, move, undo, canMove, bestMove, won, isRun, FOUNDATION_SUITS } from './freecellLogic.js'
import { SolCard, suitSymbol, useCardSize, columnOffsets, useTimer, loadSaved, saveGame, Toolbar, WinPanel } from './SolitaireUI.jsx'

const SAVE = 'tg-freecell'
const randomNumber = () => 1 + Math.floor(Math.random() * 32000)
const newGame = (n = randomNumber()) => ({ ...deal(n), startedAt: null, endedAt: null })

function Board() {
  const [g, setG] = useState(() => {
    const saved = loadSaved(SAVE)
    return saved?.cols ? { ...saved, history: [] } : newGame()
  })
  const [sel, setSel] = useState(null) // { col, index } | { cell }
  const [shake, setShake] = useState(0)
  const [ref, size] = useCardSize(8)
  const done = won(g)
  const time = useTimer(g.startedAt, g.endedAt)

  useEffect(() => saveGame(SAVE, done ? null : g), [g, done])
  useEffect(() => {
    if (done) recordResultOnce(`freecell-${g.n}-${g.startedAt}`, 'freecell', true, String(g.moves))
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  const apply = (next) => {
    if (!next) {
      setShake((k) => k + 1)
      setSel(null)
      return
    }
    const now = Date.now()
    setG({ ...next, startedAt: g.startedAt || now, endedAt: won(next) ? now : null })
    setSel(null)
  }
  const tryMove = (from, to) => apply(canMove(g, from, to) ? move(g, from, to) : null)
  const auto = (from) => {
    const to = bestMove(g, from)
    apply(to ? move(g, from, to) : null)
  }

  const clickCard = (from) => {
    if (done) return
    if (sel) {
      const same = sel.cell != null ? from.cell === sel.cell : from.col === sel.col && from.index === sel.index
      if (same) return auto(sel)
      if (from.col != null && from.col !== sel.col) return tryMove(sel, { col: from.col })
    }
    if (from.col != null && !isRun(g.cols[from.col], from.index)) {
      setShake((k) => k + 1)
      setSel(null)
      return
    }
    setSel(from)
  }
  const clickColumn = (i) => sel && tryMove(sel, { col: i })
  const clickCell = (i) => {
    if (g.cells[i]) return clickCard({ cell: i })
    if (sel) tryMove(sel, { cell: i })
  }
  const clickFound = () => sel && tryMove(sel, { found: true })

  const restart = (n) => {
    if (!done && g.moves >= 5) recordResultOnce(`freecell-${g.n}-${g.startedAt}-desistiu`, 'freecell', false)
    gameBreak('freecell', () => {
      setG(newGame(n))
      setSel(null)
    })
  }

  const style = { '--cw': `${size.w}px`, '--ch': `${size.h}px`, '--gap': `${size.gap}px` }
  return (
    <div className="sol" style={style}>
      <Toolbar number={g.n} moves={g.moves} time={time} onUndo={() => { setG(undo(g)); setSel(null) }} canUndo={g.history.length > 0 && !done} onNew={() => restart()}>
        <button type="button" className="mode-btn" onClick={() => restart(g.n)} disabled={!g.moves}>Recomeçar</button>
      </Toolbar>
      <div className="sol-board" ref={ref}>
        <div className="sol-top sol-grid">
          {g.cells.map((c, i) => (
            <div key={`cell${i}`} className="sol-slot sol-slot--cell" onClick={() => clickCell(i)} data-testid={`fc-cell-${i}`}>
              {c && <SolCard card={c} selected={sel?.cell === i} onDoubleClick={() => auto({ cell: i })} />}
            </div>
          ))}
          {FOUNDATION_SUITS.map((s) => (
            <div key={s} className="sol-slot sol-slot--found" onClick={clickFound} data-testid={`fc-found-${s}`}>
              {g.found[s] ? <SolCard card={{ rank: g.found[s], suit: s }} /> : <span className="sol-slot__suit">{suitSymbol(s)}</span>}
            </div>
          ))}
        </div>
        <div className={`sol-cols sol-grid${shake ? ' sol-cols--shake' : ''}`} key={shake}>
          {g.cols.map((col, i) => {
            const { tops, height } = columnOffsets(col, size, () => false)
            return (
              <div key={i} className="sol-col" style={{ height }} onClick={(e) => e.target === e.currentTarget && clickColumn(i)} data-testid={`fc-col-${i}`}>
                {!col.length && <div className="sol-slot" onClick={() => clickColumn(i)} />}
                {col.map((c, k) => (
                  <SolCard
                    key={c.id}
                    card={c}
                    style={{ top: tops[k] }}
                    selected={sel?.col === i && k >= sel.index}
                    onClick={(e) => {
                      e.stopPropagation()
                      clickCard({ col: i, index: k })
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      auto({ col: i, index: k })
                    }}
                    testid={k === col.length - 1 ? `fc-top-${i}` : undefined}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
      {done && <WinPanel moves={g.moves} time={time} onNew={() => restart()} />}
      <p className="modal-note sol-tip">Toca numa carta para a escolher e depois no sítio para onde a queres mudar. Tocar duas vezes na mesma carta muda-a para o melhor sítio.</p>
    </div>
  )
}

const HELP = (
  <>
    <p>O objetivo é pôr as 52 cartas nas 4 fundações (em cima à direita), uma por naipe, do Ás ao Rei.</p>
    <p>Nas 8 colunas só podes pôr uma carta em cima de outra de cor diferente e com um valor acima (por exemplo, um 7♥ em cima de um 8♠). Numa coluna vazia podes pôr qualquer carta.</p>
    <p>As 4 células livres (em cima à esquerda) guardam uma carta cada. Podes mudar várias cartas seguidas de uma vez se tiveres células e colunas vazias suficientes.</p>
    <p>Quase todos os jogos têm solução: pensa antes de encher as células.</p>
  </>
)

export default function FreecellGame() {
  return (
    <GameShell game="freecell" title="FreeCell" help={HELP} modes={[{ key: 'solo', label: 'Sozinho' }]} wide>
      {() => <Board />}
    </GameShell>
  )
}
