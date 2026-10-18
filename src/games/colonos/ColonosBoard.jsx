import { HEXES, VERTICES, EDGES } from './board.js'
import { PIPS } from './colonosLogic.js'

export const PLAYER_COLORS = ['#E53935', '#1E88E5', '#FB8C00', '#ECEFF1']
export const TILE_COLOR = { madeira: '#2E7D32', tijolo: '#C1582B', la: '#8CC152', trigo: '#E8B730', minerio: '#868E9C', deserto: '#D9C08C' }
const RES_DOT = { madeira: '#2E7D32', tijolo: '#C1582B', la: '#8CC152', trigo: '#E8B730', minerio: '#868E9C' }

const hexPoints = (h, s = 0.97) =>
  [0, 1, 2, 3, 4, 5]
    .map((k) => {
      const a = ((60 * k - 90) * Math.PI) / 180
      return `${(h.x + s * Math.cos(a)).toFixed(3)},${(h.y + s * Math.sin(a)).toFixed(3)}`
    })
    .join(' ')

function TileArt({ res, x, y }) {
  const t = `translate(${x} ${y - 0.5}) scale(0.11)`
  switch (res) {
    case 'madeira':
      return (
        <g transform={t} fill="#1B5E20">
          <path d="M-3 2L0-4l3 6z" />
          <path d="M1 3l2.6-5 2.6 5z" opacity="0.8" />
          <path d="M-6.2 3l2.6-5 2.6 5z" opacity="0.8" />
        </g>
      )
    case 'tijolo':
      return (
        <g transform={t} fill="#8E3B17">
          <rect x="-5" y="-3" width="4.6" height="2.4" rx="0.4" />
          <rect x="0.4" y="-3" width="4.6" height="2.4" rx="0.4" />
          <rect x="-2.3" y="0" width="4.6" height="2.4" rx="0.4" />
        </g>
      )
    case 'la':
      return (
        <g transform={t}>
          <ellipse cx="0" cy="0" rx="4" ry="2.8" fill="#fff" />
          <circle cx="4" cy="-1" r="1.6" fill="#37474F" />
          <path d="M-2 2.4v2M1.5 2.4v2" stroke="#37474F" strokeWidth="0.9" />
        </g>
      )
    case 'trigo':
      return (
        <g transform={t} stroke="#8D6E0F" strokeWidth="0.9" fill="none" strokeLinecap="round">
          <path d="M0 4V-4M-3 4l1-7M3 4l-1-7" />
          <path d="M0-2l-1.5-1.2M0-2l1.5-1.2M0 0l-1.5-1.2M0 0l1.5-1.2" />
        </g>
      )
    case 'minerio':
      return (
        <g transform={t}>
          <path d="M-6 3l4-7 3 4 2-3 4 6z" fill="#4B5260" />
          <path d="M-2-4l1.2 2-1.6.4z" fill="#fff" />
        </g>
      )
    case 'deserto':
      return (
        <g transform={t} fill="#B9975B">
          <path d="M-6 3q3-4 6 0t6 0z" />
          <circle cx="3" cy="-2" r="1.6" fill="#E9A23B" />
        </g>
      )
    default:
      return null
  }
}

function House({ x, y, color, city }) {
  const s = city ? 0.3 : 0.22
  const d = city
    ? `M${-1.2 * s} ${0.9 * s}V${-0.2 * s}L${-0.6 * s} ${-0.8 * s}L0 ${-0.2 * s}V${-1 * s}H${1.2 * s}V${0.9 * s}Z`
    : `M${-s} ${0.8 * s}V${-0.2 * s}L0 ${-s}L${s} ${-0.2 * s}V${0.8 * s}Z`
  return <path d={d} transform={`translate(${x} ${y})`} fill={color} stroke="#111" strokeWidth="0.05" strokeLinejoin="round" />
}

