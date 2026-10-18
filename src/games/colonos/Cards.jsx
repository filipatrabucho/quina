import { useEffect, useState } from 'react'
import { RES_NAME, DEV_NAME } from './colonosLogic.js'

// Cores e desenhos das cartas do Colonos (SVG, sem imagens externas).
export const CARD_BG = {
  madeira: ['#3E9B45', '#1F5E25'],
  tijolo: ['#D86A3A', '#8F3A17'],
  la: ['#A4D46A', '#5E9A2E'],
  trigo: ['#F3C94B', '#C7921A'],
  minerio: ['#A3AAB7', '#5F6673'],
}

function ResourceArt({ res }) {
  switch (res) {
    case 'madeira':
      return (
        <g>
          <ellipse cx="24" cy="41" rx="19" ry="3" fill="rgba(0,0,0,0.2)" />
          {[[12, 30, 0.8], [36, 30, 0.8], [24, 26, 1]].map(([x, y, s]) => (
            <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
              <rect x="-1.6" y="6" width="3.2" height="8" rx="1" fill="#6D4321" />
              <path d="M0-16l9 12h-4l7 9H-12l7-9h-4z" fill="#174D1B" />
              <path d="M0-16l9 12h-4l7 9H0z" fill="#0F3913" />
            </g>
          ))}
        </g>
      )
    case 'tijolo':
      return (
        <g>
          <ellipse cx="24" cy="41" rx="18" ry="3" fill="rgba(0,0,0,0.2)" />
          {[[8, 30, 3], [8, 22, 2], [8, 14, 1]].map(([x0, y, row]) =>
            Array.from({ length: row === 1 ? 2 : row === 2 ? 3 : 4 }, (_, k) => {
              const w = row === 3 ? 8 : 8
              const off = row === 2 ? 4 : row === 1 ? 8 : 0
              return <rect key={`${row}-${k}`} x={x0 + off + k * 8.5} y={y} width={w} height="7" rx="1.2" fill={k % 2 ? '#9C3B15' : '#B8491D'} stroke="#5E2209" strokeWidth="0.6" />
            })
          )}
        </g>
      )
    case 'la':
      return (
        <g>
          <ellipse cx="24" cy="41" rx="16" ry="3" fill="rgba(0,0,0,0.2)" />
          <path d="M15 34v6M20 35v5M29 35v5M33 34v6" stroke="#2D2D2D" strokeWidth="2.2" strokeLinecap="round" />
          {[[16, 26], [22, 22], [29, 23], [33, 28], [27, 30], [19, 31], [24, 27]].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="6" fill="#FFFFFF" stroke="#E5E5E5" strokeWidth="0.6" />
          ))}
          <ellipse cx="38" cy="24" rx="4.5" ry="5.5" fill="#2D2D2D" />
          <ellipse cx="35.5" cy="20.5" rx="2" ry="1.2" fill="#2D2D2D" transform="rotate(-30 35.5 20.5)" />
          <circle cx="39.3" cy="23" r="0.9" fill="#fff" />
        </g>
      )
    case 'trigo':
      return (
        <g>
          <ellipse cx="24" cy="42" rx="12" ry="2.5" fill="rgba(0,0,0,0.2)" />
          {[-14, -6, 0, 6, 14].map((a, i) => (
            <g key={a} transform={`rotate(${a} 24 40)`}>
              <path d="M24 40V16" stroke="#8D6512" strokeWidth="1.4" />
              {[0, 1, 2, 3].map((k) => (
                <g key={k}>
                  <ellipse cx="21.6" cy={18 + k * 4.2} rx="2.2" ry="1.3" transform={`rotate(-35 21.6 ${18 + k * 4.2})`} fill={i % 2 ? '#FFE08A' : '#FBD35C'} stroke="#A57B14" strokeWidth="0.5" />
                  <ellipse cx="26.4" cy={18 + k * 4.2} rx="2.2" ry="1.3" transform={`rotate(35 26.4 ${18 + k * 4.2})`} fill={i % 2 ? '#FBD35C' : '#FFE08A'} stroke="#A57B14" strokeWidth="0.5" />
                </g>
              ))}
              <ellipse cx="24" cy="15" rx="1.4" ry="2.4" fill="#FFE08A" stroke="#A57B14" strokeWidth="0.5" />
            </g>
          ))}
          <rect x="19" y="30" width="10" height="3" rx="1" fill="#B5651D" />
        </g>
      )
    case 'minerio':
      return (
        <g>
          <ellipse cx="24" cy="41" rx="19" ry="3" fill="rgba(0,0,0,0.25)" />
          <path d="M6 40l8-15 6 5 7-13 7 9 4-3 6 17z" fill="#4B515C" />
          <path d="M20 30l7-13 7 9-6 14z" fill="#3A3F48" />
          <path d="M12 38l4-7 5 3-2 4z" fill="#5C6370" />
          <path d="M27 17l3 5-3 1z" fill="#fff" opacity="0.9" />
          <path d="M14 25l2 3-2 0.5z" fill="#fff" opacity="0.8" />
          <path d="M30 33l3-4 3 4-3 3z" fill="#6EC6FF" stroke="#1C6EA4" strokeWidth="0.6" />
          <path d="M17 36l2-3 2 3-2 2z" fill="#6EC6FF" stroke="#1C6EA4" strokeWidth="0.6" />
        </g>
      )
    default:
      return null
  }
}

