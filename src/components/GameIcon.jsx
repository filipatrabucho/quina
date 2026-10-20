// Mini-logos de cada jogo: um azulejo de cor sólida e um desenho simples.
const THEMES = {
  palavras: '#7C5CE0',
  fiada: '#2E9E5B',
  quatro: '#2F80ED',
  galo: '#F2994A',
  xadrez: '#3A3F58',
  memes: '#E84393',
  naval: '#1E6FA8',
  stop: '#E2A400',
  cartas: '#D93644',
  snake: '#16A39A',
  memoria: '#0EA5E9',
  noventa: '#5B21B6',
  verdades: '#4F46E5',
  frase: '#059669',
  emojis: '#FF7A59',
  colonos: '#B5651D',
  bombas: '#2E7D4F',
  blackjack: '#14603C',
  poker: '#7A1F2B',
}

function Art({ game }) {
  switch (game) {
    case 'palavras':
      return (
        <g fontFamily="'Barlow Condensed', Inter, sans-serif" fontWeight="700" fontSize="11" textAnchor="middle">
          <rect x="7" y="17" width="10.5" height="12" rx="2.5" fill="#fff" />
          <rect x="18.75" y="17" width="10.5" height="12" rx="2.5" fill="#FFC542" />
          <rect x="30.5" y="17" width="10.5" height="12" rx="2.5" fill="#2FBF71" />
          <text x="12.25" y="26.8" fill="#7C5CE0">J</text>
          <text x="24" y="26.8" fill="#3B2A00">O</text>
          <text x="35.75" y="26.8" fill="#fff">G</text>
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
    case 'naval':
      return (
        <g>
          <path d="M8 34q4 3 8 0t8 0 8 0 8 0" stroke="#fff" strokeOpacity="0.55" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M10 26h28l-4 6H14z" fill="#fff" />
          <path d="M18 26v-6h10v6M22 20v-5h3v5" fill="#fff" />
          <circle cx="36" cy="13" r="3.2" fill="#FF4655" />
          <path d="M33 10l6 6M39 10l-6 6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )
    case 'stop':
      return (
        <g>
          <path d="M18 8h12l8 8v12l-8 8H18l-8-8V16z" fill="#fff" />
          <text x="24" y="28.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#E2A400" fontFamily="'Barlow Condensed', Inter, sans-serif">A</text>
        </g>
      )
    case 'cartas':
      return (
        <g>
          <rect x="9" y="12" width="15" height="22" rx="3" fill="#2E80F0" transform="rotate(-14 16 23)" />
          <rect x="17" y="11" width="15" height="22" rx="3" fill="#FFC542" />
          <rect x="25" y="12" width="15" height="22" rx="3" fill="#2FBF71" transform="rotate(14 32 23)" />
          <ellipse cx="24.5" cy="22" rx="5" ry="7" fill="#fff" transform="rotate(18 24.5 22)" />
          <text x="24.5" y="25.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#D93644" fontFamily="'Barlow Condensed', Inter, sans-serif">7</text>
        </g>
      )
    case 'snake':
      return (
        <g>
          <path d="M10 32h10a5 5 0 0 0 0-10h-4a5 5 0 0 1 0-10h14" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="31" cy="12" r="4.4" fill="#fff" />
          <circle cx="32.4" cy="11" r="1.2" fill="#0B4F4A" />
          <circle cx="36" cy="31" r="3.4" fill="#FF4655" />
          <path d="M36 27.6v-2.4" stroke="#7CF0B0" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )
    case 'memoria':
      return (
        <g>
          <rect x="8" y="12" width="15" height="22" rx="3" fill="#fff" fillOpacity="0.25" transform="rotate(-8 15 23)" />
          <path d="M11 17l9 12M20 17l-9 12" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.4" transform="rotate(-8 15 23)" />
          <rect x="25" y="12" width="15" height="22" rx="3" fill="#fff" transform="rotate(8 32 23)" />
          <path d="M32.5 19.5c-1.6-2.6-6-1.4-5 2 .7 2.4 5 5.5 5 5.5s4.3-3.1 5-5.5c1-3.4-3.4-4.6-5-2z" fill="#FF4655" transform="rotate(8 32 23)" />
        </g>
      )
    case 'noventa':
      return (
        <g>
          <rect x="11" y="9" width="20" height="28" rx="3" fill="#fff" fillOpacity="0.3" transform="rotate(-10 21 23)" />
          <rect x="16" y="10" width="21" height="29" rx="3" fill="#fff" />
          <text x="26.5" y="30" textAnchor="middle" fontSize="15" fontWeight="700" fill="#5B21B6" fontFamily="'Barlow Condensed', Inter, sans-serif">99</text>
          <text x="19.5" y="16.5" fontSize="6" fontWeight="700" fill="#FF4655" fontFamily="Inter, sans-serif">♥</text>
        </g>
      )
    case 'verdades':
      return (
        <g strokeLinecap="round" strokeLinejoin="round">
          {[13, 22, 31].map((y, i) => (
            <g key={y}>
              <rect x="9" y={y} width="30" height="6.5" rx="3.25" fill="#fff" fillOpacity={i === 1 ? 1 : 0.85} />
              {i === 1 ? (
                <path d={`M31.5 ${y + 1.6}l3.4 3.4M34.9 ${y + 1.6}l-3.4 3.4`} stroke="#FF4655" strokeWidth="1.8" />
              ) : (
                <path d={`M31 ${y + 3.4}l1.6 1.6 3-3.2`} stroke="#2FBF71" strokeWidth="1.8" fill="none" />
              )}
              <rect x="12" y={y + 2.5} width="15" height="1.6" rx="0.8" fill="#4F46E5" fillOpacity="0.45" />
            </g>
          ))}
        </g>
      )
    case 'frase':
      return (
        <g>
          <path d="M9 13a4 4 0 0 1 4-4h22a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H20l-7 6v-6a4 4 0 0 1-4-4z" fill="#fff" />
          <rect x="14" y="15" width="16" height="2.4" rx="1.2" fill="#059669" fillOpacity="0.55" />
          <circle cx="16" cy="23" r="1.7" fill="#059669" />
          <circle cx="21.5" cy="23" r="1.7" fill="#059669" />
          <circle cx="27" cy="23" r="1.7" fill="#059669" />
        </g>
      )
    case 'emojis':
      return (
        <g>
          <circle cx="21" cy="26" r="12" fill="#FFD23F" />
          <path d="M14.5 22.5c.6-2.2 3.6-2.4 4 0 .4-2.4 3.4-2.2 4 0-.3 1.8-4 4-4 4s-3.7-2.2-4-4z" fill="#FF4655" transform="translate(-1 0)" />
          <path d="M22.5 22.5c.6-2.2 3.6-2.4 4 0 .4-2.4 3.4-2.2 4 0-.3 1.8-4 4-4 4s-3.7-2.2-4-4z" fill="#FF4655" transform="translate(-1 0)" />
          <path d="M15.5 30q5.5 4.5 11 0" stroke="#3B2400" strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="35" cy="13" r="6.5" fill="#fff" />
          <text x="35" y="16.4" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#FF7A59" fontFamily="'Barlow Condensed', Inter, sans-serif">?</text>
        </g>
      )
    case 'colonos':
      return (
        <g>
          {[[24, 15, '#2E7D32'], [16.2, 28.5, '#E8B730'], [31.8, 28.5, '#868E9C']].map(([cx, cy, fill]) => (
            <polygon key={cx + cy} points={[0, 1, 2, 3, 4, 5].map((k) => { const a = ((60 * k - 90) * Math.PI) / 180; return `${(cx + 8.4 * Math.cos(a)).toFixed(2)},${(cy + 8.4 * Math.sin(a)).toFixed(2)}` }).join(' ')} fill={fill} stroke="#F4E6C3" strokeWidth="1.3" />
          ))}
          <path d="M20.5 26.5v-3.6l3.5-3 3.5 3v3.6z" fill="#fff" stroke="#3E2C17" strokeWidth="0.9" strokeLinejoin="round" />
        </g>
      )
    case 'blackjack':
      return (
        <g fontFamily="'Barlow Condensed', Inter, sans-serif" fontWeight="700">
          <rect x="9" y="12" width="17" height="24" rx="3" fill="#fff" transform="rotate(-12 17 24)" />
          <text x="13" y="24" fontSize="10" fill="#15151C" transform="rotate(-12 17 24)">A</text>
          <text x="15" y="33" fontSize="9" fill="#15151C" transform="rotate(-12 17 24)">♠</text>
          <rect x="21" y="11" width="17" height="24" rx="3" fill="#fff" transform="rotate(10 30 23)" />
          <text x="25" y="23" fontSize="10" fill="#D7263D" transform="rotate(10 30 23)">K</text>
          <text x="27" y="32" fontSize="9" fill="#D7263D" transform="rotate(10 30 23)">♥</text>
          <text x="24" y="44.5" textAnchor="middle" fontSize="7.5" fill="#FFD23F">21</text>
        </g>
      )
    case 'poker':
      return (
        <g>
          <circle cx="16" cy="31" r="9" fill="#F2B53B" stroke="#fff" strokeWidth="2" strokeDasharray="3 2.6" />
          <circle cx="16" cy="31" r="4.4" fill="#fff" fillOpacity="0.35" />
          <rect x="20" y="9" width="17" height="24" rx="3" fill="#fff" transform="rotate(12 28 21)" />
          <text x="28" y="25" textAnchor="middle" fontSize="13" fill="#15151C" transform="rotate(12 28 21)" fontFamily="Inter, sans-serif">♠</text>
          <text x="23.5" y="17" fontSize="7" fontWeight="700" fill="#15151C" transform="rotate(12 28 21)" fontFamily="'Barlow Condensed', Inter, sans-serif">A</text>
        </g>
      )
    case 'bombas':
      return (
        <g>
          <circle cx="22" cy="27" r="11.5" fill="#15151C" />
          <circle cx="18" cy="23" r="3.2" fill="#fff" fillOpacity="0.28" />
          <rect x="19.5" y="13" width="7" height="5" rx="1.5" fill="#3A3F58" transform="rotate(35 23 15.5)" />
          <path d="M27 13q3-5 7-3" stroke="#F4E6C3" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M35.5 4.5l1.2 3.3 3.3 1.2-3.3 1.2-1.2 3.3-1.2-3.3-3.3-1.2 3.3-1.2z" fill="#FFC93C" />
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
