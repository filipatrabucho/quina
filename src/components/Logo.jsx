// Marca Tuga Games: o comando com as cores de Portugal e o nome tugagames.pt.
export function LogoMark({ size = 40, className = '' }) {
  return <img src="/logo-mark.png" width={Math.round(size * 1.93)} height={size} className={`logo-mark ${className}`} alt="" />
}

export default function Logo({ size = 34 }) {
  return (
    <span className="logo-full" aria-label="Tuga Games PT">
      <LogoMark size={size} />
      <span className="logo-word" aria-hidden="true">
        <span className="logo-word__tuga">tuga</span>
        <span className="logo-word__games">games</span>
        <span className="logo-word__pt">.pt</span>
      </span>
    </span>
  )
}
