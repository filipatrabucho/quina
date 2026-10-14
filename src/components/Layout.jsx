import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { getDisplayName, getAvatarUrl, getAvatarSeed } from '../lib/discordProfile.js'
import { GAMES } from '../data/games.js'
import Avatar from './Avatar.jsx'
import Logo from './Logo.jsx'
import GameIcon from './GameIcon.jsx'

function AccountChip() {
  const { user, loading } = useAuth()
  if (loading) return <span className="account-chip account-chip--loading" />
  const hasAccount = user && !user.is_anonymous
  return (
    <Link
      to="/conta"
      className={`account-chip${hasAccount ? '' : ' account-chip--cta'}`}
      aria-label={hasAccount ? 'A minha conta' : 'Entrar ou criar conta'}
    >
      {hasAccount ? (
        <>
          <Avatar src={getAvatarUrl(user)} seed={getAvatarSeed(user)} name={getDisplayName(user)} size={28} />
          <span className="account-chip__name">{getDisplayName(user)}</span>
        </>
      ) : (
        <span className="account-chip__name">Entrar</span>
      )}
    </Link>
  )
}

export default function Layout() {
  return (
    <div className="site">
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="site-logo" aria-label="Página inicial do Quina">
            <Logo size={34} />
          </Link>
          <nav className="site-nav" aria-label="Jogos">
            {GAMES.map((g) => (
              <NavLink
                key={g.to}
                to={g.to}
                className={({ isActive }) => `site-nav__link${isActive ? ' site-nav__link--active' : ''}`}
              >
                <GameIcon game={g.key} size={20} />
                {g.short}
              </NavLink>
            ))}
          </nav>
          <AccountChip />
        </div>
      </header>
      <Outlet />
    </div>
  )
}
