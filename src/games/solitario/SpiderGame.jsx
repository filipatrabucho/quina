import { useEffect, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import { gameBreak } from '../../lib/ads.js'
import { recordResultOnce } from '../../lib/social.js'
import { deal, move, undo, canMove, bestMove, won, isRun, canDealStock, dealStock } from './spiderLogic.js'
import { SolCard, useCardSize, columnOffsets, useTimer, loadSaved, saveGame, Toolbar, WinPanel } from './SolitaireUI.jsx'

const SAVE = 'tg-spider'
const SUIT_OPTIONS = [
  { n: 1, label: '1 naipe', hint: 'fácil' },
  { n: 2, label: '2 naipes', hint: 'médio' },
  { n: 4, label: '4 naipes', hint: 'difícil' },
]
const newGame = (suits, n = 1 + Math.floor(Math.random() * 99999)) => ({ ...deal(n, suits), startedAt: null, endedAt: null })

function Board() {
  const [g, setG] = useState(() => {
    const saved = loadSaved(SAVE)
    return saved?.cols ? { ...saved, history: [] } : null
  })
  const [suits, setSuits] = useState(() => g?.suits || 1)
  const [sel, setSel] = useState(null)
  const [shake, setShake] = useState(0)
  const [ref, size] = useCardSize(10, !!g)
  const done = !!g && won(g)
  const time = useTimer(g?.startedAt, g?.endedAt)

  useEffect(() => saveGame(SAVE, g && !done ? g : null), [g, done])
  useEffect(() => {
    if (done) recordResultOnce(`spider-${g.suits}-${g.n}-${g.startedAt}`, 'spider', true, String(g.moves))
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = (s) => gameBreak('spider', () => {
    if (g && !done && g.moves >= 5) recordResultOnce(`spider-${g.suits}-${g.n}-${g.startedAt}-desistiu`, 'spider', false)
    setSuits(s)
    setG(newGame(s))
    setSel(null)
  })

  if (!g) {
    return (
      <div className="game-panel">
        <p className="game-status">Com quantos naipes queres jogar?</p>
        <div className="bot-levels">
          {SUIT_OPTIONS.map((o) => (
            <button key={o.n} type="button" className={`mode-btn${suits === o.n ? ' mode-btn--active' : ''}`} onClick={() => setSuits(o.n)} data-testid={`sp-suits-${o.n}`}>
              {o.label} <small>({o.hint})</small>
            </button>
          ))}
        </div>
        <button type="button" className="share-btn" onClick={() => start(suits)} data-testid="sp-start">Começar</button>
      </div>
    )
  }

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
  const clickCard = (i, k) => {
    if (done) return
    const col = g.cols[i]
    if (sel) {
      if (sel.col === i && sel.index === k) {
        const to = bestMove(g, sel)
        return apply(to ? move(g, sel, to) : null)
      }
      if (sel.col !== i) return apply(canMove(g, sel, { col: i }) ? move(g, sel, { col: i }) : null)
    }
    if (!col[k].up || !isRun(col, k)) {
      setShake((x) => x + 1)
      setSel(null)
      return
    }
    setSel({ col: i, index: k })
  }
  const clickColumn = (i) => sel && apply(canMove(g, sel, { col: i }) ? move(g, sel, { col: i }) : null)
  const deals = Math.floor(g.stock.length / 10)
  const stockOk = canDealStock(g)

  const style = { '--cw': `${size.w}px`, '--ch': `${size.h}px`, '--gap': `${size.gap}px` }
  return (
    <div className="sol" style={style}>
      <Toolbar number={g.n} moves={g.moves} time={time} onUndo={() => { setG(undo(g)); setSel(null) }} canUndo={g.history.length > 0 && !done} onNew={() => start(g.suits)}>
        <select className="mode-btn sol-select" value={g.suits} onChange={(e) => start(Number(e.target.value))} aria-label="Naipes">
          {SUIT_OPTIONS.map((o) => <option key={o.n} value={o.n}>{o.label}</option>)}
        </select>
      </Toolbar>
      <div className="sol-board" ref={ref}>
        <div className="sp-top">
          <button
            type="button"
            className={`sp-stock${stockOk ? '' : ' sp-stock--off'}`}
            onClick={() => (stockOk ? apply(dealStock(g)) : setShake((k) => k + 1))}
            disabled={!g.stock.length}
            title={g.stock.length && !stockOk ? 'Para dar cartas não pode haver colunas vazias' : 'Dar mais 10 cartas'}
            data-testid="sp-stock"
          >
            {Array.from({ length: deals }, (_, i) => <span key={i} className="sol-card sol-card--down" style={{ left: i * 6 }} />)}
            <b>{deals ? `Dar cartas (${deals})` : 'Monte vazio'}</b>
          </button>
          <span className="sp-done" data-testid="sp-done">
            {Array.from({ length: 8 }, (_, i) => <i key={i} className={i < g.done ? 'on' : ''}>♠</i>)}
          </span>
        </div>
        <div className={`sol-cols sol-grid sol-grid--10${shake ? ' sol-cols--shake' : ''}`} key={shake}>
          {g.cols.map((col, i) => {
            const { tops, height } = columnOffsets(col, size)
            return (
              <div key={i} className="sol-col" style={{ height }} onClick={(e) => e.target === e.currentTarget && clickColumn(i)} data-testid={`sp-col-${i}`}>
                {!col.length && <div className="sol-slot" onClick={() => clickColumn(i)} />}
                {col.map((c, k) => (
                  <SolCard
                    key={c.id}
                    card={c}
                    down={!c.up}
                    style={{ top: tops[k] }}
                    selected={sel?.col === i && k >= sel.index}
                    onClick={(e) => {
                      e.stopPropagation()
                      clickCard(i, k)
                    }}
                    testid={k === col.length - 1 ? `sp-top-${i}` : undefined}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
      {done && <WinPanel moves={g.moves} time={time} onNew={() => start(g.suits)} />}
      {!stockOk && g.stock.length > 0 && <p className="modal-note">Para dar mais cartas, todas as colunas têm de ter pelo menos uma carta.</p>}
      <p className="modal-note sol-tip">Toca numa carta (ou sequência do mesmo naipe) e depois na coluna para onde a queres mudar. Tocar duas vezes muda-a para o melhor sítio.</p>
    </div>
  )
}

const HELP = (
  <>
    <p>O objetivo é montar, nas colunas, sequências completas do Rei ao Ás do mesmo naipe. Cada sequência completa sai da mesa; ganhas quando saírem as 8.</p>
    <p>Podes pôr uma carta em cima de outra com um valor acima, de qualquer naipe (por exemplo, um 7 em cima de um 8). Mas só podes mudar várias cartas juntas se forem do mesmo naipe e seguidas.</p>
    <p>Numa coluna vazia podes pôr qualquer carta ou sequência. Quando ficares sem jogadas, dá mais 10 cartas do monte (uma por coluna); para isso não pode haver colunas vazias.</p>
    <p>Com 1 naipe é mais fácil; com 4 naipes é para quem gosta de desafios.</p>
  </>
)

export default function SpiderGame() {
  return (
    <GameShell game="spider" title="Spider" help={HELP} modes={[{ key: 'solo', label: 'Sozinho' }]} wide>
      {() => <Board />}
    </GameShell>
  )
}
