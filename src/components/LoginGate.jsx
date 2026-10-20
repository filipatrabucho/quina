import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { supabaseConfigured } from '../lib/supabaseClient.js'
import DiscordButton from './DiscordButton.jsx'
import GoogleButton from './GoogleButton.jsx'
import Logo from './Logo.jsx'

// Para jogar online (salas com amigos) é preciso conta (email, Google ou
// Discord). Os jogos sozinho e contra bots são abertos a todos. As sessões de
// convidado não contam, exceto dentro da Atividade do Discord, onde a
// identidade vem do próprio Discord.
export default function LoginGate({
  children,
  title = 'Entra para jogar online',
  text = 'Para jogar com amigos precisas de uma conta. É grátis e demora menos de um minuto, e assim guardas as vitórias, sobes no top e recebes convites.',
}) {
  const { user, loading, discordActivity } = useAuth()
  const { pathname, search } = useLocation()
  if (!supabaseConfigured) return children
  if (loading) return <p className="page-loading">A carregar…</p>
  if (user && (!user.is_anonymous || discordActivity)) return children

  const returnTo = pathname + search
  const voltar = encodeURIComponent(returnTo)
  return (
    <div className="login-gate" data-testid="login-gate">
      <Logo />
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="login-gate__actions">
        <Link className="btn btn--primary" to={`/conta?voltar=${voltar}&modo=criar`} data-testid="gate-signup">Criar conta</Link>
        <Link className="btn btn--outline" to={`/conta?voltar=${voltar}`} data-testid="gate-login">Já tenho conta</Link>
        <GoogleButton returnTo={returnTo} />
        <DiscordButton returnTo={returnTo} />
      </div>
    </div>
  )
}
