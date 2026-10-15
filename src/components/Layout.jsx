import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useAdConsent } from '../hooks/useAdConsent.js'
import { getDisplayName, getAvatarUrl, getAvatarSeed } from '../lib/discordProfile.js'
import { GAMES } from '../data/games.js'
import { adsenseConfigured } from './AdBanner.jsx'
import Avatar from './Avatar.jsx'
import Logo from './Logo.jsx'
import GameIcon from './GameIcon.jsx'
import AdSlot from './AdSlot.jsx'
import ConsentBanner from './ConsentBanner.jsx'

function AccountChip() {
  const { user, loading } = useAuth()
  if (loading) return <span className="account-chip account-chip--loading" />
  const hasAccount = user && !user.is_anonymous
  if (!hasAccount) {
    return (
      <Link to="/conta" className="btn btn--outline btn--small account-login" aria-label="Entrar ou criar conta">
        Entrar
      </Link>
    )
  }
  return (
    <Link to="/conta" className="account-chip" aria-label="A minha conta">
      <Avatar src={getAvatarUrl(user)} seed={getAvatarSeed(user)} name={getDisplayName(user)} size={28} />
      <span className="account-chip__name">{getDisplayName(user)}</span>
    </Link>
  )
}

export default function Layout() {
  const { consent, accept, decline } = useAdConsent()
  return (
    <div className="site">
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="site-logo" aria-label="Página inicial do Quina">
            <Logo size={32} />
          </Link>
          <nav className="site-nav" aria-label="Jogos">
            {GAMES.map((g) => (
              <NavLink
                key={g.to}
                to={g.to}
                className={({ isActive }) => `site-nav__link${isActive ? ' site-nav__link--active' : ''}`}
              >
                <GameIcon game={g.key} size={18} />
                {g.short}
              </NavLink>
            ))}
          </nav>
          <AccountChip />
        </div>
      </header>

      <div className="site-body">
        <aside className="side-col side-col--left">
          <AdSlot variant="rail" />
        </aside>
        <div className="site-main">
          <Outlet />
          <div className="page-foot-spot">
            <AdSlot variant="banner" />
          </div>
        </div>
        <aside className="side-col side-col--right">
          <AdSlot variant="rail" />
        </aside>
      </div>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <Logo size={24} />
          <nav className="site-footer__links">
            <Link to="/conta">Conta</Link>
            <a href="/privacidade.html">Privacidade</a>
            {import.meta.env.VITE_TIP_URL && (
              <a href={import.meta.env.VITE_TIP_URL} target="_blank" rel="noopener noreferrer">
                Apoiar o projeto
              </a>
            )}
          </nav>
          <span className="site-footer__copy">© {new Date().getFullYear()} Quina</span>
        </div>
      </footer>

      {adsenseConfigured && !consent && <ConsentBanner onAccept={accept} onDecline={decline} />}
    </div>
  )
}
