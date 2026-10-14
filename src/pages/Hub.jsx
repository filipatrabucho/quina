import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GAMES, TAG_LABELS } from '../data/games.js'
import GameIcon from '../components/GameIcon.jsx'
import AdSlot from '../components/AdSlot.jsx'
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
        <GameIcon game={game.key} size={76} className="game-card__icon" />
        {game.badge && <span className={`game-card__badge game-card__badge--${game.badge.toLowerCase()}`}>{game.badge}</span>}
      </div>
      <div className="game-card__body">
        <h3>{game.title}</h3>
        <p>{game.description}</p>
      </div>
      <div className="game-card__foot">
        <span className="game-card__meta">
          {game.tags.map((t) => TAG_LABELS[t]).join(' · ')} · {game.players} jog.
        </span>
        <span className="game-card__play">Jogar</span>
      </div>
    </Link>
  )
}

export default function Hub() {
  const [filter, setFilter] = useState('todos')
  const { user } = useAuth()
  const featured = GAMES[0]
  const list = filter === 'todos' ? GAMES : GAMES.filter((g) => g.tags.includes(filter))
  const hasAccount = user && !user.is_anonymous

  return (
    <main className="hub">
      <section className="hero">
        <div className="hero__text">
          <span className="eyebrow">Jogos online gratuitos</span>
          <h1>Joga com amigos, direto no browser</h1>
          <p>
            Palavras, xadrez, 4 em linha, memes e mais. Joga sozinho, contra o computador ou cria uma sala e envia o
            link a quem quiseres.
          </p>
          <div className="hero__actions">
            <a href="#jogos" className="btn btn--primary">Ver jogos</a>
            {hasAccount ? (
              <Link to={featured.to} className="btn btn--outline">Jogar {featured.short}</Link>
            ) : (
              <Link to="/conta" className="btn btn--outline">Criar conta</Link>
            )}
          </div>
        </div>

        <Link to={featured.to} className={`feature game-card--${featured.key}`} aria-label={`Destaque: ${featured.title}`}>
          <div className="feature__art">
            <GameIcon game={featured.key} size={112} />
          </div>
          <div className="feature__info">
            <span className="eyebrow">Destaque</span>
            <h2>{featured.title}</h2>
            <p>{featured.description}</p>
            <div className="feature__meta">
              <span>{featured.players} jogadores</span>
              <span>Online</span>
            </div>
            <span className="btn btn--primary btn--small">Jogar agora</span>
          </div>
        </Link>
      </section>

      <AdSlot variant="banner" className="hub__ad" />

      <section id="jogos" className="games-section">
        <div className="games-section__head">
          <h2>Jogos</h2>
          <div className="tabs" role="tablist" aria-label="Filtrar jogos">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                className={`tab${filter === f.key ? ' tab--active' : ''}`}
                onClick={() => setFilter(f.key)}
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
    </main>
  )
}
