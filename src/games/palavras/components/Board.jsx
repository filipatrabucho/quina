import { WORD_LENGTH } from '../utils/gameLogic.js'

export default function Board({
  guesses,
  statusesPerGuess,
  currentGuess = '',
  cursor = null,
  onSelectCell,
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
          letters={Array.isArray(currentGuess) ? currentGuess : currentGuess.split('')}
          statuses={[]}
          cursor={cursor}
          onSelectCell={onSelectCell}
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

function Row({ letters, statuses, revealed, delayReveal, shake, invalid, compact, cursor, onSelectCell }) {
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
          cursor === i ? 'tile--cursor' : '',
          onSelectCell ? 'tile--selectable' : '',
        ].join(' ').trim()}
        style={revealed && delayReveal ? { animationDelay: `${i * 120}ms` } : undefined}
        onClick={onSelectCell ? () => onSelectCell(i) : undefined}
        role={onSelectCell ? 'button' : undefined}
        aria-label={onSelectCell ? `Casa ${i + 1}${letter ? `: ${letter}` : ''}` : undefined}
        data-testid={onSelectCell ? `slot-${i}` : undefined}
      >
        <span>{letter}</span>
      </div>
    )
  }
  return <div className={`row${shake ? ' row--shake' : ''}`}>{cells}</div>
}