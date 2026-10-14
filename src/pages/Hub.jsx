import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GAMES, TAG_LABELS } from '../data/games.js'
import GameIcon from '../components/GameIcon.jsx'
import { LogoMark } from '../components/Logo.jsx'
import { useAuth } from '../hooks/useAuth.js'

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'online', label: 'Multiplayer' },
  { key: 'bot', label: 'vs Bot' },
  { key: 'diario', label: 'Diários' },
]

function GameCard({ game }) {
  return (
    <Link to={game.to} className={`game-card game-card--${game.key}`}>
      <div className="game-card__art">
        <GameIcon game={game.key} size={84} className="game-card__icon" />
        {game.badge && <span className={`game-card__badge game-card__badge--${game.badge.toLowerCase()}`}>{game.badge}</span>}
      </div>
      <div className="game-card__body">
        <h3>{game.title}</h3>
        <p>{game.description}</p>
        <div className="game-card__meta">
          {game.tags.map((t) => (
            <span key={t} className={`tag tag--${t}`}>{TAG_LABELS[t]}</span>
          ))}
          <span className="tag tag--players" title="Jogadores">👥 {game.players}</span>
        </div>
      </div>
      <span className="game-card__play" aria-hidden="true">Jogar ▶</span>
    </Link>
  )
}

export default function Hub() {
  const [filter, setFilter] = useState('todos')
  const { user } = useAuth()
  const featured = GAMES[0]
  const list = filter === 'todos' ? GAMES : GAMES.filter((g) => g.tags.includes(filter))

  return (
    <main className="hub">
      <section className="hero">
        <div className="hero__text">
          <span className="hero__kicker">🎮 Grátis · Sem instalar · Em português</span>
          <h1>
            Joga com amigos,
            <br />
            <span className="hero__grad">direto no browser.</span>
          </h1>
          <p>Mini-jogos rápidos para jogares sozinho, contra o bot ou online com quem quiseres — basta partilhar um link.</p>
          <div className="hero__actions">
            <a href="#jogos" className="btn btn--primary">Ver jogos</a>
            {!user || user.is_anonymous ? (
              <Link to="/conta" className="btn btn--ghost">Criar conta</Link>
            ) : (
              <Link to={featured.to} className="btn btn--ghost">Jogar {featured.short}</Link>
            )}
          </div>
          <ul className="hero__stats">
            <li><strong>{GAMES.length}</strong> jogos</li>
            <li><strong>Online</strong> com link</li>
            <li><strong>3</strong> níveis de bot</li>
          </ul>
        </div>

        <div className="hero__visual">
          <Link to={featured.to} className="ticket" aria-label={`Destaque: ${featured.title}`}>
            <div className="ticket__top">
              <div className="ticket__strip" aria-hidden="true">
                {GAMES.slice(1, 5).map((g) => (
                  <GameIcon key={g.key} game={g.key} size={34} />
                ))}
              </div>
              <div className="ticket__panel">
                <span className="ticket__label">Em destaque</span>
                <GameIcon game={featured.key} size={30} className="ticket__mini" />
                <strong className="ticket__title">{featured.title}</strong>
                <span className="ticket__sub">{featured.players} jogadores · online</span>
              </div>
            </div>
            <div className="ticket__barcode" aria-hidden="true">
              {Array.from({ length: 26 }, (_, i) => (
                <span key={i} style={{ width: [2, 4, 1, 3, 2, 5, 1, 2][i % 8] }} />
              ))}
            </div>
          </Link>
          <Link to={featured.to} className="hero__orb" aria-label={`Jogar ${featured.title}`}>
            <GameIcon game={featured.key} size={128} className="hero__orb-icon" />
          </Link>
          <div className="hero__players" aria-hidden="true">
            <GameIcon game="xadrez" size={30} />
            <GameIcon game="galo" size={30} />
            <span>+</span>
          </div>
        </div>
      </section>

      <section className="quick-list" aria-label="Acesso rápido">
        {GAMES.map((g) => (
          <Link key={g.key} to={g.to} className="quick-row">
            <GameIcon game={g.key} size={52} />
            <span className="quick-row__name">{g.title}</span>
            <span className="quick-row__info">{g.players} jog.</span>
            <span className="quick-row__dots" aria-label={g.tags.map((t) => TAG_LABELS[t]).join(', ')}>
              {g.tags.map((t) => (
                <i key={t} className={`dot dot--${t}`} />
              ))}
            </span>
          </Link>
        ))}
      </section>

      <section id="jogos" className="games-section">
        <div className="games-section__head">
          <h2>Todos os jogos</h2>
          <div className="chips" role="group" aria-label="Filtrar jogos">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`chip${filter === f.key ? ' chip--active' : ''}`}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="games-grid">
          {list.map((g) => (
            <GameCard key={g.key} game={g} />
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <LogoMark size={26} />
        <span>Quina · mini-jogos em português</span>
        {import.meta.env.VITE_TIP_URL && (
          <a className="tip-link" href={import.meta.env.VITE_TIP_URL} target="_blank" rel="noopener noreferrer">
            ☕ Oferece-me um café
          </a>
        )}
      </footer>
    </main>
  )
}
