import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

// Cabeçalho comum aos jogos novos: título, ajuda e escolha de modo.
export default function GameShell({ title, help, modes, children }) {
  const [params, setParams] = useSearchParams()
  const [showHelp, setShowHelp] = useState(false)
  const requested = params.get('sala') ? 'online' : params.get('modo')
  const mode = modes.some((m) => m.key === requested) ? requested : modes[0].key

  const setMode = (key) => {
    const next = new URLSearchParams()
    next.set('modo', key)
    setParams(next)
  }

  return (
    <>
      <header className="header header--game">
        <button className="icon-btn" onClick={() => setShowHelp(true)} aria-label="Como jogar">?</button>
        <h2 className="game-title">{title}</h2>
        <span className="icon-btn icon-btn--ghost" aria-hidden="true" />
      </header>
      {modes.length > 1 && (
        <div className="mode-switch">
          {modes.map((m) => (
            <button
              key={m.key}
              className={`mode-btn${mode === m.key ? ' mode-btn--active' : ''}`}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
      <main className="game-area">{children(mode)}</main>
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowHelp(false)} aria-label="Fechar">×</button>
            <h2>Como jogar</h2>
            {help}
          </div>
        </div>
      )}
    </>
  )
}
