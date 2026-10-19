import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { visibleGames } from '../data/games.js'
import { useSocial } from '../social/SocialContext.jsx'
import GameIcon from '../components/GameIcon.jsx'
import AdSlot from '../components/AdSlot.jsx'
import { useAuth } from '../hooks/useAuth.js'
import MedalBadge from '../social/MedalBadge.jsx'
import { medalByKey } from '../data/medals.js'

const CATEGORIES = [
  { key: 'todos', label: 'Todos' },
  { key: 'online', label: 'Multiplayer' },
  { key: 'bot', label: 'vs Bot' },
  { key: 'solo', label: 'Solo' },
  { key: 'diario', label: 'Diários' },
]

const MODE_LABEL = { online: 'Multiplayer', bot: 'vs Bot', solo: 'Solo', diario: 'Diário' }

// Os três jogos do topo e a frase que aparece em cada um.
const FEATURED = [
  { key: 'palavras', note: 'Palavra nova todos os dias à meia-noite' },
  { key: 'emojis', note: 'Filmes, séries e jogos escondidos em emojis' },
  { key: 'stop', note: 'Nome, país, animal… e quem acaba grita STOP' },
]

function playersLabel(players) {
  const p = players.replace(' a ', '–')
  return p === '1' ? '1 jogador' : `${p} jogadores`
}

const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Medalhas que aparecem no banner (existem mesmo no site).
const BANNER_MEDALS = ['primeira-vitoria', 'lenda', 'popular']

function FriendsBanner({ hasAccount, profilePath, onShowMultiplayer }) {
  return (
    <section className="promo" aria-labelledby="promo-title">
      <div className="promo__text">
        <h2 id="promo-title">Joga online com os teus amigos, ganha troféus e diverte-te!</h2>
        <p>Cria uma sala, envia o link e começam a jogar em segundos. Cada vitória conta para as tuas medalhas e para o top de cada jogo.</p>
        <div className="promo__actions">
          {hasAccount ? (
            <>
              <button type="button" className="btn btn--primary btn--small" onClick={onShowMultiplayer}>Jogar com amigos</button>
              <Link to={profilePath} className="btn btn--outline btn--small">Ver os meus troféus</Link>
            </>
          ) : (
            <>
              <Link to="/conta?modo=criar" className="btn btn--primary btn--small" data-testid="promo-signup">Criar conta grátis</Link>
              <button type="button" className="btn btn--outline btn--small" onClick={onShowMultiplayer}>Ver jogos multiplayer</button>
            </>
          )}
        </div>
      </div>
      <div className="promo__art" aria-hidden="true">
        {BANNER_MEDALS.map((key, i) => (
          <div key={key} className={`promo__medal promo__medal--${i}`}>
            <MedalBadge medal={medalByKey[key]} size={i === 1 ? 96 : 72} title="" />
          </div>
        ))}
        <div className="promo__icons">
          {['emojis', 'stop', 'memes', 'noventa'].map((k) => (
            <GameIcon key={k} game={k} size={40} />
          ))}
        </div>
      </div>
    </section>
  )
}

function GameTile({ game }) {
  return (
    <Link to={game.to} className={`gtile game-card game-card--${game.key}`} title={game.description}>
      <div className="gtile__art">
        <GameIcon game={game.key} size={64} className="gtile__icon" />
        {game.beta && <span className="gtile__badge">Beta</span>}
      </div>
      <div className="gtile__info">
        <h3>{game.title}</h3>
        <span>{playersLabel(game.players)} · {MODE_LABEL[game.tags[0]]}</span>
      </div>
    </Link>
  )
}

function FeaturedCard({ game, note }) {
  return (
    <Link to={game.to} className={`spot game-card--${game.key}`}>
      <div className="spot__art">
        <GameIcon game={game.key} size={84} />
      </div>
      <div className="spot__info">
        <h3>{game.title}</h3>
        <p>{note}</p>
        <span className="spot__meta">{playersLabel(game.players)}</span>
      </div>
    </Link>
  )
}

