// Marca do Quina: a "quina" de um dado (5 pintas) em que a pinta do meio
// ganha um anel e uma perna, vira um Q.
export function LogoMark({ size = 40, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={`logo-mark ${className}`} role="img" aria-label="Quina">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#FF4655" />
      <g fill="#fff">
        <circle cx="15" cy="15" r="4.6" />
        <circle cx="49" cy="15" r="4.6" />
        <circle cx="15" cy="49" r="4.6" />
        <circle cx="32" cy="32" r="5" />
        <circle cx="49.5" cy="49.5" r="5" />
      </g>
      <circle cx="32" cy="32" r="13.5" fill="none" stroke="#fff" strokeWidth="5.5" />
      <path d="M40.5 40.5 L48 48" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

export default function Logo({ size = 34 }) {
  return (
    <span className="logo-full">
      <LogoMark size={size} />
      <span className="logo-word">Quina</span>
    </span>
  )
}
