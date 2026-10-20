import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { getDisplayName, getAvatarUrl, getAvatarSeed } from '../lib/discordProfile.js'
import { GAMES } from '../data/games.js'
import GameGuide from './GameGuide.jsx'
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
import { logOpen } from '../lib/plays.js'

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

// Largura que as regras ocupam ao lado do jogo no PC (coluna + espaço + margens).
const GUIDE_SIDE_SPACE = 290 + 16 + 32

// Nas páginas de jogos: o jogo e, ao lado (PC) ou por baixo (telemóvel), o guia.
function PageContent() {
  const game = useCurrentGame()
  const { pathname } = useLocation()
  const mainRef = useRef(null)
  const [overflows, setOverflows] = useState(false)

  // Se o jogo não cabe ao lado das regras (ex.: Palavras em Quarteto), as
  // regras passam para baixo em vez de ficarem por cima do jogo.
  useEffect(() => {
    setOverflows(false)
    const el = mainRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const check = () => {
      const layout = el.parentElement
      if (layout.classList.contains('game-layout--wide')) {
        // Já está em baixo: volta para o lado se o jogo voltar a caber.
        const prev = el.style.width
        el.style.width = 'min-content'
        const need = el.scrollWidth
        el.style.width = prev
        const room = layout.clientWidth - GUIDE_SIDE_SPACE
        if (need <= room) setOverflows(false)
      } else if (el.scrollWidth > el.clientWidth + 2) {
        setOverflows(true)
      }
    }
    const ro = new ResizeObserver(check)
    ro.observe(el)
    const mo = new MutationObserver(check)
    mo.observe(el, { childList: true, subtree: true })
    check()
    return () => { ro.disconnect(); mo.disconnect() }
  }, [pathname, game])

  if (!game) return <Outlet />
  return (
    <div className={`game-layout${game.wide || overflows ? ' game-layout--wide' : ''}`}>
      <div className="game-layout__main" ref={mainRef}>
        <Outlet />
      </div>
      <GameGuide game={game} />
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
  const game = useCurrentGame()
  const [drawer, setDrawer] = useState(false)
  const isHome = pathname === '/'
  // Sem anúncios nas páginas internas (backoffice).
  const ads = !pathname.startsWith('/admin')

  // Conta quem abre cada jogo (uma vez por sessão), com ou sem conta.
  useEffect(() => {
    if (game) logOpen(game.key)
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
              Jogos online grátis <span>Escolhe um e começa já.</span>
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
      <ChatDock />
    </div>
  )
}

export default function Layout() {
  useSeo()
  useScrollToTopOnNavigate()
  return (
    <SocialProvider>
      <SiteShell />
    </SocialProvider>
  )
}
