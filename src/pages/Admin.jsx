import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSocial } from '../social/SocialContext.jsx'
import { adminListUsers, adminSetRole, adminStats, adminPlayStats } from '../lib/social.js'
import { GAMES, gameByKey } from '../data/games.js'
import Avatar from '../components/Avatar.jsx'
import GameIcon from '../components/GameIcon.jsx'

const PAGE = 25
const ROLE_LABEL = { admin: 'Admin', tester: 'Tester', jogador: 'Jogador' }
const FILTERS = [
  { key: null, label: 'Todos' },
  { key: 'tester', label: 'Testers' },
  { key: 'admin', label: 'Admins' },
  { key: 'jogador', label: 'Jogadores' },
]
const PROVIDER = { email: 'Email', google: 'Google', discord: 'Discord' }

const fmtDate = (d) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })

function Stat({ label, value, hint }) {
  return (
    <div className="bo-stat">
      <span>{label}</span>
      <b>{value ?? '–'}</b>
      {hint && <small>{hint}</small>}
    </div>
  )
}

function Users({ myId, onChanged }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filter, setFilter] = useState(null)
  const [page, setPage] = useState(0)
  const [data, setData] = useState({ users: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState({ error: '', info: '' })

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(t)
  }, [query])
  useEffect(() => setPage(0), [debounced, filter])

  const load = useCallback(() => {
    setLoading(true)
    return adminListUsers({ query: debounced, role: filter, limit: PAGE, offset: page * PAGE })
      .then(setData)
      .catch((e) => setMsg({ error: e.message, info: '' }))
      .finally(() => setLoading(false))
  }, [debounced, filter, page])
  useEffect(() => {
    load()
  }, [load])

  const change = async (u, role) => {
    setBusy(u.user_id)
    setMsg({ error: '', info: '' })
    try {
      await adminSetRole(u.user_id, role)
      await load()
      onChanged()
      setMsg({ error: '', info: role === 'jogador' ? `${u.username} já não é ${ROLE_LABEL[u.role]?.toLowerCase()}.` : `${u.username} é agora ${ROLE_LABEL[role].toLowerCase()}. Vê os jogos em beta dentro de segundos.` })
    } catch (e) {
      setMsg({ error: e.message, info: '' })
    } finally {
      setBusy(null)
    }
  }

  const pages = Math.max(1, Math.ceil(data.total / PAGE))
  return (
    <section className="bo-card">
      <div className="bo-toolbar">
        <label className="side-search bo-search">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar por username ou email" aria-label="Procurar utilizadores" data-testid="bo-search" />
        </label>
        <div className="bo-filters" role="tablist" aria-label="Filtrar por papel">
          {FILTERS.map((f) => (
            <button key={f.label} type="button" role="tab" aria-selected={filter === f.key} className={`home-cat${filter === f.key ? ' home-cat--active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {msg.error && <p className="duel-error">{msg.error}</p>}
      {msg.info && <p className="account-info" data-testid="bo-info">{msg.info}</p>}

      <div className="bo-table-wrap">
        <table className="bo-table" data-testid="bo-users">
          <thead>
            <tr>
              <th>Utilizador</th>
              <th className="bo-hide-sm">Email</th>
              <th className="bo-hide-sm">Entrou</th>
              <th className="bo-num">Partidas</th>
              <th>Papel</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => {
              const role = u.role || 'jogador'
              return (
                <tr key={u.user_id} data-testid={`bo-user-${u.username}`}>
                  <td>
                    <Link to={`/u/${u.username}`} className="bo-user">
                      <Avatar src={u.avatar_url} seed={u.user_id} name={u.username} size={30} />
                      <span>
                        <b>{u.username}</b>
                        <small>{PROVIDER[u.provider] || u.provider}</small>
                      </span>
                    </Link>
                  </td>
                  <td className="bo-hide-sm bo-email">{u.email}</td>
                  <td className="bo-hide-sm">{fmtDate(u.created_at)}</td>
                  <td className="bo-num">{u.plays}<small> · {u.wins} V</small></td>
                  <td>
                    <select
                      className={`bo-role bo-role--${role}`}
                      value={role}
                      disabled={busy === u.user_id || (u.user_id === myId)}
                      onChange={(e) => change(u, e.target.value)}
                      aria-label={`Papel de ${u.username}`}
                      data-testid={`bo-role-${u.username}`}
                    >
                      <option value="jogador">Jogador</option>
                      <option value="tester">Tester</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              )
            })}
            {!loading && !data.users.length && (
              <tr><td colSpan={5} className="bo-empty">Nenhum utilizador encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="bo-pager">
        <span>{data.total} {data.total === 1 ? 'utilizador' : 'utilizadores'}{loading ? ' · a carregar…' : ''}</span>
        <button type="button" className="mode-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Anterior</button>
        <span>Página {page + 1} de {pages}</span>
        <button type="button" className="mode-btn" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Seguinte →</button>
      </div>
    </section>
  )
}

function Games({ stats }) {
  const byGame = Object.fromEntries((stats?.games || []).map((g) => [g.game, g]))
  const list = [...GAMES].sort((a, b) => (b.beta ? 1 : 0) - (a.beta ? 1 : 0) || (byGame[b.key]?.plays || 0) - (byGame[a.key]?.plays || 0))
  return (
    <section className="bo-card">
      <p className="admin-note">
        Os jogos em <strong>beta</strong> só aparecem aos admins e testers: não estão no menu nem na página inicial para os outros, e não vão para o Google.
        Para tirar um jogo de beta, diz-me qual e eu publico.
      </p>
      <div className="bo-table-wrap">
        <table className="bo-table" data-testid="bo-games">
          <thead>
            <tr><th>Jogo</th><th>Estado</th><th className="bo-num">Jogadores</th><th className="bo-num">Partidas</th></tr>
          </thead>
          <tbody>
            {list.map((g) => (
              <tr key={g.key}>
                <td><Link to={g.to} className="bo-user"><GameIcon game={g.key} size={30} /><b>{g.title}</b></Link></td>
                <td>{g.beta ? <span className="admin-role">Beta</span> : <span className="bo-live">Público</span>}</td>
                <td className="bo-num">{byGame[g.key]?.players ?? 0}</td>
                <td className="bo-num">{byGame[g.key]?.plays ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const PERIODS = [7, 30, 90]
const dayLabel = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })

// Pessoas por dia (uma série: barras finas, valor ao passar o rato).
function DayBars({ days, period }) {
  const byDay = Object.fromEntries(days.map((d) => [d.day, d]))
  const list = []
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const key = d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Lisbon' })
    list.push({ day: key, players: byDay[key]?.players || 0, plays: byDay[key]?.plays || 0 })
  }
  const max = Math.max(1, ...list.map((d) => d.players))
  return (
    <figure className="bo-chart">
      <figcaption>Pessoas que jogaram, por dia</figcaption>
      <div className="bo-bars" data-testid="bo-day-bars">
        <span className="bo-bars__max">{max}</span>
        {list.map((d) => (
          <div key={d.day} className="bo-bar" tabIndex={0} aria-label={`${dayLabel(d.day)}: ${d.players} pessoas, ${d.plays} partidas`}>
            <i style={{ height: `${(d.players / max) * 100}%` }} />
            <span className="bo-bar__tip">{dayLabel(d.day)}<br /><b>{d.players}</b> pessoas · {d.plays} partidas</span>
          </div>
        ))}
      </div>
      <div className="bo-bars__axis"><span>{dayLabel(list[0].day)}</span><span>Hoje</span></div>
    </figure>
  )
}

function Plays() {
  const [period, setPeriod] = useState(30)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setError('')
    adminPlayStats(period).then(setData, (e) => setError(e.message))
  }, [period])
  const t = data?.totals
  const byGame = Object.fromEntries((data?.games || []).map((g) => [g.game, g]))
  const list = [...GAMES].sort((a, b) => (byGame[b.key]?.players || 0) - (byGame[a.key]?.players || 0) || (byGame[b.key]?.opened || 0) - (byGame[a.key]?.opened || 0))
  return (
    <section className="bo-card" data-testid="bo-plays">
      <div className="bo-toolbar">
        <p className="admin-note" style={{ margin: 0, flex: '1 1 260px' }}>
          Conta toda a gente, com e sem conta. <b>Abriram</b> = abriram a página do jogo; <b>Jogaram</b> = acabaram pelo menos uma partida.
        </p>
        <div className="bo-filters">
          {PERIODS.map((p) => (
            <button key={p} type="button" className={`home-cat${period === p ? ' home-cat--active' : ''}`} onClick={() => setPeriod(p)} data-testid={`bo-period-${p}`}>
              {p} dias
            </button>
          ))}
        </div>
      </div>
      {error && <p className="duel-error">{error}</p>}
      <div className="bo-stats">
        <Stat label="Abriram um jogo" value={t?.visitors} hint="pessoas diferentes" />
        <Stat label="Jogaram" value={t?.players} hint="acabaram uma partida" />
        <Stat label="Partidas" value={t?.plays} hint={t ? `${(t.plays / Math.max(1, t.players)).toFixed(1)} por pessoa` : null} />
        <Stat label="Sem conta / com conta" value={t ? `${t.guest_players} / ${t.account_players}` : null} hint="pessoas que jogaram" />
      </div>
      {data && <DayBars days={data.days} period={period} />}
      <div className="bo-table-wrap">
        <table className="bo-table" data-testid="bo-plays-table">
          <thead>
            <tr><th>Jogo</th><th className="bo-num">Abriram</th><th className="bo-num">Jogaram</th><th className="bo-num">Partidas</th><th className="bo-num">Sozinho/bots</th><th className="bo-num">Online</th></tr>
          </thead>
          <tbody>
            {list.map((g) => {
              const r = byGame[g.key]
              return (
                <tr key={g.key}>
                  <td><Link to={g.to} className="bo-user"><GameIcon game={g.key} size={30} /><b>{g.title}</b></Link></td>
                  <td className="bo-num">{r?.opened ?? 0}</td>
                  <td className="bo-num"><b>{r?.players ?? 0}</b></td>
                  <td className="bo-num">{r?.plays ?? 0}</td>
                  <td className="bo-num">{r?.solo ?? 0}</td>
                  <td className="bo-num">{r?.online ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// Backoffice: utilizadores, testers e jogos (só para o admin).
export default function Admin() {
  const s = useSocial()
  const [tab, setTab] = useState('plays')
  const [stats, setStats] = useState(null)
  const isAdmin = s?.role === 'admin'
  const loadStats = useCallback(() => adminStats().then(setStats).catch(() => {}), [])
  useEffect(() => {
    if (isAdmin) loadStats()
  }, [isAdmin, loadStats])

  if (!s?.roleLoaded) return <p className="page-loading">A carregar…</p>
  if (!isAdmin) {
    return (
      <main className="account-page">
        <h2 className="game-title">Backoffice</h2>
        <p>Esta página é só para o administrador.</p>
        <Link to="/" className="btn btn--primary btn--small">Voltar ao início</Link>
      </main>
    )
  }

  const betaGames = GAMES.filter((g) => g.beta)
  return (
    <main className="bo" data-testid="backoffice">
      <div className="bo-head">
        <h1>Backoffice</h1>
        <p>Gere quem pode testar os jogos em beta ({betaGames.map((g) => gameByKey(g.key).title).join(', ')}).</p>
      </div>
      <div className="bo-stats">
        <Stat label="Utilizadores" value={stats?.users} hint={stats ? `+${stats.users_7d} nos últimos 7 dias` : null} />
        <Stat label="Testers" value={stats?.testers} hint={stats ? `${stats.admins} admin${stats.admins === 1 ? '' : 's'}` : null} />
        <Stat label="Partidas jogadas" value={stats?.plays} hint="com conta" />
        <Stat label="Jogos em beta" value={betaGames.length} hint={`de ${GAMES.length} jogos`} />
      </div>
      <div className="bo-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'plays'} className={`bo-tab${tab === 'plays' ? ' bo-tab--on' : ''}`} onClick={() => setTab('plays')} data-testid="bo-tab-plays">Quem jogou</button>
        <button type="button" role="tab" aria-selected={tab === 'users'} className={`bo-tab${tab === 'users' ? ' bo-tab--on' : ''}`} onClick={() => setTab('users')}>Utilizadores e testers</button>
        <button type="button" role="tab" aria-selected={tab === 'games'} className={`bo-tab${tab === 'games' ? ' bo-tab--on' : ''}`} onClick={() => setTab('games')}>Jogos</button>
      </div>
      {tab === 'plays' && <Plays />}
      {tab === 'users' && <Users myId={s.myId} onChanged={loadStats} />}
      {tab === 'games' && <Games stats={stats} />}
    </main>
  )
}
