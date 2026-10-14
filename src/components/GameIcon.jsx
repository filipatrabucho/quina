import { useId } from 'react'

// Mini-logos de cada jogo: um azulejo com gradiente e um desenho simples.
const THEMES = {
  palavras: ['#7B5CFF', '#4B32C8'],
  fiada: ['#FF9F43', '#FF4D7A'],
  quatro: ['#2EC5FF', '#3B5BFF'],
  galo: ['#B8F34A', '#21B573'],
  xadrez: ['#4A4F8C', '#1E2147'],
  memes: ['#FF4DA6', '#FF9F43'],
}

function Art({ game }) {
  switch (game) {
    case 'palavras':
      return (
        <g fontFamily="'Chakra Petch', 'Work Sans', sans-serif" fontWeight="700" fontSize="11" textAnchor="middle">
          <rect x="7" y="17" width="10.5" height="12" rx="2.5" fill="#fff" />
          <rect x="18.75" y="17" width="10.5" height="12" rx="2.5" fill="#FF9F43" />
          <rect x="30.5" y="17" width="10.5" height="12" rx="2.5" fill="#2EE6D6" />
          <text x="12.25" y="26.8" fill="#4B32C8">Q</text>
          <text x="24" y="26.8" fill="#fff">U</text>
          <text x="35.75" y="26.8" fill="#0F3B46">I</text>
          <rect x="7" y="31.5" width="34" height="2.5" rx="1.25" fill="#fff" opacity="0.35" />
        </g>
      )
    case 'fiada':
      return (
        <g fontFamily="'Chakra Petch', 'Work Sans', sans-serif" fontWeight="700" fontSize="9" textAnchor="middle">
          <rect x="7" y="27" width="10" height="11" rx="2.5" fill="#fff" />
          <rect x="19" y="20" width="10" height="11" rx="2.5" fill="#fff" />
          <rect x="31" y="13" width="10" height="11" rx="2.5" fill="#fff" />
          <text x="12" y="35.5" fill="#FF4D7A">3</text>
          <text x="24" y="28.5" fill="#FF7A55">7</text>
          <text x="36" y="21.5" fill="#FF9F43">12</text>
        </g>
      )
    case 'quatro':
      return (
        <g>
          <rect x="7" y="9" width="34" height="30" rx="5" fill="#fff" fillOpacity="0.18" />
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => {
              const win = r + c === 3
              const other = (r === 3 && c === 3) || (r === 2 && c === 2) || (r === 3 && c === 2)
              return (
                <circle
                  key={`${r}${c}`}
                  cx={12.5 + c * 7.7}
                  cy={14 + r * 6.9}
                  r="2.9"
                  fill={win ? '#FFD23F' : other ? '#FF5470' : '#0E1A4A'}
                  fillOpacity={win || other ? 1 : 0.35}
                />
              )
            })
          )}
        </g>
      )
    case 'galo':
      return (
        <g stroke="#fff" strokeLinecap="round">
          <path d="M19 9v30M29 9v30M9 19h30M9 29h30" strokeWidth="2.6" strokeOpacity="0.7" />
          <path d="M11.5 11.5l5 5M16.5 11.5l-5 5M31.5 31.5l5 5M36.5 31.5l-5 5" strokeWidth="3" />
          <circle cx="24" cy="24" r="3" fill="none" strokeWidth="2.8" stroke="#0E3B22" />
          <circle cx="34" cy="14" r="2.8" fill="none" strokeWidth="2.6" stroke="#0E3B22" />
        </g>
      )
    case 'xadrez':
      return (
        <g>
          <rect x="8" y="30" width="32" height="10" rx="2" fill="#fff" fillOpacity="0.15" />
          <path
            d="M17 39h16v-3.2c0-1-.6-1.8-1.6-2.1l-1.2-.4c.8-3 2.4-5.2 2.9-8.6.6-4.4-1.6-9.1-6.2-11l-1.5-3.3-1.7 3.1c-1.6.3-3 1.1-4.2 2.2l-4 3.8c-.9.9-1 2.3-.2 3.2l.8.9c.7.8 1.9 1 2.8.4l3.1-1.9c-.4 2.5-2.4 4.7-4.2 6.8-1.5 1.7-1.8 3.8-1.8 5.8z"
            fill="#fff"
          />
          <circle cx="21.6" cy="19.5" r="1.3" fill="#1E2147" />
        </g>
      )
    case 'memes':
      return (
        <g>
          <circle cx="24" cy="24" r="14" fill="#FFD23F" />
          <path d="M16.5 21.5q2.5-3 5 0M26.5 21.5q2.5-3 5 0" stroke="#3B2400" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M16 26.5h16q-1 8-8 8t-8-8z" fill="#3B2400" />
          <path d="M19 30.5q5 3 10 0" stroke="#FF5470" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M11.5 22q-3 3-1 6M36.5 22q3 3 1 6" stroke="#2EE6D6" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </g>
      )
    default:
      return null
  }
}

export default function GameIcon({ game, size = 48, className = '' }) {
  const id = useId().replace(/:/g, '')
  const [a, b] = THEMES[game] || THEMES.palavras
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={`game-icon ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={`gi-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#gi-${id})`} />
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="1.5" />
      <Art game={game} />
    </svg>
  )
}

export { THEMES as GAME_THEMES }
