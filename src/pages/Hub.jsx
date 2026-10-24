import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { visibleGames } from '../data/games.js'
import { useSocial } from '../social/SocialContext.jsx'
import GameIcon from '../components/GameIcon.jsx'
import GamePreview from '../components/GamePreview.jsx'
import AdSlot from '../components/AdSlot.jsx'
import { CATEGORIES, GameSearch } from '../components/Sidebar.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { dayNumber, squares, solvedCount, todayResult, PER_DAY } from '../games/emojidia/emojiDia.js'
import { dailyPlayers, recentGames } from '../lib/plays.js'
import AppPromo from '../components/AppPromo.jsx'

const MODE_LABEL = { online: 'Multiplayer', bot: 'vs Bot', solo: 'Solo', diario: 'Diário' }
// Os jogos grandes do topo: os 3 primeiros desta lista que a pessoa pode ver
// (o Bombas está em beta e só aparece aos testers).
const FEATURED_PICKS = ['emojis', 'stop', 'memes', 'sueca', 'palavras']
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

// Topo da página inicial: começar logo uma partida e o desafio de hoje.
function QuickStart() {
  const [done, setDone] = useState(null)
  const [players, setPlayers] = useState(null)
  const [n, setN] = useState(null)
  // Só no browser (o dia e o resultado dependem de quem visita).
  useEffect(() => {
    setN(dayNumber())
    setDone(todayResult())
    dailyPlayers('emojidia').then(setPlayers)
  }, [])
  return (
    <section className="home-quick" aria-label="Começar a jogar">
      <Link to="/jogos-para-discord" className="quick-card quick-card--discord" data-testid="quick-discord">
        <span className="quick-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.6 19.6 0 0 0-4.9 1.4C.6 9 -.3 13.6.1 18a19.8 19.8 0 0 0 6 3l1.3-2.1c-.7-.3-1.4-.6-2-1l.5-.4a14 14 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.5-5.1-.8-9.6-3.6-13.6zM8.3 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4zm7.4 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4z" /></svg>
        </span>
        <span className="quick-card__text">
          <b>Jogar com amigos no Discord</b>
          <small>Cria uma sala, cola o link no chat e joguem todos durante a chamada.</small>
        </span>
      </Link>
      <Link to="/sueca?modo=bot&jogar=1" className="quick-card quick-card--play" data-testid="quick-play">
        <span className="quick-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </span>
        <span className="quick-card__text">
          <b>Jogar já sozinho</b>
          <small>Sueca contra bots, sem conta e sem esperar.</small>
        </span>
      </Link>
      <Link to="/emoji-do-dia" className={`quick-card quick-card--daily${done ? ' quick-card--done' : ''}`} data-testid="quick-daily">
        <GameIcon game="emojidia" size={44} />
        <span className="quick-card__text">
          <b>Emoji do Dia{n ? ` #${n}` : ''}</b>
          {done ? (
            <small>Feito: {squares(done)} {solvedCount(done)}/{PER_DAY}. Volta amanhã!</small>
          ) : (
            <small>5 enigmas, os mesmos para toda a gente.{players > 0 ? ` ${players} ${players === 1 ? 'pessoa já jogou' : 'pessoas já jogaram'} hoje.` : ''}</small>
          )}
        </span>
        <span className="quick-card__cta">{done ? 'Partilhar' : 'Jogar'}</span>
      </Link>
    </section>
  )
}

// Os últimos jogos que esta pessoa abriu (só no browser).
function ContinuePlaying({ games }) {
  const [keys, setKeys] = useState([])
  useEffect(() => setKeys(recentGames()), [])
  const list = keys.map((k) => games.find((g) => g.key === k)).filter(Boolean).slice(0, 5)
  if (!list.length) return null
  return (
    <section className="home-continue" aria-label="Continuar a jogar" data-testid="continue-playing">
      <h2>Continuar a jogar</h2>
      <div className="home-continue__list">
        {list.map((g) => (
          <Link key={g.key} to={g.to} className="home-continue__item">
            <GameIcon game={g.key} size={32} />
            <span>{g.title}</span>
          </Link>
        ))}
      </div>
    </section>
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

      {browsing && <QuickStart />}
      {browsing && <ContinuePlaying games={games} />}
      {browsing && <AppPromo />}

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
            <h3>Feito para chamadas de Discord</h3>
            <p>Estão em chamada? Cria uma sala, cola o link no chat e joguem todos ao mesmo tempo, enquanto falam. <Link to="/jogos-para-discord">Ver os jogos para o Discord</Link>.</p>
          </div>
          <div>
            <h3>Sem instalar nada</h3>
            <p>Todos os jogos abrem no browser, no computador ou no telemóvel. Não há downloads, aplicações nem bots para adicionar ao servidor.</p>
          </div>
          <div>
            <h3>Também sozinho</h3>
            <p>Sem ninguém online? Joga contra bots, faz o Emoji do Dia ou um solitário. Cada vitória conta para as medalhas e para o top.</p>
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
