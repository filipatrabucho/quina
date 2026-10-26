// A personagem: um astronauta redondinho com antena (desenho nosso).
export default function Astro({ color, dead = false, ghost = false, size = 32 }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={`imp-astro${ghost ? ' imp-astro--ghost' : ''}`} aria-hidden="true">
      {dead ? (
        <g>
          <ellipse cx="20" cy="30" rx="15" ry="7" fill={color} stroke="#14141C" strokeWidth="2" />
          <path d="M13 27l4 4m0-4l-4 4M23 27l4 4m0-4l-4 4" stroke="#14141C" strokeWidth="2" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <line x1="20" y1="9" x2="20" y2="3" stroke="#14141C" strokeWidth="2" />
          <circle cx="20" cy="3" r="2.6" fill="#FFC93C" stroke="#14141C" strokeWidth="1.5" />
          <circle cx="20" cy="22" r="13" fill={color} stroke="#14141C" strokeWidth="2" />
          <rect x="11" y="15" width="18" height="9" rx="4.5" fill="#BFE7FF" stroke="#14141C" strokeWidth="1.8" />
          <circle cx="16" cy="19.5" r="1.8" fill="#14141C" />
          <circle cx="24" cy="19.5" r="1.8" fill="#14141C" />
          <ellipse cx="14" cy="36" rx="4" ry="2.4" fill="#14141C" />
          <ellipse cx="26" cy="36" rx="4" ry="2.4" fill="#14141C" />
        </g>
      )}
    </svg>
  )
}
