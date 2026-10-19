import { useParams } from 'react-router-dom'
import { GAMES } from '../data/games.js'
import GameIcon from '../components/GameIcon.jsx'
import Logo from '../components/Logo.jsx'
import MedalBadge from '../social/MedalBadge.jsx'
import { medalByKey } from '../data/medals.js'
import GamePreview from './GamePreview.jsx'
import './mockups.css'

const games = GAMES.filter((g) => !g.beta)
const byKey = Object.fromEntries(games.map((g) => [g.key, g]))
const players = (p) => (p === '1' ? '1 jogador' : `${p.replace(' a ', '–')} jogadores`)
const SHORT = {
  stop: 'Categorias, letras e rapidez.',
  emojis: 'Adivinha o filme pelos emojis.',
  xadrez: 'Contra o bot ou um amigo.',
  naval: 'Afunda a frota do adversário.',
  quatro: 'Quatro seguidas para ganhar.',
  palavras: 'Uma palavra nova por dia.',
  memes: 'O meme mais engraçado ganha.',
  snake: 'Come, cresce, não batas.',
  memoria: 'Encontra os pares.',
  cartas: 'Cores, números e +2.',
  noventa: 'Não passes dos 99.',
  verdades: 'Descobre a mentira.',
  frase: 'Acaba a frase, ganha votos.',
  galo: 'Três em linha, clássico.',
}
const ORDER = ['stop', 'emojis', 'xadrez', 'naval', 'quatro', 'palavras', 'memes', 'snake', 'memoria', 'cartas', 'noventa', 'verdades', 'frase', 'galo']

function Ad({ w, h, label = 'Publicidade' }) {
  return (
    <div className="mk-ad" style={{ width: w, height: h }}>
      <span>{label}</span>
      <small>{typeof w === 'number' ? `${w}×${h}` : `responsivo · ${h}px`}</small>
    </div>
  )
}

const Search = ({ light }) => (
  <label className={`mk-search${light ? ' mk-search--light' : ''}`}>
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
    <span>Pesquisar jogos…</span>
  </label>
)
const Play = () => (
  <span className="mk-play"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
)
const UserIco = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
)
const CATS = [
  ['Todos', 14, '▦'],
  ['Multiplayer', 13, '👥'],
  ['vs Bot', 6, '🤖'],
  ['Solo', 3, '👤'],
  ['Diários', 1, '📅'],
]

