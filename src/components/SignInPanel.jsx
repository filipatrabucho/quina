import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { GUEST_NAME_KEY } from '../hooks/useAuth.js'

// Ecrã de entrada no multiplayer: jogar como convidado (só um nome, sem
// conta), entrar com a conta Quina (email) ou com o Discord.
export default function SignInPanel({ title, onExit, signInAsGuest, signInWithDiscord }) {
  const [name, setName] = useState(() => localStorage.getItem(GUEST_NAME_KEY) || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const location = useLocation()
  const returnTo = encodeURIComponent(location.pathname + location.search)

  const handleGuest = async () => {
    setBusy(true)
    setError('')
    try {
      await signInAsGuest(name)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="duel-panel">
      <button className="icon-btn" onClick={onExit} aria-label="Voltar">←</button>
      <h2>{title}</h2>
      <p className="modal-note">Escolhe um nome. Não precisas de conta.</p>
      <input
        className="duel-name-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim() && !busy) handleGuest()
        }}
        placeholder="O teu nome"
        maxLength={24}
        autoFocus
      />
      <button className="share-btn" onClick={handleGuest} disabled={busy || !name.trim()}>
        Jogar como convidado
      </button>
      {error && <p className="duel-error">{error}</p>}
      <p className="modal-note">ou</p>
      <div className="signin-alt">
        <Link className="mode-btn" to={`/conta?voltar=${returnTo}`}>
          Entrar / Criar conta
        </Link>
        <button className="mode-btn" onClick={signInWithDiscord} disabled={busy}>
          Entrar com Discord
        </button>
      </div>
    </div>
  )
}
