import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { GAME_FINISHED, guestPlays } from '../lib/plays.js'
import { pendingRef } from '../lib/referral.js'
import { track } from '../lib/analytics.js'
import Logo from './Logo.jsx'

// Sem conta joga-se UMA partida grátis. Depois disso (ao acabar a partida,
// ao querer jogar outra vez ou ao abrir outro jogo) é preciso criar conta.
export const FREE_GUEST_GAMES = 1
const SHOW_AFTER_MS = 2500 // deixa ver o resultado da partida antes de aparecer

export default function SignupGate({ game }) {
  const { user, loading } = useAuth()
  const { pathname, search } = useLocation()
  const guest = !user || user.is_anonymous
  const [open, setOpen] = useState(false)

  // Ao abrir um jogo depois de já ter jogado a partida grátis.
  useEffect(() => {
    if (loading) return
    setOpen(guest && guestPlays() >= FREE_GUEST_GAMES)
  }, [loading, guest, game.key])

  // Ao acabar a partida grátis: deixa ver o resultado e depois pede a conta.
  useEffect(() => {
    let t = null
    const onEnd = (e) => {
      if (!e.detail?.guest || e.detail.guestPlays < FREE_GUEST_GAMES) return
      clearTimeout(t)
      t = setTimeout(() => setOpen(true), SHOW_AFTER_MS)
    }
    window.addEventListener(GAME_FINISHED, onEnd)
    return () => {
      clearTimeout(t)
      window.removeEventListener(GAME_FINISHED, onEnd)
    }
  }, [])

  useEffect(() => {
    if (open) track('signup_gate', { game_name: game.key })
  }, [open, game.key])

  if (!open || !guest) return null
  const back = encodeURIComponent(pathname + search)
  const ref = pendingRef()
  return (
    <div className="modal-overlay signup-gate" data-testid="signup-gate">
      <div className="modal signup-gate__box" role="dialog" aria-modal="true" aria-labelledby="signup-gate-title">
        <Logo size={30} />
        <h2 id="signup-gate-title">Gostaste? Cria a tua conta para continuar a jogar</h2>
        {ref && <p className="signup-gate__ref">🎁 Foste convidado por <b>{ref}</b>: ao criares conta, contas como convite dele.</p>}
        <p>Já jogaste a tua partida grátis. A conta é grátis e demora 30 segundos:</p>
        <ul className="signup-gate__perks">
          <li>🎮 Joga todos os jogos as vezes que quiseres</li>
          <li>🏆 Entra no ranking e ganha medalhas</li>
          <li>👥 Joga online com amigos no Discord</li>
        </ul>
        <Link className="share-btn signup-gate__cta" to={`/conta?modo=criar&voltar=${back}`} onClick={() => track('signup_gate_click', { game_name: game.key })} data-testid="signup-gate-create">
          Criar conta grátis
        </Link>
        <Link className="link-btn" to={`/conta?voltar=${back}`} data-testid="signup-gate-login">Já tenho conta: entrar</Link>
      </div>
    </div>
  )
}
