import { useId } from 'react'

// Marca do Quina: a "quina" de um dado (5 pintas) em que a pinta do meio
// ganha um anel e uma perna — vira um Q.
export function LogoMark({ size = 40, className = '' }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`logo-mark ${className}`}
      role="img"
      aria-label="Quina"
    >
      <defs>
        <linearGradient id={`lg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B6CFF" />
          <stop offset="0.55" stopColor="#6A4CFF" />
          <stop offset="1" stopColor="#FF4DA6" />
        </linearGradient>
        <linearGradient id={`hl-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#lg-${id})`} />
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#hl-${id})`} />
      <rect x="2.75" y="2.75" width="58.5" height="58.5" rx="15.25" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="1.5" />
      <g fill="#fff">
        <circle cx="15" cy="15" r="4.6" />
        <circle cx="49" cy="15" r="4.6" />
        <circle cx="15" cy="49" r="4.6" />
        <circle cx="32" cy="32" r="5" />
      </g>
      <circle cx="32" cy="32" r="13.5" fill="none" stroke="#fff" strokeWidth="5.5" />
      <path d="M40.5 40.5 L49 49" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
      <circle cx="49.5" cy="49.5" r="5.2" fill="#2EE6D6" stroke="#fff" strokeWidth="2.2" />
    </svg>
  )
}

export default function Logo({ size = 36 }) {
  return (
    <span className="logo-full">
      <LogoMark size={size} />
      <span className="logo-word">
        QUI<span className="logo-word__accent">NA</span>
      </span>
    </span>
  )
}
