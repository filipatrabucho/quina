const LEVELS = [
  { key: 'facil', label: 'Fácil' },
  { key: 'medio', label: 'Médio' },
  { key: 'dificil', label: 'Difícil' },
]

export default function BotLevelPicker({ value, onChange }) {
  return (
    <div className="bot-levels" role="group" aria-label="Dificuldade do bot">
      {LEVELS.map((l) => (
        <button
          key={l.key}
          className={`mode-btn mode-btn--small${value === l.key ? ' mode-btn--active' : ''}`}
          onClick={() => onChange(l.key)}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
