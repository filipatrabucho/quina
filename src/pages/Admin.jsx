import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSocial } from '../social/SocialContext.jsx'
import { listStaff, setStaff } from '../lib/social.js'
import { GAMES } from '../data/games.js'

// Gestão de quem vê os jogos em beta (só para o admin).
export default function Admin() {
  const s = useSocial()
  const [staff, setStaffList] = useState([])
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('tester')
  const [msg, setMsg] = useState({ error: '', info: '' })
  const [busy, setBusy] = useState(false)
  const isAdmin = s?.role === 'admin'

  const load = () => listStaff().then(setStaffList).catch((e) => setMsg({ error: e.message, info: '' }))
  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin])

  if (!s?.roleLoaded) return <p className="page-loading">A carregar…</p>
  if (!isAdmin) {
    return (
      <main className="account-page">
        <h2 className="game-title">Admin</h2>
        <p>Esta página é só para o administrador.</p>
        <Link to="/" className="btn btn--primary btn--small">Voltar ao início</Link>
      </main>
    )
  }

  const run = async (fn, info) => {
    setBusy(true)
    setMsg({ error: '', info: '' })
    try {
      await fn()
      await load()
      setMsg({ error: '', info })
    } catch (e) {
      setMsg({ error: e.message, info: '' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="account-page admin-page">
      <h2 className="game-title">Admin · Testers</h2>
      <div className="account-card">
        <p className="admin-note">
          Os jogos em beta ({GAMES.filter((g) => g.beta).map((g) => g.title).join(', ')}) só aparecem a quem está nesta lista.
        </p>
        <form
          className="admin-add"
          onSubmit={(e) => {
            e.preventDefault()
            if (username.trim()) run(() => setStaff(username, role), `${username.trim()} adicionado como ${role}.`).then(() => setUsername(''))
          }}
        >
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username do jogador" aria-label="Username" data-testid="admin-username" />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Papel">
            <option value="tester">Tester</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn btn--primary btn--small" disabled={busy || !username.trim()} data-testid="admin-add">Adicionar</button>
        </form>
        {msg.error && <p className="duel-error">{msg.error}</p>}
        {msg.info && <p className="account-info">{msg.info}</p>}
        <ul className="admin-list" data-testid="admin-list">
          {staff.map((x) => (
            <li key={x.user_id}>
              <Link to={`/u/${x.username}`}>{x.username || x.user_id}</Link>
              <span className={`admin-role admin-role--${x.role}`}>{x.role}</span>
              {x.user_id !== s.myId && (
                <button className="link-btn" disabled={busy} onClick={() => run(() => setStaff(x.username, null), `${x.username} removido.`)}>
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
