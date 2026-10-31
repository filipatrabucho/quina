import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { getDisplayName, getAvatarUrl, getAvatarSeed } from '../lib/discordProfile.js'
import { GAMES } from '../data/games.js'
import GameRules, { GameTop } from './GameGuide.jsx'
import { adsConfigured, showPrivacyOptions } from '../lib/ads.js'
import Avatar from './Avatar.jsx'
import Logo from './Logo.jsx'
import Sidebar from './Sidebar.jsx'
import AdSlot from './AdSlot.jsx'
import { SocialProvider } from '../social/SocialContext.jsx'
import ChatDock, { HeaderChatButton } from '../social/ChatDock.jsx'
import { useSocial } from '../social/SocialContext.jsx'
import { useSeo } from '../hooks/useSeo.js'
import CookieBar, { openCookieBar } from './CookieBar.jsx'
import GameEndToast from './GameEndToast.jsx'
import FeedbackModal, { openFeedback } from './Feedback.jsx'
import { logOpen, rememberGame } from '../lib/plays.js'

function AccountChip() {
  const { user, loading } = useAuth()
  const social = useSocial()
  if (loading) return <span className="account-chip account-chip--loading" />
  const hasAccount = user && !user.is_anonymous
  if (!hasAccount) {
    return (
      <Link to="/conta" className="btn btn--outline btn--small account-login" aria-label="Entrar ou criar conta">
        Entrar
      </Link>
    )
  }
  // O avatar abre o perfil público; para editar há o botão "Editar perfil".
  const to = social?.me?.username ? `/u/${social.me.username}` : '/conta'
  return (
    <Link to={to} className="account-chip" aria-label="O meu perfil" data-testid="account-chip">
      <Avatar src={getAvatarUrl(user)} seed={getAvatarSeed(user)} name={getDisplayName(user)} size={28} />
      <span className="account-chip__name">{getDisplayName(user)}</span>
    </Link>
  )
}

// Jogo da página atual (os jogos em beta só contam para quem os pode ver).
function useCurrentGame() {
  const { pathname } = useLocation()
  const s = useSocial()
  const game = GAMES.find((g) => g.to === pathname.replace(/\/+$/, ''))
  if (!game || (game.beta && !s?.canSeeBeta)) return null
  return game
}

// Página de um jogo: o jogo ao centro, o top 3 por baixo e a janela "Como jogar".
function PageContent() {
  const game = useCurrentGame()
  if (!game) return <Outlet />
  return (
    <div className="game-layout">
      <div className="game-layout__main">
        <Outlet />
      </div>
      <GameTop game={game} />
      <GameRules game={game} />
    </div>
  )
}

// Ao mudar de página (ex.: abrir outro jogo no menu) volta ao topo.
// Não mexe quando só muda o ?query da mesma página (ex.: entrar numa sala)
// nem no botão "voltar" do browser, que repõe a posição anterior.
function useScrollToTopOnNavigate() {
  const { pathname, hash } = useLocation()
  const navType = useNavigationType()
  useEffect(() => {
    if (hash || navType === 'POP') return
    window.scrollTo(0, 0)
  }, [pathname, hash, navType])
}

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)

function SiteShell() {
  const { pathname } = useLocation()
  useSeo(useSocial()?.catalogVersion)
  const game = useCurrentGame()
  const [drawer, setDrawer] = useState(false)
  const isHome = pathname === '/'
  // Sem anúncios nas páginas internas (backoffice).
  const ads = !pathname.startsWith('/admin')

  // Conta quem abre cada jogo (uma vez por sessão), com ou sem conta.
  useEffect(() => {
    if (game) {
      logOpen(game.key)
      rememberGame(game.key)
    }
  }, [game?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fecha o menu do telemóvel ao mudar de página e com a tecla Esc.
  useEffect(() => setDrawer(false), [pathname])
  useEffect(() => {
    if (!drawer) return
    const onKey = (e) => e.key === 'Escape' && setDrawer(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer])

  return (
    <div className={`site${game ? ' site--game' : ''}${drawer ? ' site--drawer' : ''}`}>
      <aside className="site-side" aria-label="Menu principal">
        <Sidebar onNavigate={() => setDrawer(false)} />
      </aside>
      <button type="button" className="site-backdrop" aria-label="Fechar menu" tabIndex={-1} onClick={() => setDrawer(false)} />

      <div className="site-col">
        <header className="topbar">
          <button type="button" className="topbar__menu" onClick={() => setDrawer(true)} aria-label="Abrir menu" aria-expanded={drawer}>
            <MenuIcon />
          </button>
          <Link to="/" className="topbar__logo" aria-label="Página inicial do Tuga Games">
            <Logo size={28} />
          </Link>
          {isHome && (
            <h1 className="topbar__title">
              Mini-jogos para jogar com amigos no Discord <span>Ou sozinho, contra bots.</span>
            </h1>
          )}
          <div className="topbar__actions">
            <HeaderChatButton />
            <AccountChip />
          </div>
        </header>

        <div className="site-body">
          <div className="site-main">
            <PageContent />
            {ads && (
              <div className="page-foot-spot">
                <AdSlot variant="banner" />
              </div>
            )}
          </div>
          {ads && (
            <aside className="side-col side-col--right">
              <AdSlot variant="rail" />
            </aside>
          )}
        </div>

        <footer className="site-footer">
          <div className="site-footer__inner">
            <Logo size={24} />
            <nav className="site-footer__links">
              <Link to="/sobre">Sobre</Link>
              <Link to="/contacto">Contacto</Link>
              <button type="button" className="site-footer__link-btn" onClick={openFeedback} data-testid="footer-feedback">
                Dar feedback
              </button>
              <Link to="/conta">Conta</Link>
              <a href="/privacidade.html">Privacidade</a>
              <a href="/termos.html">Termos</a>
              <button type="button" className="site-footer__link-btn" onClick={() => { openCookieBar(); if (adsConfigured) showPrivacyOptions() }}>
                Cookies
              </button>
              {import.meta.env.VITE_TIP_URL && (
                <a href={import.meta.env.VITE_TIP_URL} target="_blank" rel="noopener noreferrer">
                  Apoiar o projeto
                </a>
              )}
            </nav>
            <span className="site-footer__copy">© {new Date().getFullYear()} Tuga Games PT</span>
          </div>
        </footer>
      </div>

      <CookieBar />
      <GameEndToast />
      <FeedbackModal />
      <ChatDock />
    </div>
  )
}

export default function Layout() {
  useScrollToTopOnNavigate()
  return (
    <SocialProvider>
      <SiteShell />
    </SocialProvider>
  )
}