/* ------------------------------------------------------------------ A */
function MockA() {
  const g = byKey.emojis
  return (
    <div className="mk mk-a">
      <header className="mk-a-head">
        <Logo size={34} />
        <nav><a className="on">Jogos</a><a>Multiplayer</a><a>Classificações</a><a>Como funciona</a></nav>
        <Search />
        <button className="mk-btn mk-btn--red"><UserIco /> Entrar</button>
      </header>
      <div className="mk-a-body">
        <aside className="mk-rail"><Ad w={160} h={600} /></aside>
        <main className="mk-a-main">
          <section className="mk-a-hero">
            <div className="mk-a-hero__text">
              <p className="mk-a-eyebrow">Minijogos · Multiplayer · Sem instalar</p>
              <h1>O teu próximo jogo <em>começa aqui.</em></h1>
              <p className="mk-a-lead">14 minijogos grátis em português. Cria uma sala, envia o link e desafia os teus amigos.</p>
              <div className="mk-a-cta">
                <button className="mk-btn mk-btn--red mk-btn--lg">Explorar jogos →</button>
                <button className="mk-btn mk-btn--ghost mk-btn--lg">👥 Criar sala</button>
              </div>
              <ul className="mk-a-facts"><li><b>14</b> jogos</li><li><b>0 €</b> sempre</li><li><b>25</b> medalhas</li></ul>
            </div>
            <div className={`mk-a-feature mk-c--${g.key}`}>
              <div className="mk-a-feature__art"><GamePreview game="emojis" /></div>
              <div className="mk-a-feature__info">
                <span className="mk-tag">★ Em destaque</span>
                <h2>{g.title}</h2>
                <p>Adivinha o filme, a série ou o jogo pelos emojis antes dos outros.</p>
                <div className="mk-a-feature__foot"><span>{players(g.players)}</span><Play /></div>
              </div>
              <div className="mk-dots"><i className="on" /><i /><i /><i /></div>
            </div>
          </section>
          <div className="mk-center"><Ad w={728} h={90} /></div>
          <div className="mk-chips">
            {CATS.map(([l, n, ic], i) => <span key={l} className={`mk-chip${i === 0 ? ' on' : ''}`}><i>{ic}</i>{l}{i === 0 ? ` (${n})` : ''}</span>)}
          </div>
          <div className="mk-sec-head"><h2>Escolhe o teu jogo</h2><a>Ver todos os jogos →</a></div>
          <div className="mk-a-grid">
            {ORDER.slice(0, 8).map((k) => {
              const x = byKey[k]
              return (
                <article key={k} className={`mk-a-card mk-c--${k}`}>
                  <div className="mk-a-card__text">
                    <h3>{x.title}</h3>
                    <p>{SHORT[k]}</p>
                    <span className="mk-meta">👥 {players(x.players)}</span>
                  </div>
                  <div className="mk-a-card__art"><GamePreview game={k} /></div>
                  <Play />
                </article>
              )
            })}
          </div>
        </main>
        <aside className="mk-rail"><Ad w={160} h={600} /></aside>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ B */
function MockB() {
  return (
    <div className="mk mk-b">
      <header className="mk-b-head">
        <div className="mk-b-logo"><Logo size={30} /></div>
        <nav><a className="on">Início</a><a>Multiplayer</a><a>Diários</a><a>Classificações</a></nav>
        <Search light />
        <button className="mk-btn mk-btn--dark"><UserIco /> Entrar</button>
      </header>
      <div className="mk-b-body">
        <aside className="mk-rail"><Ad w={160} h={600} /></aside>
        <main className="mk-b-main">
          <section className="mk-b-top">
            <div className="mk-b-daily mk-c--palavras">
              <div className="mk-b-daily__text">
                <span className="mk-b-kicker">Jogo do dia · 19 out</span>
                <h1>Palavras</h1>
                <p>Adivinha a palavra de hoje em 6 tentativas. É a mesma para toda a gente.</p>
                <div className="mk-b-daily__row">
                  <button className="mk-btn mk-btn--white">Jogar a de hoje</button>
                  <span className="mk-b-timer">Nova palavra em <b>05:12:33</b></span>
                </div>
              </div>
              <div className="mk-b-daily__art"><GamePreview game="palavras" /></div>
            </div>
            <div className="mk-b-side">
              <div className="mk-b-box">
                <h3>Jogar com amigos</h3>
                <p>Escolhe um jogo, cria a sala e envia o link.</p>
                <div className="mk-b-pick">
                  {['stop', 'emojis', 'memes', 'noventa'].map((k) => <span key={k} className={k === 'stop' ? 'on' : ''}><GameIcon game={k} size={34} /></span>)}
                </div>
                <button className="mk-btn mk-btn--red mk-btn--full">Criar sala de Stop</button>
              </div>
              <div className="mk-b-box">
                <h3>Top da semana</h3>
                <ol className="mk-b-top3">
                  <li><b>1</b> ana_k <span>23 vitórias</span></li>
                  <li><b>2</b> trabs <span>19 vitórias</span></li>
                  <li><b>3</b> joao.p <span>14 vitórias</span></li>
                </ol>
              </div>
            </div>
          </section>
          <div className="mk-b-cats">
            {CATS.map(([l, n], i) => <span key={l} className={i === 0 ? 'on' : ''}>{l} <small>{n}</small></span>)}
          </div>
          <div className="mk-b-grid">
            {ORDER.slice(0, 10).map((k) => {
              const x = byKey[k]
              return (
                <article key={k} className={`mk-b-tile mk-c--${k}`}>
                  <div className="mk-b-tile__art"><GamePreview game={k} /></div>
                  <div className="mk-b-tile__info">
                    <h3>{x.title}</h3>
                    <span>{players(x.players)}</span>
                  </div>
                </article>
              )
            })}
          </div>
          <div className="mk-center"><Ad w="100%" h={90} /></div>
        </main>
        <aside className="mk-rail"><Ad w={160} h={600} /></aside>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ C */
function MockC() {
  const big = ['emojis', 'stop']
  const rest = ORDER.filter((k) => !big.includes(k))
  return (
    <div className="mk mk-c">
      <aside className="mk-c-nav">
        <div className="mk-c-logo"><Logo size={28} /></div>
        <Search />
        <nav>
          <a className="on"><i>⌂</i>Início</a>
          <a><i>👥</i>Multiplayer <small>13</small></a>
          <a><i>🤖</i>vs Bot <small>6</small></a>
          <a><i>👤</i>Solo <small>3</small></a>
          <a><i>📅</i>Diários <small>1</small></a>
          <hr />
          <a><i>🏆</i>Classificações</a>
          <a><i>💬</i>Amigos</a>
        </nav>
        <div className="mk-c-promo">
          <div className="mk-c-medals">
            <MedalBadge medal={medalByKey['primeira-vitoria']} size={46} title="" />
            <MedalBadge medal={medalByKey.lenda} size={58} title="" />
            <MedalBadge medal={medalByKey.popular} size={46} title="" />
          </div>
          <p>Joga com amigos, ganha troféus e sobe no top.</p>
          <button className="mk-btn mk-btn--red mk-btn--full">Criar conta grátis</button>
        </div>
      </aside>
      <main className="mk-c-main">
        <header className="mk-c-head">
          <h1>Bom jogo! <span>Escolhe um e começa já.</span></h1>
          <button className="mk-btn mk-btn--ghost"><UserIco /> Entrar</button>
        </header>
        <div className="mk-c-grid">
          {big.map((k) => {
            const x = byKey[k]
            return (
              <article key={k} className={`mk-c-tile mk-c-tile--big mk-c--${k}`}>
                <GamePreview game={k} />
                <div className="mk-c-tile__info">
                  <GameIcon game={k} size={40} />
                  <div><h3>{x.title}</h3><span>{players(x.players)} · Multiplayer</span></div>
                  <Play />
                </div>
              </article>
            )
          })}
          {rest.slice(0, 6).map((k) => (
            <article key={k} className={`mk-c-tile mk-c--${k}`}>
              <GamePreview game={k} />
              <span className="mk-c-tile__name">{byKey[k].title}</span>
            </article>
          ))}
          <div className="mk-c-infeed"><Ad w="100%" h={90} label="Publicidade (no meio da grelha)" /></div>
          {rest.slice(6, 12).map((k) => (
            <article key={k} className={`mk-c-tile mk-c--${k}`}>
              <GamePreview game={k} />
              <span className="mk-c-tile__name">{byKey[k].title}</span>
            </article>
          ))}
        </div>
      </main>
      <aside className="mk-rail mk-rail--sticky"><Ad w={160} h={600} /></aside>
    </div>
  )
}

export default function Mockups() {
  const { v } = useParams()
  return v === 'b' ? <MockB /> : v === 'c' ? <MockC /> : <MockA />
}
