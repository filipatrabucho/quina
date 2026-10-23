import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSocial } from '../social/SocialContext.jsx'
import { adminListUsers, adminSetRole, adminStats, adminPlayStats, adminRecentPlays, adminSetGameBeta, adminRetention } from '../lib/social.js'
import { GAMES, gameByKey, defaultBeta } from '../data/games.js'
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

function Games({ stats, social }) {
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState({ error: '', info: '' })
  const byGame = Object.fromEntries((stats?.games || []).map((g) => [g.game, g]))
  const list = [...GAMES].sort((a, b) => (b.beta ? 1 : 0) - (a.beta ? 1 : 0) || (byGame[b.key]?.plays || 0) - (byGame[a.key]?.plays || 0))

  const toggle = async (g) => {
    const toBeta = !g.beta
    const ok = window.confirm(
      toBeta
        ? `Pôr ${g.title} em beta?\n\nDeixa de aparecer no menu e na página inicial e só o admin e os testers o podem abrir.`
        : `Pôr ${g.title} em produção?\n\nPassa a aparecer a toda a gente no menu e na página inicial.`,
    )
    if (!ok) return
    setBusy(g.key)
    setMsg({ error: '', info: '' })
    try {
      await adminSetGameBeta(g.key, toBeta)
      await social.refreshCatalog()
      setMsg({ error: '', info: toBeta ? `${g.title} está agora em beta.` : `${g.title} está agora em produção: já aparece a toda a gente.` })
    } catch (e) {
      setMsg({ error: e.message, info: '' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="bo-card">
      <p className="admin-note">
        Os jogos em <strong>beta</strong> só aparecem aos admins e testers: não estão no menu nem na página inicial para os outros, e não vão para o Google.
        A mudança vale logo no site (até 1 minuto para quem já o tem aberto). O Google e o sitemap só a veem na próxima publicação do site.
      </p>
      {msg.error && <p className="duel-error">{msg.error}</p>}
      {msg.info && <p className="account-info" data-testid="bo-game-msg">{msg.info}</p>}
      <div className="bo-table-wrap">
        <table className="bo-table" data-testid="bo-games">
          <thead>
            <tr><th>Jogo</th><th>Estado</th><th className="bo-num">Jogadores</th><th className="bo-num">Partidas</th><th className="bo-num">Mudar</th></tr>
          </thead>
          <tbody>
            {list.map((g) => (
              <tr key={g.key} data-game={g.key}>
                <td><Link to={g.to} className="bo-user"><GameIcon game={g.key} size={30} /><b>{g.title}</b></Link></td>
                <td>
                  {g.beta ? <span className="admin-role">Beta</span> : <span className="bo-live">Produção</span>}
                  {g.beta !== defaultBeta(g.key) && <small className="bo-changed"> mudado no backoffice</small>}
                </td>
                <td className="bo-num">{byGame[g.key]?.players ?? 0}</td>
                <td className="bo-num">{byGame[g.key]?.plays ?? 0}</td>
                <td className="bo-num">
                  <button
                    type="button"
                    className={`btn btn--small ${g.beta ? 'btn--primary' : 'btn--outline'}`}
                    disabled={busy === g.key}
                    onClick={() => toggle(g)}
                    data-testid={`bo-toggle-${g.key}`}
                  >
                    {busy === g.key ? 'A guardar…' : g.beta ? 'Pôr em produção' : 'Pôr em beta'}
                  </button>
                </td>
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

const pct = (n, base) => (base ? `${Math.round((100 * n) / base)}%` : '–')

// Quem volta: por browser, com ou sem os browsers dos admins e testers.
function Retention({ period }) {
  const [noStaff, setNoStaff] = useState(true)
  const [r, setR] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setError('')
    adminRetention(period, noStaff).then(setR, (e) => setError(e.message))
  }, [period, noStaff])
  return (
    <section className="bo-card" data-testid="bo-retention">
      <div className="bo-card__head">
        <h2 className="bo-card__title">Quem volta</h2>
        <label className="bo-check">
          <input type="checkbox" checked={noStaff} onChange={(e) => setNoStaff(e.target.checked)} data-testid="bo-no-staff" />
          Sem admins e testers{r ? ` (${r.staff_browsers} browsers)` : ''}
        </label>
      </div>
      {error && <p className="duel-error">{error}</p>}
      <div className="bo-stats">
        <Stat label="Pessoas" value={r?.people} hint="browsers diferentes" />
        <Stat label="Novas" value={r?.new} hint="primeira visita no período" />
        <Stat label="Voltaram" value={r?.returning} hint={r ? `vieram em 2 ou mais dias · ${r.reminders} com lembrete diário` : 'vieram em 2 ou mais dias'} />
        <Stat label="No dia seguinte" value={r ? pct(r.d1, r.d1_base) : null} hint={r ? `${r.d1} de ${r.d1_base} novas · na 1.ª semana: ${pct(r.d7, r.d7_base)} (${r.d7}/${r.d7_base})` : null} />
      </div>
      {r?.cohorts?.length > 0 && (
        <div className="bo-table-wrap">
          <table className="bo-table" data-testid="bo-cohorts">
            <thead>
              <tr><th>Primeira visita</th><th className="bo-num">Novas</th><th className="bo-num">Voltaram no dia seguinte</th><th className="bo-num">Voltaram (qualquer dia)</th></tr>
            </thead>
            <tbody>
              {r.cohorts.slice(0, 14).map((c) => (
                <tr key={c.day}>
                  <td>{dayLabel(c.day)}</td>
                  <td className="bo-num">{c.new}</td>
                  <td className="bo-num">{c.d1} <small>{pct(c.d1, c.new)}</small></td>
                  <td className="bo-num">{c.again} <small>{pct(c.again, c.new)}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="admin-note" style={{ margin: 0 }}>
        Conta-se por browser (o mesmo telemóvel ou computador). Quem joga em dois aparelhos conta duas vezes. "Na 1.ª semana" só conta quem chegou há pelo menos 7 dias.
      </p>
    </section>
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
      <Retention period={period} />
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

// "há 5 min", "há 3 h", "ontem 21:04", "12 out 18:30"
function ago(d) {
  const t = new Date(d)
  const s = Math.max(0, (Date.now() - t.getTime()) / 1000)
  if (s < 60) return 'agora mesmo'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 6 * 3600) return `há ${Math.floor(s / 3600)} h`
  const hm = t.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  const day = new Date(t).setHours(0, 0, 0, 0)
  const today = new Date().setHours(0, 0, 0, 0)
  if (day === today) return `hoje ${hm}`
  if (today - day === 86400000) return `ontem ${hm}`
  return `${t.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} ${hm}`
}

// Atividade: novas contas e últimas partidas (atualiza sozinha).
function Activity() {
  const [users, setUsers] = useState(null)
  const [plays, setPlays] = useState(null)
  const [onlyFinished, setOnlyFinished] = useState(false)
  const [error, setError] = useState('')
  const shown = (plays || []).filter((r) => !onlyFinished || r.kind === 'partida').slice(0, 40)
  const load = useCallback(() => {
    adminListUsers({ limit: 15 }).then((d) => setUsers(d.users), (e) => setError(e.message))
    adminRecentPlays(60).then(setPlays, (e) => setError(e.message))
  }, [])
  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])
  return (
    <div className="bo-activity">
      {error && <p className="duel-error">{error}</p>}
      <section className="bo-card" data-testid="bo-new-users">
        <h2 className="bo-card__title">Novos utilizadores</h2>
        {!users ? (
          <p className="bo-empty">A carregar…</p>
        ) : !users.length ? (
          <p className="bo-empty">Ainda não há contas.</p>
        ) : (
          <ul className="bo-feed">
            {users.map((u) => (
              <li key={u.user_id}>
                <Link to={`/u/${u.username}`} className="bo-user">
                  <Avatar src={u.avatar_url} seed={u.user_id} name={u.username} size={30} />
                  <span>
                    <b>{u.username}</b>
                    <small>{PROVIDER[u.provider] || u.provider} · {u.plays} {Number(u.plays) === 1 ? 'partida' : 'partidas'}</small>
                  </span>
                </Link>
                <time dateTime={u.created_at}>{ago(u.created_at)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="bo-card" data-testid="bo-recent-plays">
        <div className="bo-card__head">
          <h2 className="bo-card__title">Últimos jogos jogados</h2>
          <label className="bo-check">
            <input type="checkbox" checked={onlyFinished} onChange={(e) => setOnlyFinished(e.target.checked)} data-testid="bo-only-finished" />
            Só partidas acabadas
          </label>
        </div>
        {!plays ? (
          <p className="bo-empty">A carregar…</p>
        ) : !shown.length ? (
          <p className="bo-empty">{onlyFinished ? 'Ainda ninguém acabou uma partida.' : 'Ainda não há atividade.'}</p>
        ) : (
          <ul className="bo-feed">
            {shown.map((r) => {
              const g = gameByKey(r.game)
              return (
                <li key={r.id}>
                  <span className="bo-user">
                    <GameIcon game={r.game} size={30} />
                    <span>
                      <b>{g?.title || r.game}</b>
                      <small>
                        {r.username ? <Link to={`/u/${r.username}`}>{r.username}</Link> : `Convidado ${r.visitor.slice(-4)}`}
                        {r.kind !== 'abriu' && <>{' · '}{r.mode === 'online' ? 'online' : 'sozinho/bots'}</>}
                      </small>
                    </span>
                  </span>
                  <span className="bo-feed__end">
                    {r.kind === 'abriu' ? (
                      <span className="bo-result bo-result--open" title="Abriu o jogo (ainda não acabou nenhuma partida)">Abriu</span>
                    ) : (
                      <span className={`bo-result${r.won ? ' bo-result--win' : ''}`}>{r.won ? 'Ganhou' : 'Perdeu'}</span>
                    )}
                    <time dateTime={r.created_at}>{ago(r.created_at)}</time>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
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
        <button type="button" role="tab" aria-selected={tab === 'activity'} className={`bo-tab${tab === 'activity' ? ' bo-tab--on' : ''}`} onClick={() => setTab('activity')} data-testid="bo-tab-activity">Atividade</button>
        <button type="button" role="tab" aria-selected={tab === 'users'} className={`bo-tab${tab === 'users' ? ' bo-tab--on' : ''}`} onClick={() => setTab('users')}>Utilizadores e testers</button>
        <button type="button" role="tab" aria-selected={tab === 'games'} className={`bo-tab${tab === 'games' ? ' bo-tab--on' : ''}`} onClick={() => setTab('games')}>Jogos</button>
      </div>
      {tab === 'plays' && <Plays />}
      {tab === 'activity' && <Activity />}
      {tab === 'users' && <Users myId={s.myId} onChanged={loadStats} />}
      {tab === 'games' && <Games stats={stats} social={s} />}
    </main>
  )
}