export default function Hub() {
  const [category, setCategory] = useState('todos')
  const [query, setQuery] = useState('')
  const { user } = useAuth()
  const social = useSocial()
  const games = visibleGames(social?.canSeeBeta)
  const hasAccount = user && !user.is_anonymous

  const q = normalize(query.trim())
  const list = games.filter(
    (g) =>
      (category === 'todos' || g.tags.includes(category)) &&
      (!q || normalize(`${g.title} ${g.short} ${g.description}`).includes(q)),
  )
  const browsing = category === 'todos' && !q
  const featured = FEATURED.map((f) => ({ ...f, game: games.find((g) => g.key === f.key) })).filter((f) => f.game)
  const count = (key) => (key === 'todos' ? games.length : games.filter((g) => g.tags.includes(key)).length)
  const current = CATEGORIES.find((c) => c.key === category)
  const profilePath = social?.me?.username ? `/u/${social.me.username}` : '/conta'
  // O scroll só depois de a lista mudar (o banner e os destaques saem da página).
  const scrollToList = useRef(false)
  const showMultiplayer = () => {
    setQuery('')
    setCategory('online')
    scrollToList.current = true
  }
  useEffect(() => {
    if (!scrollToList.current) return
    scrollToList.current = false
    document.getElementById('jogos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [category])

  return (
    <main className="home">
      <section className="home-top">
        <div className="home-top__text">
          <h1>Jogos online grátis</h1>
          <p>{games.length} jogos em português para jogar no browser, sozinho, contra o computador ou com amigos.</p>
        </div>
        <label className="home-search">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar jogo"
            aria-label="Procurar jogo"
          />
        </label>
      </section>

      <nav className="home-cats" aria-label="Categorias">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`home-cat${category === c.key ? ' home-cat--active' : ''}`}
            aria-pressed={category === c.key}
            onClick={() => setCategory(c.key)}
          >
            {c.label}
            <span className="home-cat__n">{count(c.key)}</span>
          </button>
        ))}
      </nav>

      {browsing && <FriendsBanner hasAccount={hasAccount} profilePath={profilePath} onShowMultiplayer={showMultiplayer} />}

      {browsing && featured.length > 0 && (
        <section className="home-section">
          <h2>Em destaque</h2>
          <div className="spot-grid">
            {featured.map((f) => (
              <FeaturedCard key={f.key} game={f.game} note={f.note} />
            ))}
          </div>
        </section>
      )}

      <section id="jogos" className="home-section">
        <h2>{browsing ? 'Todos os jogos' : q ? `Resultados (${list.length})` : `${current.label} (${list.length})`}</h2>
        {list.length ? (
          <div className="tile-grid">
            {list.map((g) => (
              <GameTile key={g.key} game={g} />
            ))}
          </div>
        ) : (
          <p className="home-empty">
            Nenhum jogo encontrado.{' '}
            <button type="button" className="link-btn" onClick={() => { setQuery(''); setCategory('todos') }}>Ver todos</button>
          </p>
        )}
      </section>

      <AdSlot variant="banner" className="hub__ad" />

      <section className="home-about">
        <h2>Sobre o Tuga Games</h2>
        <div className="home-about__cols">
          <div>
            <h3>Sem instalar nada</h3>
            <p>Todos os jogos abrem no browser, no computador ou no telemóvel. Não há downloads nem aplicações.</p>
          </div>
          <div>
            <h3>Joga com amigos</h3>
            <p>Cria uma sala, envia o link e começa a jogar. Também podes adicionar amigos e convidá-los pelo site.</p>
          </div>
          <div>
            <h3>Feito em Portugal</h3>
            <p>Palavras portuguesas, regras explicadas em português e um top de jogadores em cada jogo.</p>
          </div>
        </div>
        <div className="home-about__links">
          {!hasAccount && <Link to="/conta?modo=criar" className="btn btn--primary btn--small">Criar conta grátis</Link>}
          <Link to="/sobre" className="link-btn">Mais sobre o site</Link>
        </div>
      </section>
    </main>
  )
}
