import { useEffect, useMemo, useState, useCallback } from 'react'
import Board from './components/Board.jsx'
import Keyboard from './components/Keyboard.jsx'
import {
  WORD_LENGTH,
  MODES,
  getTodayWords,
  getTodayKey,
  evaluateGuess,
  computeKeyboardStatusesMulti,
  buildShareGrid,
} from './utils/gameLogic.js'
import { preloadDictionary, isRealWord } from './utils/dictionary.js'
import DuelMode from './components/DuelMode.jsx'

function storageKeyGuesses(mode) {
  return `quina-estado-${mode}`
}
function storageKeyStats(mode) {
  return `quina-estatisticas-${mode}`
}
function storageKeyRecorded(mode, day) {
  return `quina-registo-${mode}-${day}`
}

function loadGuesses(mode, todayKey) {
  try {
    const raw = localStorage.getItem(storageKeyGuesses(mode))
    if (!raw) return []
    const saved = JSON.parse(raw)
    if (saved.day !== todayKey) return []
    return saved.guesses || []
  } catch {
    return []
  }
}

function loadStats(mode) {
  try {
    const raw = localStorage.getItem(storageKeyStats(mode))
    if (!raw) return { jogos: 0, vitorias: 0, sequencia: 0, melhorSequencia: 0 }
    return JSON.parse(raw)
  } catch {
    return { jogos: 0, vitorias: 0, sequencia: 0, melhorSequencia: 0 }
  }
}

function hasRecorded(mode, todayKey) {
  return localStorage.getItem(storageKeyRecorded(mode, todayKey)) === '1'
}
function markRecorded(mode, todayKey) {
  localStorage.setItem(storageKeyRecorded(mode, todayKey), '1')
}

