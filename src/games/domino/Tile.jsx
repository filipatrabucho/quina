// Posição dos pontos numa grelha 3×3 (0..8, por linhas).
const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }

function Half({ n }) {
  return (
    <span className="dm-half">
      {Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[n].includes(i) ? 'on' : ''} />)}
    </span>
  )
}

// Pedra: `l` e `r` pela ordem em que se veem; vertical = um por cima do outro.
export default function Tile({ l, r, vertical = false, className = '', ...rest }) {
  return (
    <span className={`dm-tile${vertical ? ' dm-tile--v' : ''} ${className}`} aria-label={`${l} e ${r}`} {...rest}>
      <Half n={l} />
      <span className="dm-tile__bar" />
      <Half n={r} />
    </span>
  )
}
