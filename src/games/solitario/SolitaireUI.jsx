import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { rankLabel, isRed } from './freecellLogic.js'

const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' }

// Carta dos solitários: canto com o valor e o naipe ao centro (cabe em colunas estreitas).
export function SolCard({ card, down = false, selected = false, hint = false, style, onClick, onDoubleClick, testid }) {
  if (down || !card) {
    return <div className="sol-card sol-card--down" style={style} onClick={onClick} data-testid={testid} />
  }
  return (
    <div
      className={`sol-card${isRed(card) ? ' sol-card--red' : ''}${selected ? ' sol-card--sel' : ''}${hint ? ' sol-card--hint' : ''}`}
      style={style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      data-testid={testid}
      aria-label={`${rankLabel(card.rank)} ${SUIT[card.suit]}`}
    >
      <span className="sol-card__corner">{rankLabel(card.rank)}<i>{SUIT[card.suit]}</i></span>
      <span className="sol-card__mid">{SUIT[card.suit]}</span>
    </div>
  )
}

export const suitSymbol = (s) => SUIT[s]

// Largura das cartas a partir da largura do tabuleiro e do nº de colunas.
export function useCardSize(cols, ready = true) {
  const ref = useRef(null)
  const [size, setSize] = useState({ w: 60, h: 84, maxH: 520 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const measure = () => {
      const gap = el.clientWidth < 500 ? 3 : 8
      const w = Math.min(96, Math.floor((el.clientWidth - gap * (cols - 1)) / cols))
      const h = Math.round(w * 1.4)
      // As colunas apertam para caber no ecrã (com folga para o cabeçalho).
      const maxH = Math.max(h * 4, Math.round(window.innerHeight * 0.7))
      setSize({ w, h, gap, maxH })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [cols, ready])
  return [ref, size]
}

// Posições verticais das cartas de uma coluna (as viradas para baixo ficam mais juntas).
export function columnOffsets(col, size, isDown = (c) => !c.up) {
  let down = size.h * 0.12
  let up = size.h * 0.27
  const total = () => col.slice(0, -1).reduce((s, c) => s + (isDown(c) ? down : up), 0) + size.h
  const t = total()
  if (t > size.maxH) {
    const k = (size.maxH - size.h) / (t - size.h)
    down *= k
    up *= k
  }
  const tops = []
  let y = 0
  for (const c of col) {
    tops.push(y)
    y += isDown(c) ? down : up
  }
  return { tops, height: col.length ? tops[tops.length - 1] + size.h : size.h }
}

export function useTimer(startedAt, stopped) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!startedAt || stopped) return undefined
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startedAt, stopped])
  const end = stopped || now
  const s = startedAt ? Math.max(0, Math.floor((end - startedAt) / 1000)) : 0
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function loadSaved(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || null
  } catch {
    return null
  }
}
export function saveGame(key, value) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify({ ...value, history: [] }))
    else localStorage.removeItem(key)
  } catch {
    // sem localStorage, o jogo funciona na mesma
  }
}

export function Toolbar({ number, moves, time, onUndo, canUndo, onNew, children }) {
  return (
    <div className="sol-bar">
      <span className="sol-bar__info">
        <b>Jogo #{number}</b>
        <span>{moves} {moves === 1 ? 'jogada' : 'jogadas'}</span>
        <span>{time}</span>
      </span>
      <span className="sol-bar__btns">
        {children}
        <button type="button" className="mode-btn" onClick={onUndo} disabled={!canUndo} data-testid="sol-undo">Desfazer</button>
        <button type="button" className="share-btn" onClick={onNew} data-testid="sol-new">Novo jogo</button>
      </span>
    </div>
  )
}

export function WinPanel({ moves, time, onNew }) {
  return (
    <div className="sol-win" data-testid="sol-win">
      <h3>Ganhaste! 🎉</h3>
      <p>{moves} jogadas em {time}.</p>
      <button type="button" className="share-btn" onClick={onNew}>Jogar outra vez</button>
    </div>
  )
}
