const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
]

export default function Keyboard({ statuses, onKey }) {
  return (
    <div className="keyboard">
      {ROWS.map((row, ri) => (
        <div className="keyboard__row" key={ri}>
          {row.map((key) => {
            const isWide = key === 'ENTER' || key === 'BACK'
            const status = statuses[key]
            return (
              <button
                key={key}
                className={[
                  'key',
                  isWide ? 'key--wide' : '',
                  status ? `key--${status}` : '',
                ].join(' ').trim()}
                onClick={() => onKey(key)}
                aria-label={key === 'BACK' ? 'Apagar' : key === 'ENTER' ? 'Confirmar' : key}
              >
                {key === 'BACK' ? '⌫' : key === 'ENTER' ? 'OK' : key}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
