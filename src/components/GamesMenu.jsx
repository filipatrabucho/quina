import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { visibleGames, TAG_LABELS } from '../data/games.js'
import { useSocial } from '../social/SocialContext.jsx'
import GameIcon from './GameIcon.jsx'

// Menu "Todos os jogos" do cabeçalho no PC: grelha com todos os jogos.
export default function GamesMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { pathname } = useLocation()
  const social = useSocial()

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="games-menu" ref={ref}>
      <button className={`games-menu__btn${open ? ' games-menu__btn--open' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true" data-testid="games-menu">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">
          <rect x="1" y="1" width="6" height="6" rx="1.5" /><rect x="9" y="1" width="6" height="6" rx="1.5" /><rect x="1" y="9" width="6" height="6" rx="1.5" /><rect x="9" y="9" width="6" height="6" rx="1.5" />
        </svg>
        Todos os jogos
      </button>
      {open && (
        <div className="games-menu__panel" role="menu">
          {visibleGames(social?.canSeeBeta).map((g) => (
            <Link key={g.key} to={g.to} role="menuitem" className={`games-menu__item${pathname === g.to ? ' games-menu__item--active' : ''}`}>
              <GameIcon game={g.key} size={40} />
              <span>
                <b>{g.title}{g.badge && <em>{g.badge}</em>}</b>
                <small>{g.tags.map((t) => TAG_LABELS[t]).join(' · ')} · {g.players} jog.</small>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
