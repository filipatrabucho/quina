import { useCallback, useEffect, useRef, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import { recordResultOnce } from '../../lib/social.js'
import { SIZE, newGame, step, turn, speedFor } from './snakeLogic.js'

const BEST_KEY = 'quina-snake-best'
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }

function readBest() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) || '{}')
  } catch {
    return {}
  }
}

function draw(canvas, state) {
  const ctx = canvas.getContext('2d')
  const px = canvas.width
  const cell = px / SIZE
  ctx.fillStyle = '#10141c'
  ctx.fillRect(0, 0, px, px)
  ctx.fillStyle = '#151b26'
  for (let y = 0; y < SIZE; y++) for (let x = (y % 2); x < SIZE; x += 2) ctx.fillRect(x * cell, y * cell, cell, cell)
  if (state.food) {
    const [fx, fy] = state.food
    ctx.fillStyle = '#FF4655'
    ctx.beginPath()
    ctx.arc((fx + 0.5) * cell, (fy + 0.5) * cell, cell * 0.36, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2FBF71'
    ctx.fillRect((fx + 0.48) * cell, (fy + 0.06) * cell, cell * 0.12, cell * 0.2)
  }
  state.snake.forEach(([x, y], i) => {
    const t = i / Math.max(1, state.snake.length - 1)
    ctx.fillStyle = state.over ? '#6b7280' : `hsl(145, 60%, ${52 - t * 18}%)`
    const pad = i === 0 ? 0.04 : 0.1
    const r = cell * 0.3
    const x0 = (x + pad) * cell
    const y0 = (y + pad) * cell
    const w = cell * (1 - pad * 2)
    ctx.beginPath()
    ctx.roundRect ? ctx.roundRect(x0, y0, w, w, r) : ctx.rect(x0, y0, w, w)
    ctx.fill()
  })
  const [hx, hy] = state.snake[0]
  ctx.fillStyle = '#0b0f14'
  const eye = (ox, oy) => {
    ctx.beginPath()
    ctx.arc((hx + ox) * cell, (hy + oy) * cell, cell * 0.09, 0, Math.PI * 2)
    ctx.fill()
  }
  const e = { right: [[0.68, 0.32], [0.68, 0.68]], left: [[0.32, 0.32], [0.32, 0.68]], up: [[0.32, 0.32], [0.68, 0.32]], down: [[0.32, 0.68], [0.68, 0.68]] }[state.dir]
  e.forEach(([ox, oy]) => eye(ox, oy))
}

function SnakeBoard() {
  const canvasRef = useRef(null)
  const [walls, setWalls] = useState(true)
  const [state, setState] = useState(() => newGame(true))
  const [status, setStatus] = useState('ready') // ready | playing | paused | over
  const [best, setBest] = useState(readBest)
  const stateRef = useRef(state)
  stateRef.current = state
  const touch = useRef(null)
  const modeKey = walls ? 'paredes' : 'livre'

  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current, state)
  }, [state])

  useEffect(() => {
    if (status !== 'playing') return undefined
    const t = setTimeout(() => {
      const next = step(stateRef.current)
      setState(next)
      if (next.over) setStatus('over')
    }, speedFor(state.score))
    return () => clearTimeout(t)
  }, [state, status])

  useEffect(() => {
    if (status !== 'over') return
    if (state.score > (best[modeKey] || 0)) {
      const nb = { ...best, [modeKey]: state.score }
      setBest(nb)
      try {
        localStorage.setItem(BEST_KEY, JSON.stringify(nb))
      } catch {
        // sem armazenamento
      }
    }
    recordResultOnce(`snake-${Date.now()}`, 'snake', state.score >= 20, String(state.score))
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const restart = useCallback(
    (w = walls) => {
      setState(newGame(w))
      setStatus('playing')
    },
    [walls]
  )

  const press = useCallback(
    (dir) => {
      if (status === 'over') return
      setState((s) => turn(s, dir))
      if (status !== 'playing') setStatus('playing')
    },
    [status]
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return
      const dir = KEYS[e.key] || KEYS[e.key?.toLowerCase()]
      if (dir) {
        e.preventDefault()
        press(dir)
      } else if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        if (status === 'playing') setStatus('paused')
        else if (status === 'paused' || status === 'ready') setStatus('playing')
        else restart()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, status, restart])

  const onTouchStart = (e) => {
    const t = e.touches[0]
    touch.current = [t.clientX, t.clientY]
  }
  const onTouchEnd = (e) => {
    if (!touch.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touch.current[0]
    const dy = t.clientY - touch.current[1]
    touch.current = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return
    press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  return (
    <div className="game-panel snake">
      <div className="snake-top">
        <span className="snake-score" data-testid="snake-score">Pontos <b>{state.score}</b></span>
        <span className="snake-score">Recorde <b>{Math.max(best[modeKey] || 0, status === 'over' ? state.score : 0)}</b></span>
        <div className="snake-walls">
          {[true, false].map((w) => (
            <button
              key={String(w)}
              className={`mode-btn${walls === w ? ' mode-btn--active' : ''}`}
              onClick={() => {
                setWalls(w)
                setState(newGame(w))
                setStatus('ready')
              }}
            >
              {w ? 'Com paredes' : 'Sem paredes'}
            </button>
          ))}
        </div>
      </div>
      <div className="snake-board" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <canvas ref={canvasRef} width={480} height={480} data-testid="snake-canvas" />
        {status !== 'playing' && (
          <div className="snake-overlay">
            {status === 'over' && <p className="snake-over" data-testid="snake-over">Fim! {state.score} {state.score === 1 ? 'ponto' : 'pontos'}</p>}
            {status === 'paused' && <p className="snake-over">Pausa</p>}
            <button className="share-btn" onClick={() => (status === 'paused' ? setStatus('playing') : restart())} data-testid="snake-start">
              {status === 'over' ? 'Jogar outra vez' : status === 'paused' ? 'Continuar' : 'Começar'}
            </button>
            <p className="modal-note">Setas ou WASD no PC, desliza o dedo no telemóvel. Espaço para pausa.</p>
          </div>
        )}
      </div>
      <div className="snake-pad" aria-label="Comandos">
        <button onClick={() => press('up')} aria-label="Cima" className="snake-pad__up">▲</button>
        <button onClick={() => press('left')} aria-label="Esquerda" className="snake-pad__left">◀</button>
        <button onClick={() => press('down')} aria-label="Baixo" className="snake-pad__down">▼</button>
        <button onClick={() => press('right')} aria-label="Direita" className="snake-pad__right">▶</button>
      </div>
    </div>
  )
}

export default function SnakeGame() {
  return (
    <GameShell
      game="snake"
      title="Snake"
      help={
        <>
          <p>Guia a cobra até à comida. Cada peça que comes dá 1 ponto, a cobra cresce e fica mais rápida.</p>
          <p>Não batas no teu corpo. No modo <strong>Com paredes</strong> também não podes bater nas bordas; no <strong>Sem paredes</strong> sais de um lado e entras pelo outro.</p>
        </>
      }
      modes={[{ key: 'solo', label: 'Solo' }]}
    >
      {() => <SnakeBoard />}
    </GameShell>
  )
}
