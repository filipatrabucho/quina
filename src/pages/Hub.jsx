import { Link, useSearchParams } from 'react-router-dom'
import { visibleGames } from '../data/games.js'
import { useSocial } from '../social/SocialContext.jsx'
import GameIcon from '../components/GameIcon.jsx'
import GamePreview from '../components/GamePreview.jsx'
import AdSlot from '../components/AdSlot.jsx'
import { CATEGORIES, GameSearch } from '../components/Sidebar.jsx'
import { useAuth } from '../hooks/useAuth.js'

const MODE_LABEL = { online: 'Multiplayer', bot: 'vs Bot', solo: 'Solo', diario: 'Diário' }
// Os jogos grandes do topo: os 3 primeiros desta lista que a pessoa pode ver
// (o Bombas está em beta e só aparece aos testers).
const FEATURED_PICKS = ['bombas', 'emojis', 'stop', 'palavras']
// Quantas miniaturas antes do anúncio a meio da grelha.
const BEFORE_AD = 6

const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function playersLabel(players) {
  const p = players.replace(' a ', '–')
  return p === '1' ? '1 jogador' : `${p} jogadores`
}

const PlayIcon = () => (
  <span className="play-dot" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
  </span>
)

function BigTile({ game }) {
  return (
    <Link to={game.to} className={`gtile gtile--big gtile--${game.key}`} title={game.description}>
      <div className="gtile__art"><GamePreview game={game.key} /></div>
      <div className="gtile__bar">
        <GameIcon game={game.key} size={40} />
        <div className="gtile__bar-text">
          <h2>{game.title}</h2>
          <span>{playersLabel(game.players)} · {MODE_LABEL[game.tags[0]]}</span>
        </div>
        <PlayIcon />
      </div>
    </Link>
  )
}

function Tile({ game }) {
  return (
    <Link to={game.to} className={`gtile gtile--${game.key}`} title={game.description}>
      <div className="gtile__art"><GamePreview game={game.key} /></div>
      <span className="gtile__name">{game.title}</span>
      {game.beta && <span className="gtile__badge">Beta</span>}
    </Link>
  )
}

export default function Hub() {
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const social = useSocial()
  const games = visibleGames(social?.canSeeBeta)
  const hasAccount = user && !user.is_anonymous

  const category = CATEGORIES.some((c) => c.key === params.get('cat')) ? params.get('cat') : null
  const query = (params.get('q') || '').trim()
  const q = normalize(query)
  const list = games.filter(
    (g) => (!category || g.tags.includes(category)) && (!q || normalize(`${g.title} ${g.short} ${g.description}`).includes(q)),
  )
  const browsing = !category && !q
  const big = browsing ? FEATURED_PICKS.map((k) => games.find((g) => g.key === k)).filter(Boolean).slice(0, 3) : []
  const rest = browsing ? list.filter((g) => !big.includes(g)) : list
  const current = CATEGORIES.find((c) => c.key === category)
  const count = (key) => (key ? games.filter((g) => g.tags.includes(key)).length : games.length)

  return (
    <main className="home">
      {/* No telemóvel o menu lateral está fechado: pesquisa e categorias aqui. */}
      <div className="home-mobile-tools">
        <GameSearch className="side-search home-search" />
        <nav className="home-cats" aria-label="Categorias">
          {[{ key: null, label: 'Todos' }, ...CATEGORIES].map((c) => (
            <button
              key={c.label}
              type="button"
              className={`home-cat${category === c.key && !q ? ' home-cat--active' : ''}`}
              aria-pressed={category === c.key && !q}
              onClick={() => setParams(c.key ? { cat: c.key } : {})}
            >
              {c.label}
              <span className="home-cat__n">{count(c.key)}</span>
            </button>
          ))}
        </nav>
      </div>

      {!browsing && (
        <div className="home-filter">
          <h2>{q ? `Resultados para “${query}”` : current.label} <span>{list.length}</span></h2>
          <button type="button" className="link-btn" onClick={() => setParams({})}>Ver todos os jogos</button>
        </div>
      )}

      {list.length === 0 ? (
        <p className="home-empty">
          Nenhum jogo encontrado.{' '}
          <button type="button" className="link-btn" onClick={() => setParams({})}>Ver todos</button>
        </p>
      ) : (
        <div className="tile-grid" id="jogos">
          {big.map((g) => <BigTile key={g.key} game={g} />)}
          {rest.slice(0, BEFORE_AD).map((g) => <Tile key={g.key} game={g} />)}
          {browsing && rest.length > BEFORE_AD && (
            <div className="tile-grid__ad">
              <AdSlot variant="banner" />
            </div>
          )}
          {rest.slice(BEFORE_AD).map((g) => <Tile key={g.key} game={g} />)}
        </div>
      )}

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
            <h3>Ganha troféus</h3>
            <p>Cada vitória conta para as tuas medalhas e para o top de jogadores de cada jogo.</p>
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
