// A personagem: um astronauta redondinho com antena (desenho nosso), com chapéu opcional.
const INK = '#14141C'

function Hat({ hat }) {
  switch (hat) {
    case 'bone':
      return (
        <g>
          <path d="M9.5 12.5a10.5 8.5 0 0 1 21 0z" fill="#2F80ED" stroke={INK} strokeWidth="1.6" />
          <rect x="22" y="11" width="13" height="3" rx="1.5" fill="#1F5FB8" stroke={INK} strokeWidth="1.4" />
          <circle cx="20" cy="4.4" r="1.4" fill={INK} />
        </g>
      )
    case 'cartola':
      return (
        <g>
          <rect x="13" y="-2" width="14" height="12" rx="1.5" fill="#22222E" stroke={INK} strokeWidth="1.6" />
          <rect x="13" y="5.5" width="14" height="2.6" fill="#E5243B" />
          <rect x="8.5" y="9.5" width="23" height="3" rx="1.5" fill="#22222E" stroke={INK} strokeWidth="1.4" />
        </g>
      )
    case 'coroa':
      return (
        <g>
          <path d="M11 11.5L11.5 2l4.5 4.5L20 0l4 6.5L28.5 2l.5 9.5z" fill="#FFC93C" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="20" cy="8" r="1.6" fill="#E5243B" />
          <circle cx="14.5" cy="8.6" r="1.1" fill="#2F80ED" />
          <circle cx="25.5" cy="8.6" r="1.1" fill="#2FBF71" />
        </g>
      )
    case 'festa':
      return (
        <g>
          <path d="M13 11.5L20 -3l7 14.5z" fill="#EC4899" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M15.6 6l7.4 2.6M17.6 1.8l4.2 1.5" stroke="#FFC93C" strokeWidth="1.6" />
          <circle cx="20" cy="-3.5" r="2.2" fill="#FFC93C" stroke={INK} strokeWidth="1.2" />
        </g>
      )
    case 'gorro':
      return (
        <g>
          <path d="M9.5 12a10.5 10 0 0 1 21 0z" fill="#2FBF71" stroke={INK} strokeWidth="1.6" />
          <rect x="9" y="9.5" width="22" height="4" rx="2" fill="#1E8A50" stroke={INK} strokeWidth="1.4" />
          <circle cx="20" cy="1.6" r="2.6" fill="#F5F5F5" stroke={INK} strokeWidth="1.3" />
        </g>
      )
    case 'cowboy':
      return (
        <g>
          <path d="M13 10c0-6 2-9 7-9s7 3 7 9z" fill="#A86B34" stroke={INK} strokeWidth="1.6" />
          <path d="M4 10.5c3 3.5 29 3.5 32 0-3 1-29 1-32 0z" fill="#8A5528" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
          <rect x="13" y="7" width="14" height="2" fill="#5A3518" />
        </g>
      )
    case 'chef':
      return (
        <g>
          <circle cx="14.5" cy="4" r="4.4" fill="#fff" stroke={INK} strokeWidth="1.4" />
          <circle cx="25.5" cy="4" r="4.4" fill="#fff" stroke={INK} strokeWidth="1.4" />
          <circle cx="20" cy="1.5" r="5" fill="#fff" stroke={INK} strokeWidth="1.4" />
          <rect x="13" y="5" width="14" height="7" rx="1" fill="#fff" stroke={INK} strokeWidth="1.4" />
        </g>
      )
    case 'flor':
      return (
        <g>
          <line x1="20" y1="10" x2="20" y2="4" stroke="#1E8A50" strokeWidth="1.8" />
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="20" cy="0.2" rx="2.1" ry="3.2" fill="#FF7A9C" stroke={INK} strokeWidth="1" transform={`rotate(${a} 20 3)`} />
          ))}
          <circle cx="20" cy="3" r="1.9" fill="#FFC93C" stroke={INK} strokeWidth="1" />
        </g>
      )
    case 'auscultadores':
      return (
        <g>
          <path d="M7.5 20a12.5 12.5 0 0 1 25 0" fill="none" stroke="#22222E" strokeWidth="2.6" />
          <rect x="4.5" y="16" width="5" height="9" rx="2.2" fill="#E5243B" stroke={INK} strokeWidth="1.4" />
          <rect x="30.5" y="16" width="5" height="9" rx="2.2" fill="#E5243B" stroke={INK} strokeWidth="1.4" />
        </g>
      )
    default:
      return null
  }
}

export default function Astro({ color, hat = null, dead = false, ghost = false, size = 32 }) {
  const onTop = hat && hat !== 'auscultadores'
  return (
    <svg viewBox={hat && !dead ? "-3 -6 46 46" : "0 0 40 40"} width={size} height={size} className={`imp-astro${ghost ? ' imp-astro--ghost' : ''}`} aria-hidden="true">
      {dead ? (
        <g>
          <ellipse cx="20" cy="30" rx="15" ry="7" fill={color} stroke={INK} strokeWidth="2" />
          <path d="M13 27l4 4m0-4l-4 4M23 27l4 4m0-4l-4 4" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          {!onTop && (
            <>
              <line x1="20" y1="9" x2="20" y2="3" stroke={INK} strokeWidth="2" />
              <circle cx="20" cy="3" r="2.6" fill="#FFC93C" stroke={INK} strokeWidth="1.5" />
            </>
          )}
          <circle cx="20" cy="22" r="13" fill={color} stroke={INK} strokeWidth="2" />
          <rect x="11" y="15" width="18" height="9" rx="4.5" fill="#BFE7FF" stroke={INK} strokeWidth="1.8" />
          <circle cx="16" cy="19.5" r="1.8" fill={INK} />
          <circle cx="24" cy="19.5" r="1.8" fill={INK} />
          <ellipse cx="14" cy="36" rx="4" ry="2.4" fill={INK} />
          <ellipse cx="26" cy="36" rx="4" ry="2.4" fill={INK} />
          {hat && <Hat hat={hat} />}
        </g>
      )}
    </svg>
  )
}
