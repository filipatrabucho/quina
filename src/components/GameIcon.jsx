// Mini-logos de cada jogo: um azulejo de cor sólida e um desenho simples.
const THEMES = {
  palavras: '#7C5CE0',
  fiada: '#2E9E5B',
  quatro: '#2F80ED',
  galo: '#F2994A',
  xadrez: '#3A3F58',
  memes: '#E84393',
}

function Art({ game }) {
  switch (game) {
    case 'palavras':
      return (
        <g fontFamily="'Barlow Condensed', Inter, sans-serif" fontWeight="700" fontSize="11" textAnchor="middle">
          <rect x="7" y="17" width="10.5" height="12" rx="2.5" fill="#fff" />
          <rect x="18.75" y="17" width="10.5" height="12" rx="2.5" fill="#FFC542" />
          <rect x="30.5" y="17" width="10.5" height="12" rx="2.5" fill="#2FBF71" />
          <text x="12.25" y="26.8" fill="#7C5CE0">Q</text>
          <text x="24" y="26.8" fill="#3B2A00">U</text>
          <text x="35.75" y="26.8" fill="#fff">I</text>
          <rect x="7" y="31.5" width="34" height="2.5" rx="1.25" fill="#fff" opacity="0.35" />
        </g>
      )
    case 'fiada':
      return (
        <g>
          {[[16, 30, '#fff'], [32, 18, '#FFE08A']].map(([cx, cy, fill]) => (
            <g key={cx} fill={fill}>
              <circle cx={cx - 4.2} cy={cy - 4.2} r="5" />
              <circle cx={cx + 4.2} cy={cy - 4.2} r="5" />
              <circle cx={cx - 4.2} cy={cy + 4.2} r="5" />
              <circle cx={cx + 4.2} cy={cy + 4.2} r="5" />
              <circle cx={cx} cy={cy} r="4.6" fill="#1E6B3E" />
            </g>
          ))}
          <text x="16" y="32.4" fontSize="6.5" fontWeight="700" textAnchor="middle" fill="#fff" fontFamily="'Barlow Condensed', sans-serif">3</text>
          <text x="32" y="20.4" fontSize="6.5" fontWeight="700" textAnchor="middle" fill="#fff" fontFamily="'Barlow Condensed', sans-serif">12</text>
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
                  fill={win ? '#FFD23F' : other ? '#FF4655' : '#0B2A66'}
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
          <circle cx="24" cy="24" r="3" fill="none" strokeWidth="2.8" stroke="#5A2600" />
          <circle cx="34" cy="14" r="2.8" fill="none" strokeWidth="2.6" stroke="#5A2600" />
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
          <circle cx="21.6" cy="19.5" r="1.3" fill="#3A3F58" />
        </g>
      )
    case 'memes':
      return (
        <g>
          <circle cx="24" cy="24" r="14" fill="#FFD23F" />
          <path d="M16.5 21.5q2.5-3 5 0M26.5 21.5q2.5-3 5 0" stroke="#3B2400" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M16 26.5h16q-1 8-8 8t-8-8z" fill="#3B2400" />
          <path d="M19 30.5q5 3 10 0" stroke="#FF5470" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </g>
      )
    default:
      return null
  }
}

export default function GameIcon({ game, size = 48, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={`game-icon ${className}`} aria-hidden="true">
      <rect width="48" height="48" rx="11" fill={THEMES[game] || THEMES.palavras} />
      <Art game={game} />
    </svg>
  )
}

export { THEMES as GAME_THEMES }