export default function App() {
  const todayKey = useMemo(() => getTodayKey(), [])
  const [mode, setMode] = useState(() => localStorage.getItem('quina-modo') || 'classico')
  const boardsCount = MODES[mode].boards
  const maxGuesses = MODES[mode].maxGuesses

  const targets = useMemo(() => getTodayWords(mode, boardsCount), [mode, boardsCount, todayKey])

  // "guesses" é a ÚNICA fonte de verdade: tudo o resto (tabuleiros
  // resolvidos, vitória/derrota) é calculado a partir dela. Isto evita
  // o bug de um "gameState" guardado à parte ficar dessincronizado
  // depois de um reload.
  const [guesses, setGuesses] = useState(() => loadGuesses(mode, todayKey))
  const [currentGuess, setCurrentGuess] = useState('')
  const [toast, setToast] = useState('')
  const [shakeRow, setShakeRow] = useState(false)
  const [invalidRow, setInvalidRow] = useState(false)
  const [showHelp, setShowHelp] = useState(() => !localStorage.getItem('quina-visitado'))
  const [showStats, setShowStats] = useState(false)
  const [stats, setStats] = useState(() => loadStats(mode))
  const [dictionaryReady, setDictionaryReady] = useState(false)
  const [view, setView] = useState('jogo') // 'jogo' | 'duelo'

  useEffect(() => {
    localStorage.setItem('quina-visitado', '1')
  }, [])

  // O dicionário carrega numa thread à parte (Web Worker); isto nunca
  // bloqueia o teclado nem os cliques.
  useEffect(() => {
    preloadDictionary().then(() => setDictionaryReady(true))
  }, [])

  useEffect(() => {
    localStorage.setItem(storageKeyGuesses(mode), JSON.stringify({ day: todayKey, guesses }))
  }, [mode, todayKey, guesses])

  const perBoardStatuses = useMemo(
    () => targets.map((target) => guesses.map((g) => evaluateGuess(g, target))),
    [guesses, targets]
  )
  const solvedBoards = useMemo(
    () => targets.map((target) => guesses.includes(target)),
    [guesses, targets]
  )
  const allSolved = solvedBoards.length > 0 && solvedBoards.every(Boolean)
  const gameState = allSolved ? 'ganhou' : guesses.length >= maxGuesses ? 'perdeu' : 'a-jogar'

  const keyboardStatuses = useMemo(
    () => computeKeyboardStatusesMulti(guesses, perBoardStatuses),
    [guesses, perBoardStatuses]
  )

  const showToast = useCallback((msg, duration = 1600) => {
    setToast(msg)
    if (duration) setTimeout(() => setToast(''), duration)
  }, [])

  // Regista o resultado (stats) exatamente uma vez por jogo, mesmo que a
  // página seja recarregada várias vezes depois de terminar.
  useEffect(() => {
    if (gameState === 'a-jogar') return
    const alreadyRecorded = hasRecorded(mode, todayKey)
    if (!alreadyRecorded) {
      markRecorded(mode, todayKey)
      const won = gameState === 'ganhou'
      setStats((prev) => {
        const next = {
          jogos: prev.jogos + 1,
          vitorias: prev.vitorias + (won ? 1 : 0),
          sequencia: won ? prev.sequencia + 1 : 0,
          melhorSequencia: won ? Math.max(prev.melhorSequencia, prev.sequencia + 1) : prev.melhorSequencia,
        }
        localStorage.setItem(storageKeyStats(mode), JSON.stringify(next))
        return next
      })
      showToast(
        won
          ? ['Excelente!', 'Muito bem!', 'Boa!', 'Certeiro!'][Math.floor(Math.random() * 4)]
          : `As palavras eram: ${targets.join(', ')}`,
        won ? 1400 : 3500
      )
    }
    setTimeout(() => setShowStats(true), alreadyRecorded ? 300 : 1200)
  }, [gameState, mode, todayKey, targets, showToast])

  const submitGuess = useCallback(async () => {
    if (currentGuess.length !== WORD_LENGTH) {
      setShakeRow(true)
      showToast('Faltam letras')
      setTimeout(() => setShakeRow(false), 500)
      return
    }
    if (!dictionaryReady) {
      showToast('A carregar dicionário…')
      return
    }
    const ok = await isRealWord(currentGuess)
    if (!ok) {
      setInvalidRow(true)
      showToast('Palavra desconhecida')
      setTimeout(() => setInvalidRow(false), 500)
      return
    }
    setGuesses((prev) => [...prev, currentGuess])
    setCurrentGuess('')
  }, [currentGuess, dictionaryReady, showToast])

  const handleKey = useCallback(
    (key) => {
      if (gameState !== 'a-jogar') return
      if (key === 'ENTER') {
        submitGuess()
      } else if (key === 'BACK') {
        setCurrentGuess((g) => g.slice(0, -1))
      } else if (/^[A-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
        setCurrentGuess((g) => g + key)
      }
    },
    [gameState, currentGuess, submitGuess]
  )

  useEffect(() => {
    function onKeyDown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key.toUpperCase()
      if (key === 'ENTER') handleKey('ENTER')
      else if (key === 'BACKSPACE') handleKey('BACK')
      else if (/^[A-Z]$/.test(key)) handleKey(key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleKey])

  const handleShare = useCallback(() => {
    const grids = targets.map((target, i) => {
      const solvedIndex = guesses.indexOf(target)
      const rows = solvedBoards[i] ? perBoardStatuses[i].slice(0, solvedIndex + 1) : perBoardStatuses[i]
      return buildShareGrid(rows)
    })
    const text = `Quina — ${MODES[mode].label} ${todayKey} ${
      gameState === 'ganhou' ? guesses.length : 'X'
    }/${maxGuesses}\n\n${grids.join('\n\n')}`
    if (navigator.share) {
      navigator.share({ text }).catch(() => {})
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
      showToast('Copiado!')
    }
  }, [targets, solvedBoards, perBoardStatuses, guesses, mode, todayKey, gameState, maxGuesses, showToast])

  const changeMode = useCallback(
    (newMode) => {
      if (newMode === mode) return
      setMode(newMode)
      localStorage.setItem('quina-modo', newMode)
      setGuesses(loadGuesses(newMode, todayKey))
      setStats(loadStats(newMode))
      setCurrentGuess('')
      setShowStats(false)
    },
    [mode, todayKey]
  )

  return (
    <div className="app">
      <header className="header">
        <button className="icon-btn" onClick={() => setShowHelp(true)} aria-label="Como jogar">
          ?
        </button>
        <h1 className="logo">
          <span className="logo__tile logo__tile--a">Q</span>
          <span className="logo__tile logo__tile--b">U</span>
          <span className="logo__tile logo__tile--a">I</span>
          <span className="logo__tile logo__tile--b">N</span>
          <span className="logo__tile logo__tile--a">A</span>
        </h1>
        <button className="icon-btn" onClick={() => setShowStats(true)} aria-label="Estatísticas">
          📊
        </button>
      </header>

      {view === 'duelo' ? (
        <DuelMode onExit={() => setView('jogo')} />
      ) : (
        <>
      <div className="mode-switch">
        {Object.entries(MODES).map(([key, m]) => (
          <button
            key={key}
            className={`mode-btn${mode === key ? ' mode-btn--active' : ''}`}
            onClick={() => changeMode(key)}
          >
            {m.label}
          </button>
        ))}
        <button className="mode-btn mode-btn--duel" onClick={() => setView('duelo')}>
          1vs1
        </button>
      </div>

      <main className="main">
        <div className={`boards-grid boards-grid--${boardsCount}`}>
          {targets.map((target, i) => {
            const solved = solvedBoards[i]
            const solvedIndex = guesses.indexOf(target)
            const boardGuesses = solved ? guesses.slice(0, solvedIndex + 1) : guesses
            const boardStatuses = solved
              ? perBoardStatuses[i].slice(0, solvedIndex + 1)
              : perBoardStatuses[i]
            return (
              <Board
                key={i}
                guesses={boardGuesses}
                statusesPerGuess={boardStatuses}
                currentGuess={!solved && gameState === 'a-jogar' ? currentGuess : ''}
                maxGuesses={maxGuesses}
                shakeRow={shakeRow}
                invalidRow={invalidRow}
                solved={solved}
                compact={boardsCount > 1}
              />
            )
          })}
        </div>
      </main>

      {toast && <div className="toast">{toast}</div>}

      <Keyboard statuses={keyboardStatuses} onKey={handleKey} />

      {showHelp && (
        <Modal onClose={() => setShowHelp(false)} title="Como jogar">
          <p>Adivinha a palavra escondida em {maxGuesses} tentativas. Depois de cada tentativa, a cor dos azulejos muda para mostrar o quão perto estiveste.</p>
          <div className="example-row">
            <div className="tile tile--certo tiny"><span>P</span></div>
            <div className="tile tiny"><span>R</span></div>
            <div className="tile tiny"><span>A</span></div>
            <div className="tile tiny"><span>I</span></div>
            <div className="tile tiny"><span>A</span></div>
          </div>
          <p><strong>P</strong> está na palavra e no lugar certo.</p>
          <div className="example-row">
            <div className="tile tiny"><span>V</span></div>
            <div className="tile tile--lugar-errado tiny"><span>E</span></div>
            <div className="tile tiny"><span>L</span></div>
            <div className="tile tiny"><span>A</span></div>
            <div className="tile tiny"><span>S</span></div>
          </div>
          <p><strong>E</strong> está na palavra, mas no lugar errado.</p>
          <div className="example-row">
            <div className="tile tiny"><span>M</span></div>
            <div className="tile tiny"><span>U</span></div>
            <div className="tile tile--errado tiny"><span>R</span></div>
            <div className="tile tiny"><span>O</span></div>
            <div className="tile tiny"><span>S</span></div>
          </div>
          <p><strong>R</strong> não está na palavra em nenhum lugar.</p>
          <p className="modal-note">
            No Dueto e no Quarteto, cada tentativa conta ao mesmo tempo para todas as palavras.
            Uma nova palavra (ou palavras) todos os dias, à meia-noite.
          </p>
        </Modal>
      )}

      {showStats && (
        <Modal onClose={() => setShowStats(false)} title={`Estatísticas — ${MODES[mode].label}`}>
          <div className="stats-grid">
            <Stat label="Jogos" value={stats.jogos} />
            <Stat label="% Vitórias" value={stats.jogos ? Math.round((stats.vitorias / stats.jogos) * 100) : 0} />
            <Stat label="Sequência" value={stats.sequencia} />
            <Stat label="Melhor" value={stats.melhorSequencia} />
          </div>
          {gameState !== 'a-jogar' && (
            <button className="share-btn" onClick={handleShare}>Partilhar resultado</button>
          )}
          {gameState !== 'a-jogar' && <p className="modal-note">Volta amanhã para uma nova palavra.</p>}
        </Modal>
      )}
      </>
      )}

      {import.meta.env.VITE_TIP_URL && (
        <a
          className="tip-link tip-link--footer"
          href={import.meta.env.VITE_TIP_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          ☕ Oferece-me um café
        </a>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}