// Carta de recurso. size: 'lg' (mão), 'md', 'xs' (ícone nos textos).
export function ResourceCard({ res, n, size = 'md', dim = false, pop = 0, label = true }) {
  const [a, b] = CARD_BG[res]
  return (
    <span
      className={`rcard rcard--${size}${dim ? ' rcard--dim' : ''}${n > 1 && size === 'lg' ? ' rcard--stack' : ''}`}
      style={{ '--c1': a, '--c2': b }}
      title={RES_NAME[res]}
      data-res={res}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true"><ResourceArt res={res} /></svg>
      {label && size !== 'xs' && <span className="rcard__name">{RES_NAME[res]}</span>}
      {n != null && n !== '' && size !== 'xs' && <b className="rcard__count">{n}</b>}
      {pop > 0 && <span key={pop} className="rcard__pop">+{pop}</span>}
    </span>
  )
}

// Ícone pequeno com número, para custos e trocas.
export function ResIcon({ res, n }) {
  return (
    <span className="rchip" title={RES_NAME[res]}>
      <ResourceCard res={res} size="xs" label={false} />
      {n != null && <b>{n}</b>}
    </span>
  )
}

const DEV_TEXT = {
  cavaleiro: 'Move o ladrão e rouba uma carta.',
  ponto: 'Vale 1 ponto de vitória.',
  estradas: 'Constrói 2 estradas grátis.',
  fartura: 'Recebe 2 cartas à escolha do banco.',
  monopolio: 'Fica com todas as cartas de um recurso.',
}

