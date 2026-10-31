import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar.jsx'
import { getSiteRanking } from '../lib/social.js'
import { useAuth } from '../hooks/useAuth.js'

export const RANK_CATEGORIES = [
  { key: 'plays', title: 'Mais partidas', icon: '🎮', unit: ['partida', 'partidas'], hint: 'quem jogou mais partidas até ao fim' },
  { key: 'wins', title: 'Mais vitórias', icon: '🏆', unit: ['vitória', 'vitórias'], hint: 'quem ganhou mais partidas' },
  { key: 'days', title: 'Mais ativos', icon: '🔥', unit: ['dia', 'dias'], hint: 'em quantos dias diferentes jogou' },
  { key: 'games', title: 'Exploradores', icon: '🧭', unit: ['jogo', 'jogos'], hint: 'quantos jogos diferentes já jogou' },
]
const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 0, label: 'Sempre' },
]
const unitOf = (cat, n) => cat.unit[n === 1 ? 0 : 1]

export function RankList({ cat, list, meId, compact = false }) {
  if (!list?.length) return <p className="rank-empty">Ainda ninguém aqui. Cria conta, joga e aparece no top!</p>
  return (
    <ol className={`rank-list${compact ? ' rank-list--compact' : ''}`}>
      {list.map((x) => (
        <li key={x.id} className={`rank-row rank-row--${x.rank}${x.id === meId ? ' rank-row--me' : ''}`}>
          <span className="rank-pos">{x.rank}</span>
          <Avatar src={x.avatar_url} seed={x.id} name={x.username} size={compact ? 26 : 32} />
          <Link to={`/u/${x.username}`} className="rank-name">{x.username}{x.id === meId ? ' (tu)' : ''}</Link>
          <span className="rank-val"><b>{x.value}</b> {unitOf(cat, x.value)}</span>
        </li>
      ))}
    </ol>
  )
}

export default function Ranking() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const meId = user && !user.is_anonymous ? user.id : null

  useEffect(() => {
    let alive = true
    setData(null)
    setError('')
    getSiteRanking(days, 5).then((d) => alive && setData(d), () => alive && setError('Não deu para carregar o ranking. Tenta outra vez daqui a pouco.'))
    return () => {
      alive = false
    }
  }, [days, meId])

  return (
    <main className="ranking-page">
      <header className="ranking-head">
        <h1>🏆 Ranking</h1>
        <p>Quem joga mais, quem ganha mais e quem não falha um dia. Contam as partidas de quem tem conta.</p>
        <div className="ranking-periods" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button key={p.days} type="button" className={`home-cat${days === p.days ? ' home-cat--active' : ''}`} aria-pressed={days === p.days} onClick={() => setDays(p.days)} data-testid={`rank-days-${p.days}`}>
              {p.label}
            </button>
          ))}
        </div>
      </header>
      {error && <p className="duel-error">{error}</p>}
      {data?.me && (
        <section className="ranking-me" data-testid="ranking-me">
          <b>A tua posição:</b>
          {RANK_CATEGORIES.map((c) => (
            <span key={c.key}>{c.icon} {c.title}: {data.me[c.key].rank ? `#${data.me[c.key].rank}` : '–'} <small>({data.me[c.key].value} {unitOf(c, data.me[c.key].value)})</small></span>
          ))}
        </section>
      )}
      {!meId && (
        <p className="ranking-cta">
          <Link to="/conta?modo=criar&voltar=%2Franking">Cria uma conta grátis</Link> para as tuas partidas contarem para o ranking.
        </p>
      )}
      <div className="ranking-grid" data-testid="ranking-grid">
        {RANK_CATEGORIES.map((c) => (
          <section key={c.key} className="ranking-card" data-testid={`ranking-${c.key}`}>
            <h2><span aria-hidden="true">{c.icon}</span> {c.title}</h2>
            <p className="ranking-card__hint">{c.hint}</p>
            {data ? <RankList cat={c} list={data[c.key]} meId={meId} /> : !error && <p className="rank-empty">A carregar…</p>}
          </section>
        ))}
      </div>
      {data && <p className="modal-note ranking-foot">{data.players} {data.players === 1 ? 'jogador com conta jogou' : 'jogadores com conta jogaram'} {days ? `nos últimos ${days} dias` : 'desde o início'}.</p>}
    </main>
  )
}