// Desenho do tabuleiro. `targets` diz o que dá para clicar agora.
export default function ColonosBoard({ game, colorOf, targets, onVertex, onEdge, onHex }) {
  const { tiles, robber, ports } = game.board
  return (
    <svg className="colonos-board" viewBox="-5.7 -5.25 11.4 10.5" role="img" aria-label="Tabuleiro">
      <defs>
        <radialGradient id="col-sea" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#1f6fa8" />
          <stop offset="100%" stopColor="#0c3b63" />
        </radialGradient>
      </defs>
      <rect x="-5.7" y="-5.25" width="11.4" height="10.5" rx="0.6" fill="url(#col-sea)" />
      <polygon points={hexPoints({ x: 0, y: 0 }, 5.05)} fill="#E6D3A3" transform="rotate(30)" opacity="0.9" />

      {ports.map(({ edge, type }) => {
        const e = EDGES[edge]
        const len = Math.hypot(e.x, e.y)
        const px = e.x * (1 + 0.55 / len)
        const py = e.y * (1 + 0.55 / len)
        return (
          <g key={edge} className="colonos-port">
            {[e.a, e.b].map((v) => (
              <line key={v} x1={px} y1={py} x2={VERTICES[v].x} y2={VERTICES[v].y} stroke="#C9B48A" strokeWidth="0.07" />
            ))}
            <circle cx={px} cy={py} r="0.36" fill={type === '3:1' ? '#F5EBD2' : RES_DOT[type]} stroke="#3E2C17" strokeWidth="0.04" />
            <text x={px} y={py + 0.11} textAnchor="middle" fontSize="0.3" fontWeight="700" fill={type === '3:1' ? '#3E2C17' : '#fff'}>
              {type === '3:1' ? '3:1' : '2:1'}
            </text>
          </g>
        )
      })}

      {HEXES.map((h, i) => {
        const t = tiles[i]
        const clickable = targets?.hexes?.includes(i)
        return (
          <g key={i} className={clickable ? 'colonos-hex colonos-hex--target' : 'colonos-hex'} onClick={clickable ? () => onHex(i) : undefined} data-testid={`hex-${i}`}>
            <polygon points={hexPoints(h)} fill={TILE_COLOR[t.res]} stroke="#F4E6C3" strokeWidth="0.06" />
            <TileArt res={t.res} x={h.x} y={h.y} />
            {t.num && (
              <g>
                <circle cx={h.x} cy={h.y + 0.12} r="0.36" fill="#FFF6DF" stroke="#7A5C2E" strokeWidth="0.03" />
                <text x={h.x} y={h.y + 0.23} textAnchor="middle" fontSize="0.34" fontWeight="800" fill={t.num === 6 || t.num === 8 ? '#C62828' : '#2B2118'}>
                  {t.num}
                </text>
                {Array.from({ length: PIPS[t.num] }, (_, k) => (
                  <circle key={k} cx={h.x + (k - (PIPS[t.num] - 1) / 2) * 0.075} cy={h.y + 0.34} r="0.025" fill={t.num === 6 || t.num === 8 ? '#C62828' : '#2B2118'} />
                ))}
              </g>
            )}
            {robber === i && (
              <g className="colonos-robber" transform={`translate(${h.x + (t.num ? 0.5 : 0)} ${h.y + 0.05})`}>
                <ellipse cx="0" cy="0.32" rx="0.2" ry="0.07" fill="rgba(0,0,0,0.35)" />
                <path d="M-0.17 0.3q-0.03-0.32 0.08-0.42a0.13 0.13 0 1 1 0.18 0q0.11 0.1 0.08 0.42z" fill="#1F1F24" stroke="#000" strokeWidth="0.02" />
              </g>
            )}
            {clickable && <polygon points={hexPoints(h, 0.9)} fill="rgba(255,210,63,0.18)" stroke="#FFD23F" strokeWidth="0.07" className="colonos-pulse" />}
          </g>
        )
      })}

      {EDGES.map((e, i) => {
        const owner = game.roads[i]
        const A = VERTICES[e.a]
        const B = VERTICES[e.b]
        const x1 = A.x + (B.x - A.x) * 0.14
        const y1 = A.y + (B.y - A.y) * 0.14
        const x2 = B.x + (A.x - B.x) * 0.14
        const y2 = B.y + (A.y - B.y) * 0.14
        if (owner) {
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#111" strokeWidth="0.2" strokeLinecap="round" />
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colorOf(owner)} strokeWidth="0.13" strokeLinecap="round" />
            </g>
          )
        }
        if (!targets?.edges?.includes(i)) return null
        return (
          <g key={i} className="colonos-target" onClick={() => onEdge(i)} data-testid={`edge-${i}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="0.4" />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFD23F" strokeWidth="0.11" strokeLinecap="round" strokeDasharray="0.12 0.1" className="colonos-pulse" />
          </g>
        )
      })}

      {VERTICES.map((v, i) => {
        const b = game.buildings[i]
        const target = targets?.vertices?.includes(i)
        return (
          <g key={i}>
            {b && <House x={v.x} y={v.y} color={colorOf(b.owner)} city={b.kind === 'cidade'} />}
            {target && (
              <g className="colonos-target" onClick={() => onVertex(i)} data-testid={`vertex-${i}`}>
                <circle cx={v.x} cy={v.y} r="0.42" fill="transparent" />
                <circle cx={v.x} cy={v.y} r="0.15" fill="rgba(255,210,63,0.85)" stroke="#fff" strokeWidth="0.04" className="colonos-pulse" />
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
