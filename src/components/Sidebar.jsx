import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { visibleGames } from '../data/games.js'
import { useSocial } from '../social/SocialContext.jsx'
import { openFeedback } from './Feedback.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { medalByKey } from '../data/medals.js'
import MedalBadge from '../social/MedalBadge.jsx'
import GameIcon from './GameIcon.jsx'
import Logo from './Logo.jsx'

// Ícones de linha do menu (mesmo traço em todos).
const ICONS = {
  home: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />,
  online: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.5 3.6 5.2" />
    </>
  ),
  bot: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 4v4M9 13h.01M15 13h.01M9 17h6" />
    </>
  ),
  solo: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.2-4 4.2-6 8-6s6.8 2 8 6" />
    </>
  ),
  diario: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  friends: <path d="M4 5h16v11H9l-5 4z" />,
  feedback: (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  // comando de jogo (para os jogos no Discord)
  discord: (
    <>
      <path d="M7 7h10a4 4 0 0 1 4 4v3.5a2.5 2.5 0 0 1-4.6 1.4L15 14H9l-1.4 1.9A2.5 2.5 0 0 1 3 14.5V11a4 4 0 0 1 4-4z" />
      <path d="M8 10v3M6.5 11.5h3M15 11h.01M17 12.5h.01" />
    </>
  ),
  admin: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
}

function Icon({ name }) {
  return (
    <svg className="side-ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

export const CATEGORIES = [
  { key: 'online', label: 'Multiplayer', icon: 'online' },
  { key: 'bot', label: 'vs Bot', icon: 'bot' },
  { key: 'solo', label: 'Solo', icon: 'solo' },
  { key: 'diario', label: 'Diários', icon: 'diario' },
]

export function GameSearch({ onDone, className = 'side-search' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const current = location.pathname === '/' ? new URLSearchParams(location.search).get('q') || '' : ''
  const [value, setValue] = useState(current)
  // Acompanha o endereço (ex.: carregar em "Início" limpa a pesquisa).
  useEffect(() => {
    setValue((v) => (v.trim() === current ? v : current))
  }, [current])
  return (
    <form
      className={className}
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const q = value.trim()
        navigate(q ? `/?q=${encodeURIComponent(q)}` : '/')
        onDone?.()
      }}
    >
      <Icon name="search" />
      <input
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          // Na página inicial a grelha filtra enquanto se escreve.
          if (location.pathname === '/') {
            const q = e.target.value.trim()
            navigate(q ? `/?q=${encodeURIComponent(q)}` : '/', { replace: true })
          }
        }}
        placeholder="Pesquisar jogos…"
        aria-label="Pesquisar jogos"
      />
    </form>
  )
}

// Menu lateral: no PC fica sempre visível (só com ícones nas páginas de
// jogo, ver .site--game no CSS); no telemóvel abre por cima, no botão ☰.
export default function Sidebar({ onNavigate }) {
  const s = useSocial()
  const { user, loading } = useAuth()
  const location = useLocation()
  const games = visibleGames(s?.canSeeBeta)
  const cat = location.pathname === '/' ? new URLSearchParams(location.search).get('cat') : null
  const homeActive = location.pathname === '/' && !cat && !new URLSearchParams(location.search).get('q')
  const hasAccount = user && !user.is_anonymous
  const count = (key) => games.filter((g) => g.tags.includes(key)).length
  const openFriends = () => {
    s?.setPanel({ open: true, view: 'amigos', friendId: null })
    onNavigate?.()
  }

  return (
    <div className="side">
      <Link to="/" className="side-logo" aria-label="Página inicial do Tuga Games" onClick={onNavigate}>
        <Logo size={28} />
      </Link>

      <GameSearch onDone={onNavigate} />

      <nav className="side-nav" aria-label="Menu">
        <Link to="/" className={`side-link${homeActive ? ' side-link--on' : ''}`} onClick={onNavigate} title="Início">
          <Icon name="home" />
          <span className="side-link__label">Início</span>
        </Link>
        <Link to="/jogos-para-discord" className={`side-link${location.pathname === '/jogos-para-discord' ? ' side-link--on' : ''}`} onClick={onNavigate} title="Jogos para o Discord" data-testid="side-discord">
          <Icon name="discord" />
          <span className="side-link__label">Para o Discord</span>
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c.key} to={`/?cat=${c.key}`} className={`side-link side-link--cat${cat === c.key ? ' side-link--on' : ''}`} onClick={onNavigate}>
            <Icon name={c.icon} />
            <span className="side-link__label">{c.label}</span>
            <small>{count(c.key)}</small>
          </Link>
        ))}
        {s && (
          <button type="button" className="side-link" onClick={openFriends} title="Amigos e mensagens">
            <Icon name="friends" />
            <span className="side-link__label">Amigos</span>
            {s.totalUnread > 0 && <em className="side-badge">{s.totalUnread}</em>}
          </button>
        )}
        <button
          type="button"
          className="side-link"
          onClick={() => {
            onNavigate?.()
            openFeedback()
          }}
          title="Dar feedback"
          data-testid="side-feedback"
        >
          <Icon name="feedback" />
          <span className="side-link__label">Dar feedback</span>
        </button>
        {s?.role === 'admin' && (
          <Link to="/admin" className={`side-link${location.pathname === '/admin' ? ' side-link--on' : ''}`} onClick={onNavigate} title="Backoffice" data-testid="side-admin">
            <Icon name="admin" />
            <span className="side-link__label">Backoffice</span>
          </Link>
        )}
      </nav>

      {!loading && !hasAccount && (
        <div className="side-promo">
          <div className="side-promo__medals" aria-hidden="true">
            <MedalBadge medal={medalByKey['primeira-vitoria']} size={40} title="" />
            <MedalBadge medal={medalByKey.lenda} size={52} title="" />
            <MedalBadge medal={medalByKey.popular} size={40} title="" />
          </div>
          <p>Joga com o teu grupo do Discord, ganha troféus e sobe no top.</p>
          <Link to="/conta?modo=criar" className="btn btn--primary btn--small side-promo__btn" onClick={onNavigate}>
            Criar conta grátis
          </Link>
        </div>
      )}

      <div className="side-games">
        <p className="side-games__title">Jogos</p>
        {games.map((g) => (
          <NavLink
            key={g.key}
            to={g.to}
            className={({ isActive }) => `side-link side-link--game${isActive ? ' side-link--on' : ''}`}
            onClick={onNavigate}
            title={g.title}
          >
            <GameIcon game={g.key} size={26} />
            <span className="side-link__label">{g.title}</span>
          </NavLink>
        ))}
      </div>
    </div>
  )
}
