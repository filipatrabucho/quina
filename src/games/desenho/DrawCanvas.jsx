import { useCallback, useEffect, useRef } from 'react'
import { W, H, encodePoints, decodePoints } from './desenhoLogic.js'

export const COLORS = ['#14141C', '#FFFFFF', '#8A8F9E', '#E5243B', '#FF7A1A', '#F2B53B', '#2FBF71', '#1ABC9C', '#2F80ED', '#8E44AD', '#EC4899', '#8B5A2B']
export const SIZES = [4, 10, 24]
const SEND_MS = 90

function drawStroke(ctx, pts, c, w) {
  if (!pts.length) return
  ctx.strokeStyle = c
  ctx.fillStyle = c
  ctx.lineWidth = w
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (pts.length === 1) {
    ctx.beginPath()
    ctx.arc(pts[0][0], pts[0][1], w / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.stroke()
}

// Área de desenho (1000x750 lógicos). Quem desenha manda os traços aos bocados
// (onStroke); toda a gente desenha o que vem no estado (strokes).
export default function DrawCanvas({ strokes, canDraw, color, size, onStroke }) {
  const ref = useRef(null)
  const local = useRef(null) // traço a ser feito agora: { sid, c, w, pts, sent }
  const timer = useRef(null)

  const redraw = useCallback(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, W, H)
    const mine = local.current
    for (const s of strokes) {
      if (mine && s.sid === mine.sid) continue
      drawStroke(ctx, decodePoints(s.p), s.c, s.w)
    }
    if (mine) drawStroke(ctx, mine.pts, mine.c, mine.w)
  }, [strokes])

  useEffect(() => {
    // o traço já chegou todo ao estado: deixa de ser "local"
    const mine = local.current
    if (mine && mine.done) {
      const s = strokes.find((x) => x.sid === mine.sid)
      if (!s || decodePoints(s.p).length >= mine.pts.length) local.current = null
    }
    redraw()
  }, [strokes, redraw])

  const flush = useCallback(() => {
    const mine = local.current
    if (!mine || mine.sent >= mine.pts.length) return
    onStroke({ sid: mine.sid, c: mine.c, w: mine.w, p: encodePoints(mine.pts.slice(mine.sent)) })
    mine.sent = mine.pts.length
  }, [onStroke])
  useEffect(() => () => clearInterval(timer.current), [])

  const point = (e) => {
    const r = ref.current.getBoundingClientRect()
    return [Math.max(0, Math.min(W - 1, ((e.clientX - r.left) / r.width) * W)), Math.max(0, Math.min(H - 1, ((e.clientY - r.top) / r.height) * H))]
  }
  const down = (e) => {
    if (!canDraw) return
    e.preventDefault()
    ref.current.setPointerCapture?.(e.pointerId)
    flush()
    local.current = { sid: Math.random().toString(36).slice(2, 10), c: color, w: size, pts: [point(e)], sent: 0 }
    redraw()
    clearInterval(timer.current)
    timer.current = setInterval(flush, SEND_MS)
  }
  const move = (e) => {
    const mine = local.current
    if (!canDraw || !mine || mine.done) return
    const p = point(e)
    const q = mine.pts[mine.pts.length - 1]
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 3) return
    mine.pts.push(p)
    const ctx = ref.current.getContext('2d')
    drawStroke(ctx, [q, p], mine.c, mine.w)
  }
  const up = () => {
    const mine = local.current
    if (!mine || mine.done) return
    clearInterval(timer.current)
    flush()
    mine.done = true
  }

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      className={`dw-canvas${canDraw ? ' dw-canvas--draw' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      data-testid="dw-canvas"
    />
  )
}

export function Tools({ color, setColor, size, setSize, onUndo, onClear, canUndo }) {
  return (
    <div className="dw-tools" data-testid="dw-tools">
      <div className="dw-colors">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`dw-color${color === c ? ' dw-color--on' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
            aria-label={c === '#FFFFFF' ? 'Borracha (branco)' : `Cor ${c}`}
            title={c === '#FFFFFF' ? 'Borracha' : undefined}
            data-testid={`dw-color-${c.slice(1)}`}
          />
        ))}
      </div>
      <div className="dw-sizes">
        {SIZES.map((s) => (
          <button key={s} type="button" className={`dw-size${size === s ? ' dw-size--on' : ''}`} onClick={() => setSize(s)} aria-label={`Grossura ${s}`}>
            <i style={{ width: Math.max(4, s / 1.6), height: Math.max(4, s / 1.6) }} />
          </button>
        ))}
        <button type="button" className="mode-btn" onClick={onUndo} disabled={!canUndo} data-testid="dw-undo">Desfazer</button>
        <button type="button" className="mode-btn" onClick={onClear} disabled={!canUndo} data-testid="dw-clear">Apagar tudo</button>
      </div>
    </div>
  )
}
