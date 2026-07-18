import { useEffect, useMemo, useState } from 'react'
import { GRID_SIZE, getTodayDeck, getTodayKey, isValidPlacement, buildInitialSetup } from './utils/fiadaLogic.js'
import FiadaMultiplayer from './components/FiadaMultiplayer.jsx'

const STORAGE_PREFIX = 'quina-fiada-estado-v2-'

function tileColorClass(value) {
  if (value == null) return ''
  return ` fiada-cell--c${value % 4}`
}

function freshState(deck) {
  const { cells, drawIndex } = buildInitialSetup(deck)
  return {
    cells,
    drawIndex,
    faceUp: [],
    pending: null,
    moves: 0,
    discards: 0,
  }
}

function loadState(todayKey, deck) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + todayKey)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignora e cai para o estado inicial
  }
  return freshState(deck)
}

export default function FiadaGame() {
  const todayKey = useMemo(() => getTodayKey(), [])
  const deck = useMemo(() => getTodayDeck(), [todayKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const initial = useMemo(() => loadState(todayKey, deck), [todayKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const [view, setView] = useState('solo') // 'solo' | 'duelo'
  const [cells, setCells] = useState(initial.cells)
  const [drawIndex, setDrawIndex] = useState(initial.drawIndex)
  const [faceUp, setFaceUp] = useState(initial.faceUp)
  const [pending, setPending] = useState(initial.pending)
  const [moves, setMoves] = useState(initial.moves)
  const [discards, setDiscards] = useState(initial.discards)
  const [error, setError] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    localStorage.setItem(
      STORAGE_PREFIX + todayKey,
      JSON.stringify({ cells, drawIndex, faceUp, pending, moves, discards })
    )
  }, [todayKey, cells, drawIndex, faceUp, pending, moves, discards])

  const filledCount = cells.filter((c) => c != null).length
  const isComplete = filledCount === GRID_SIZE * GRID_SIZE
  const deckExhausted = drawIndex >= deck.length
  const noMoreSources = deckExhausted && faceUp.length === 0
  const isStuck = !isComplete && pending == null && noMoreSources

  function drawBlind() {
    if (pending != null || isComplete || deckExhausted) return
    setPending(deck[drawIndex])
    setDrawIndex((i) => i + 1)
  }

  function pickFaceUp(i) {
    if (pending != null || isComplete) return
    const value = faceUp[i]
    setPending(value)
    setFaceUp((prev) => prev.filter((_, idx) => idx !== i))
  }

  function placeAt(index) {
    if (pending == null) return
    const occupant = cells[index]
    const cellsWithoutOccupant = occupant == null ? cells : cells.map((c, i) => (i === index ? null : c))
    if (!isValidPlacement(cellsWithoutOccupant, index, pending)) {
      setError('Essa posição não respeita a ordem crescente')
      setTimeout(() => setError(''), 1500)
      return
    }
    const next = [...cells]
    next[index] = pending
    setCells(next)
    setMoves((m) => m + 1)
    if (occupant != null) setFaceUp((prev) => [...prev, occupant])
    setPending(null)
  }

  function discardPending() {
    if (pending == null) return
    setDiscards((d) => d + 1)
    setFaceUp((prev) => [...prev, pending])
    setPending(null)
  }

  function newGame() {
    const fresh = freshState(deck)
    setCells(fresh.cells)
    setDrawIndex(fresh.drawIndex)
    setFaceUp(fresh.faceUp)
    setPending(fresh.pending)
    setMoves(fresh.moves)
    setDiscards(fresh.discards)
    setError('')
  }

  return (
    <>
      <header className="header header--game">
        <button className="icon-btn" onClick={() => setShowHelp(true)} aria-label="Como jogar">
          ?
        </button>
        <h2 className="game-title">Fiada</h2>
        <button className="icon-btn" onClick={newGame} aria-label="Novo jogo" title="Novo jogo">
          🔄
        </button>
      </header>

      <div className="mode-switch">
        <button
          className={`mode-btn${view === 'solo' ? ' mode-btn--active' : ''}`}
          onClick={() => setView('solo')}
        >
          Solo
        </button>
        <button className="mode-btn mode-btn--duel" onClick={() => setView('duelo')}>
          Multiplayer
        </button>
      </div>

      {view === 'duelo' ? (
        <FiadaMultiplayer onExit={() => setView('solo')} />
      ) : (
        <main className="fiada">
          <div className="fiada-stats-row">
            <div className="fiada-stat">
              <span className="fiada-stat__value">{moves}</span>
              <span className="fiada-stat__label">Jogadas</span>
            </div>
            <div className="fiada-stat">
              <span className="fiada-stat__value">{discards}</span>
              <span className="fiada-stat__label">Descartes</span>
            </div>
            <div className="fiada-stat">
              <span className="fiada-stat__value">{filledCount}/16</span>
              <span className="fiada-stat__label">Completo</span>
            </div>
          </div>

          <div className="fiada-header-bar">
            <div className="fiada-header-bar__col">
              <span className="fiada-header-bar__label">🎴 Baralho</span>
              <span className="fiada-header-bar__value">
                {deckExhausted ? 'esgotado' : `${deck.length - drawIndex} restantes`}
              </span>
            </div>

            <div className="fiada-header-bar__col fiada-header-bar__col--center">
              <span className="fiada-header-bar__label">🎲 Mesa</span>
              <div className="fiada-topbar__faceup-strip">
                {faceUp.length === 0 && <span className="fiada-topbar__empty-chip">vazia</span>}
                {faceUp.map((value, i) => (
                  <button
                    key={i}
                    className="fiada-tile fiada-tile--faceup"
                    onClick={() => pickFaceUp(i)}
                    disabled={pending != null || isComplete}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="fiada-header-bar__col fiada-header-bar__col--right">
              <span className="fiada-header-bar__title">Fiada</span>
            </div>
          </div>

          <div className="fiada-board-frame">
            <div className="fiada-grid">
              {cells.map((value, i) => (
                <button
                  key={i}
                  className={`fiada-cell${value != null ? ' fiada-cell--filled' + tileColorClass(value) : ''}`}
                  onClick={() => placeAt(i)}
                  disabled={pending == null || isComplete}
                >
                  {value ?? ''}
                </button>
              ))}
            </div>

            {!isComplete && !isStuck && (
              <div className="fiada-hand-tray">
                <div className={`fiada-tile fiada-tile--pending${pending == null ? ' fiada-tile--empty' : ''}`}>
                  {pending ?? '—'}
                </div>
                {pending == null ? (
                  <button className="fiada-topbar__draw" onClick={drawBlind} disabled={deckExhausted}>
                    Comprar às cegas
                  </button>
                ) : (
                  <button className="fiada-topbar__discard fiada-topbar__discard--dark" onClick={discardPending}>
                    Descartar
                  </button>
                )}
              </div>
            )}
          </div>

          {error && <p className="duel-error">{error}</p>}

          {isComplete && (
            <>
              <p className="duel-result">Painel completo em {moves} jogadas! 🎉</p>
              <button className="share-btn" onClick={newGame}>Jogar outra vez</button>
            </>
          )}

          {isStuck && !isComplete && (
            <>
              <p className="duel-result">Sem mais azulejos para jogar — não deu para completar desta vez.</p>
              <button className="share-btn" onClick={newGame}>Jogar outra vez</button>
            </>
          )}
        </main>
      )}

      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowHelp(false)} aria-label="Fechar">×</button>
            <h2>Como jogar Fiada</h2>
            <p>
              Começas com 4 azulejos já colocados na diagonal do teu painel, por ordem crescente.
              O objetivo é preencher as 16 casas, mantendo cada linha e cada coluna sempre em
              ordem crescente.
            </p>
            <p>
              Em cada jogada, ou <strong>compras às cegas</strong> (não sabes o número antes de o
              tirar) ou escolhes um azulejo já visível na <strong>mesa</strong>. Depois, com o
              azulejo na mão, podes:
            </p>
            <p>
              <strong>1.</strong> Colocá-lo numa casa vazia.<br />
              <strong>2.</strong> Trocá-lo por um azulejo já colocado (o que sai vai para a mesa).<br />
              <strong>3.</strong> Descartá-lo para a mesa, se não encaixar em lado nenhum.
            </p>
            <p>
              Vence quem completar primeiro o painel. Se o baralho e a mesa esgotarem antes disso,
              o jogo termina e vence quem tiver mais casas preenchidas.
            </p>
          </div>
        </div>
      )}
    </>
  )
}