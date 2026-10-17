// Medalha em forma de hexágono, com a cor do nível (estilo crachás da Steam).
const TIERS = {
  bronze: ['#E2A76F', '#9C5B2B'],
  prata: ['#E6EAF0', '#8D97A6'],
  ouro: ['#FFE07A', '#C98C12'],
  platina: ['#C9F3FF', '#5B8FD8'],
}

const ICONS = {
  star: 'M24 12l3.5 7.2 7.9 1.1-5.7 5.6 1.3 7.9L24 30l-7 3.8 1.3-7.9-5.7-5.6 7.9-1.1z',
  trophy: 'M17 13h14v5a7 7 0 0 1-14 0zM14 14h3v3a3 3 0 0 1-3-3zM34 14h-3v3a3 3 0 0 0 3-3zM22 25h4v5h-4zM18 31h12v3H18z',
  people: 'M19 23a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm10 0a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 33c0-4 3-7 7-7s7 3 7 7zm11.5 0c.4-2.7 2-5.2 4.5-6.5 1-.3 1.2-.5 1.5-.5 3.6 0 6.5 3 6.5 7z',
  door: 'M16 12h16v22H16zM19 15v16h10V15zM26 23a1.3 1.3 0 1 0 0 .1z',
  compass: 'M24 12a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5 7l-3 8-8 3 3-8z',
  flame: 'M24 11c2 5 8 7 8 14a8 8 0 0 1-16 0c0-4 2-6 4-8 0 3 1 5 3 5 0-4-1-7 1-11z',
  shield: 'M24 11l11 4v7c0 7-5 11-11 14-6-3-11-7-11-14v-7z',
  letters: 'M12 17h7v14h-7zM21 17h7v14h-7zM30 17h7v14h-7z',
  clover: 'M20 20a4.5 4.5 0 1 1 4-6.4A4.5 4.5 0 1 1 28 20a4.5 4.5 0 1 1-4 6.4A4.5 4.5 0 1 1 20 20zm4 6v9',
  grid: 'M20 12v24M28 12v24M12 20h24M12 28h24',
  discs: 'M17 17a3 3 0 1 0 .1 0zM24 24a3 3 0 1 0 .1 0zM31 31a3 3 0 1 0 .1 0zM31 17a3 3 0 1 0 .1 0z',
  knight: 'M18 35h13v-3c0-1-.5-1.6-1.4-2l-1-.3c.6-2.6 2-4.5 2.4-7.4.5-3.8-1.4-7.8-5.3-9.4l-1.3-2.8-1.4 2.6c-1.4.3-2.6 1-3.6 1.9l-3.4 3.3c-.8.8-.9 2-.2 2.8l.7.8c.6.7 1.6.9 2.4.3l2.7-1.6c-.3 2.1-2 4-3.6 5.8-1.3 1.5-1.5 3.3-1.5 5z',
  laugh: 'M24 12a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm-6 14h12a6 6 0 0 1-12 0zm1-5.5q2-2.5 4 0m2 0q2-2.5 4 0',
  crown: 'M12 30l2-14 6 6 4-9 4 9 6-6 2 14z',
  chat: 'M13 15h22v14H22l-6 5v-5h-3z',
}
const STROKE_ICONS = new Set(['grid', 'clover'])

export default function MedalBadge({ medal, earned = true, size = 56, title }) {
  const [light, dark] = TIERS[medal.tier] || TIERS.bronze
  const gid = `m-${medal.key}-${earned ? 1 : 0}`
  const stroke = STROKE_ICONS.has(medal.icon)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`medal${earned ? '' : ' medal--locked'}`}
      role="img"
      aria-label={title || medal.name}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={earned ? light : '#3A3A48'} />
          <stop offset="1" stopColor={earned ? dark : '#22222C'} />
        </linearGradient>
      </defs>
      <path d="M24 2l19 11v22L24 46 5 35V13z" fill={`url(#${gid})`} />
      <path d="M24 6l15.5 9v18L24 42 8.5 33V15z" fill="rgba(0,0,0,0.22)" />
      <path
        d={ICONS[medal.icon] || ICONS.star}
        fill={stroke ? 'none' : earned ? '#fff' : '#6E6E80'}
        stroke={stroke ? (earned ? '#fff' : '#6E6E80') : 'none'}
        strokeWidth={stroke ? 2.6 : 0}
        strokeLinecap="round"
        fillRule="evenodd"
      />
    </svg>
  )
}
