import { useEffect, useMemo, useState } from 'react'
import { GRID_SIZE, getTodayDeck, getTodayKey, isValidPlacement } from './utils/fiadaLogic.js'
import FiadaMultiplayer from './components/FiadaMultiplayer.jsx'

const STORAGE_PREFIX = 'quina-fiada-estado-'

function freshState(deck) {
  return {
    cells: Array(GRID_SIZE * GRID_SIZE).fill(null),
    drawIndex: 3,
    faceUp: deck.slice(0, 3),
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
    setFaceUp((prev) => {
      const next = [...prev]
      if (drawIndex < deck.length) {
        next[i] = deck[drawIndex]
      } else {
        next.splice(i, 1)
      }
      return next
    })
    if (drawIndex < deck.length) setDrawIndex((idx) => idx + 1)
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
          <p className="modal-note">
            Coloca os azulejos por ordem crescente em cada linha e coluna. Podes trocar um azulejo
            já colocado por outro melhor — o que sai vai para a mesa, à vista de todos.
          </p>

          <div className="fiada-status">
            <span>Jogadas: {moves}</span>
            <span>Descartes: {discards}</span>
            <span>{filledCount}/16</span>
          </div>

          <div className="fiada-grid">
            {cells.map((value, i) => (
              <button
                key={i}
                className={`fiada-cell${value != null ? ' fiada-cell--filled' : ''}`}
                onClick={() => placeAt(i)}
                disabled={pending == null || isComplete}
              >
                {value ?? ''}
              </button>
            ))}
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

          {!isComplete && !isStuck && (
            <>
              <div className="fiada-hand">
                <span className="modal-note">Na mão:</span>
                <div className={`fiada-tile fiada-tile--pending${pending == null ? ' fiada-tile--empty' : ''}`}>
                  {pending ?? '—'}
                </div>
                {pending != null && (
                  <button className="mode-btn" onClick={discardPending}>
                    Descartar
                  </button>
                )}
              </div>

              <div className="fiada-drawpile">
                <button className="share-btn" onClick={drawBlind} disabled={pending != null || deckExhausted}>
                  Comprar às cegas ({deck.length - drawIndex} restantes)
                </button>
                <div className="fiada-faceup">
                  {faceUp.map((value, i) => (
                    <button
                      key={i}
                      className="fiada-tile fiada-tile--faceup"
                      onClick={() => pickFaceUp(i)}
                      disabled={pending != null}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      )}
    </>
  )
}