function DevArt({ type }) {
  switch (type) {
    case 'cavaleiro':
      return (
        <g>
          <path d="M24 8c-7 0-11 5-11 12v8h22v-8c0-7-4-12-11-12z" fill="#9AA3B2" stroke="#3B4150" strokeWidth="1.2" />
          <path d="M14 20h20v4H14z" fill="#3B4150" />
          <path d="M24 8v-3M21 5h6" stroke="#C62828" strokeWidth="2" strokeLinecap="round" />
          <path d="M13 28h22l-2 6H15z" fill="#7B8291" stroke="#3B4150" strokeWidth="1" />
          <path d="M36 12l6 28" stroke="#C9CED6" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M33 33h8" stroke="#8D6E0F" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      )
    case 'ponto':
      return (
        <g>
          <path d="M10 40V20h6v4h4v-8h8v8h4v-4h6v20z" fill="#C9B48A" stroke="#5E4A23" strokeWidth="1.2" />
          <path d="M21 40v-8a3 3 0 0 1 6 0v8z" fill="#5E4A23" />
          <path d="M24 3l2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.8-3.6 5.2-.8z" fill="#FFD23F" stroke="#B88A00" strokeWidth="0.8" />
        </g>
      )
    case 'estradas':
      return (
        <g>
          <path d="M6 40l12-28h12l12 28z" fill="#8D6E4E" />
          <path d="M24 14v6M24 24v6M24 34v5" stroke="#F4E6C3" strokeWidth="2" strokeLinecap="round" />
          <rect x="9" y="22" width="12" height="4" rx="1.5" transform="rotate(-62 15 24)" fill="#E53935" stroke="#7A1A18" strokeWidth="0.8" />
          <rect x="27" y="22" width="12" height="4" rx="1.5" transform="rotate(62 33 24)" fill="#E53935" stroke="#7A1A18" strokeWidth="0.8" />
        </g>
      )
    case 'fartura':
      return (
        <g>
          <path d="M8 26h32l-4 14H12z" fill="#B5651D" stroke="#6D3A10" strokeWidth="1.2" />
          <path d="M10 30h28M11 34h26" stroke="#6D3A10" strokeWidth="0.8" />
          <circle cx="16" cy="22" r="5" fill="#E53935" />
          <circle cx="25" cy="20" r="5.5" fill="#FBD35C" />
          <circle cx="33" cy="22" r="4.5" fill="#8CC152" />
          <path d="M25 14v-3" stroke="#3E7B1E" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )
    case 'monopolio':
      return (
        <g>
          <path d="M10 22l6 6 8-12 8 12 6-6-3 14H13z" fill="#FFD23F" stroke="#B88A00" strokeWidth="1.2" />
          <circle cx="10" cy="20" r="2" fill="#FFD23F" />
          <circle cx="24" cy="14" r="2" fill="#FFD23F" />
          <circle cx="38" cy="20" r="2" fill="#FFD23F" />
          <rect x="13" y="36" width="22" height="4" rx="1" fill="#B88A00" />
          <circle cx="20" cy="30" r="1.8" fill="#E53935" />
          <circle cx="28" cy="30" r="1.8" fill="#1E88E5" />
        </g>
      )
    default:
      return null
  }
}

export function DevCard({ type, count = 1, children, disabled }) {
  return (
    <div className={`dcard dcard--${type}${disabled ? ' dcard--disabled' : ''}`} data-testid={`dcard-${type}`}>
      {count > 1 && <b className="rcard__count">{count}</b>}
      <span className="dcard__title">{DEV_NAME[type]}</span>
      <svg viewBox="0 0 48 44" aria-hidden="true"><DevArt type={type} /></svg>
      <span className="dcard__text">{DEV_TEXT[type]}</span>
      {children}
    </div>
  )
}

const PIPS = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
}

export function Die({ value, red }) {
  return (
    <svg className={`die${red ? ' die--red' : ''}`} viewBox="0 0 100 100" aria-label={`Dado: ${value}`}>
      <rect x="4" y="4" width="92" height="92" rx="20" className="die__face" />
      {(PIPS[value] || []).map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="9" className="die__pip" />
      ))}
    </svg>
  )
}

// Os dois dados; quando muda o lançamento (rollKey) rodam durante meio segundo.
export function DicePair({ dice, rollKey, total }) {
  const [shown, setShown] = useState(dice || [1, 1])
  const [rolling, setRolling] = useState(false)
  useEffect(() => {
    if (!dice) return undefined
    setRolling(true)
    let ticks = 0
    const t = setInterval(() => {
      ticks++
      if (ticks >= 8) {
        clearInterval(t)
        setShown(dice)
        setRolling(false)
      } else setShown([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)])
    }, 70)
    return () => clearInterval(t)
  }, [rollKey]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!dice) return null
  return (
    <div className={`col-dice${rolling ? ' col-dice--rolling' : ''}${!rolling && total === 7 ? ' col-dice--seven' : ''}`} data-testid="col-dice">
      <Die value={shown[0]} />
      <Die value={shown[1]} red />
      {!rolling && <span className="col-dice__total">{total}</span>}
    </div>
  )
}
