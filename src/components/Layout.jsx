import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { getDisplayName, getAvatarUrl, getAvatarSeed } from '../lib/discordProfile.js'
import Avatar from './Avatar.jsx'

export const GAME_LINKS = [
  { to: '/palavras', label: 'Palavras' },
  { to: '/fiada', label: 'Fiada' },
  { to: '/quatro-em-linha', label: '4 em Linha' },
  { to: '/galo', label: 'Galo' },
  { to: '/xadrez', label: 'Xadrez' },
  { to: '/memes', label: 'Memes' },
]

function AccountChip() {
  const { user, loading } = useAuth()
  if (loading) return <span className="account-chip account-chip--loading" />
  const hasAccount = user && !user.is_anonymous
  return (
    <Link to="/conta" className="account-chip" aria-label={hasAccount ? 'A minha conta' : 'Entrar ou criar conta'}>
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
        <div className="site-header__top">
          <Link to="/" className="site-logo" aria-label="Página inicial do Quina">
            <span className="logo__tile logo__tile--a">Q</span>
            <span className="logo__tile logo__tile--b">U</span>
            <span className="logo__tile logo__tile--a">I</span>
            <span className="logo__tile logo__tile--b">N</span>
            <span className="logo__tile logo__tile--a">A</span>
          </Link>
          <AccountChip />
        </div>
        <nav className="site-nav">
          {GAME_LINKS.map((g) => (
            <NavLink
              key={g.to}
              to={g.to}
              className={({ isActive }) => `site-nav__link${isActive ? ' site-nav__link--active' : ''}`}
            >
              {g.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
