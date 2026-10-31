import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import GameIcon from './GameIcon.jsx'
import { useSocial } from '../social/SocialContext.jsx'
import { enterFullscreen, exitFullscreen, useGameFullscreen } from '../lib/fullscreen.js'
import { openRules, registerShell } from '../lib/rules.js'

const FsIcon = ({ on }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {on ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
  </svg>
)

// Em ecrã inteiro: botões discretos para o chat e para sair.
function FullscreenControls() {
  const s = useSocial()
  useEffect(() => {
    // sem a API do browser (ex.: iPhone), o Esc também sai
    const onKey = (e) => e.key === 'Escape' && !document.fullscreenElement && exitFullscreen()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="fs-controls">
      <button type="button" className="fs-btn fs-btn--exit" onClick={exitFullscreen} aria-label="Sair do ecrã inteiro" title="Sair do ecrã inteiro (Esc)" data-testid="fs-exit">
        <FsIcon on />
      </button>
      {s && (
        <button
          type="button"
          className="fs-btn fs-btn--chat"
          onClick={() => s.setPanel({ ...s.panel, open: !s.panel.open })}
          aria-label={`Chat${s.totalUnread ? ` (${s.totalUnread} por ler)` : ''}`}
          title="Chat"
          data-testid="fs-chat"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 5h16v11H9l-5 4z" />
          </svg>
          {s.totalUnread > 0 && <span className="chat-fab__badge">{s.totalUnread}</span>}
        </button>
      )}
    </div>
  )
}

// Cabeçalho comum aos jogos novos: título, ajuda e escolha de modo.
export default function GameShell({ game, title, help, modes, children, wide = false }) {
  const [params, setParams] = useSearchParams()
  const fs = useGameFullscreen()
  // O resumo deste jogo vai para a janela "Como jogar" (com as regras completas).
  useEffect(() => registerShell(help), [help])
  // Ao sair da página do jogo, sai do ecrã inteiro.
  useEffect(() => () => { exitFullscreen() }, [])
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
        <button className="icon-btn" onClick={openRules} aria-label="Como jogar" title="Como jogar" data-testid="rules-open">?</button>
        <h2 className="game-title">
          {game && <GameIcon game={game} size={30} />}
          {title}
        </h2>
        <button className="icon-btn" onClick={() => (fs ? exitFullscreen() : enterFullscreen())} aria-label={fs ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'} title={fs ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'} data-testid="fs-toggle">
          <FsIcon on={fs} />
        </button>
      </header>
      {fs && <FullscreenControls />}
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
      <main className={`game-area${wide ? ' game-area--wide' : ''}`}>{children(mode)}</main>
    </>
  )
}
