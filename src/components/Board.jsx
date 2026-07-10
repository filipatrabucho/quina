import { WORD_LENGTH } from '../utils/gameLogic.js'

export default function Board({
  guesses,
  statusesPerGuess,
  currentGuess = '',
  maxGuesses,
  shakeRow,
  invalidRow,
  solved,
  compact,
}) {
  const rows = []

  for (let i = 0; i < maxGuesses; i++) {
    if (i < guesses.length) {
      rows.push(
        <Row
          key={i}
          letters={guesses[i].split('')}
          statuses={statusesPerGuess[i]}
          revealed
          delayReveal
          compact={compact}
        />
      )
    } else if (i === guesses.length && !solved) {
      rows.push(
        <Row
          key={i}
          letters={currentGuess.split('')}
          statuses={[]}
          shake={shakeRow}
          invalid={invalidRow}
          compact={compact}
        />
      )
    } else {
      rows.push(<Row key={i} letters={[]} statuses={[]} compact={compact} />)
    }
  }

  return (
    <div
      className={`board${compact ? ' board--compact' : ''}${solved ? ' board--solved' : ''}`}
      style={{ '--rows': maxGuesses }}
    >
      {solved && <div className="board__solved-badge">✓</div>}
      {rows}
    </div>
  )
}

function Row({ letters, statuses, revealed, delayReveal, shake, invalid, compact }) {
  const cells = []
  for (let i = 0; i < WORD_LENGTH; i++) {
    const letter = letters[i] || ''
    const status = statuses[i]
    cells.push(
      <div
        key={i}
        className={[
          'tile',
          compact ? 'tile--compact' : '',
          letter && !status ? 'tile--filled' : '',
          status ? `tile--${status}` : '',
          invalid ? 'tile--invalid' : '',
        ].join(' ').trim()}
        style={revealed && delayReveal ? { animationDelay: `${i * 120}ms` } : undefined}
      >
        <span>{letter}</span>
      </div>
    )
  }
  return <div className={`row${shake ? ' row--shake' : ''}`}>{cells}</div>
}