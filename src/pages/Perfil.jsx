import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProfileByUsername, getMedalsAndStats, SOCIAL_NETWORKS, socialUrl } from '../lib/social.js'
import { MEDALS } from '../data/medals.js'
import { GAMES } from '../data/games.js'
import { useSocial } from '../social/SocialContext.jsx'
import Avatar from '../components/Avatar.jsx'
import GameIcon from '../components/GameIcon.jsx'
import MedalBadge from '../social/MedalBadge.jsx'

function FriendButton({ profile }) {
  const s = useSocial()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!s?.enabled || !s.me) {
    return <Link className="btn btn--outline btn--small" to="/conta">Entrar para adicionar</Link>
  }
  if (profile.id === s.myId) return <Link className="btn btn--outline btn--small" to="/conta">Editar perfil</Link>
  const rel = s.relationWith(profile.id)
  const run = async (fn) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="profile-actions">
      {rel.state === 'nenhuma' && (
        <button className="btn btn--primary btn--small" disabled={busy} onClick={() => run(() => s.addFriend(profile.id))}>
          Adicionar amigo
        </button>
      )}
      {rel.state === 'enviado' && <span className="chat-tag">Pedido enviado</span>}
      {rel.state === 'recebido' && (
        <button className="btn btn--primary btn--small" disabled={busy} onClick={() => run(() => s.acceptFriend(rel.friendship.id))}>
          Aceitar pedido
        </button>
      )}
      {rel.state === 'amigos' && (
        <>
          <button className="btn btn--primary btn--small" onClick={() => s.openConversation(profile.id)}>
            Enviar mensagem
          </button>
          <button
            className="btn btn--outline btn--small"
            disabled={busy}
            onClick={() => window.confirm(`Remover ${profile.username} dos amigos?`) && run(() => s.removeFriend(rel.friendship.id))}
          >
            Remover amigo
          </button>
        </>
      )}
      {error && <p className="duel-error">{error}</p>}
    </div>
  )
}

export default function Perfil() {
  const { username } = useParams()
  const [state, setState] = useState({ loading: true })
  const s = useSocial()

  useEffect(() => {
    let alive = true
    setState({ loading: true })
    ;(async () => {
      try {
        const profile = await getProfileByUsername(username)
        if (!profile) return alive && setState({ loading: false, notFound: true })
        const { medals, stats } = await getMedalsAndStats(profile.id)
        if (alive) setState({ loading: false, profile, medals, stats })
      } catch (e) {
        if (alive) setState({ loading: false, error: e.message })
      }
    })()
    return () => {
      alive = false
    }
  }, [username])

  if (state.loading) return <main className="profile-page"><p className="page-loading">A carregar…</p></main>
  if (state.notFound || state.error) {
    return (
      <main className="profile-page">
        <h2 className="game-title">Perfil não encontrado</h2>
        <p className="modal-note">{state.error || `Não existe nenhum jogador com o username «${username}».`}</p>
        <Link className="btn btn--outline btn--small" to="/">Voltar ao início</Link>
      </main>
    )
  }

  const { profile, medals, stats } = state
  const earned = new Map(medals.map((m) => [m.medal, m.earned_at]))
  const statByGame = Object.fromEntries(stats.map((x) => [x.game, x]))
  const totalWins = stats.reduce((a, x) => a + x.wins, 0)
  const totalPlays = stats.reduce((a, x) => a + x.plays, 0)
  const links = SOCIAL_NETWORKS.map((n) => ({ ...n, value: profile.links?.[n.key], url: socialUrl(n.key, profile.links?.[n.key]) })).filter((n) => n.value)
  const since = new Date(profile.created_at).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })

  return (
    <main className="profile-page">
      <section className="profile-head">
        <Avatar src={profile.avatar_url} seed={profile.id} name={profile.username} size={112} />
        <div className="profile-head__info">
          <h1>
            {profile.username}
            {s?.online?.has(profile.id) && <span className="chat-online-text">online</span>}
          </h1>
          <p className="profile-since">Membro desde {since}</p>
          {profile.bio ? <p className="profile-bio">{profile.bio}</p> : <p className="profile-bio profile-bio--empty">Sem descrição.</p>}
          {links.length > 0 && (
            <ul className="profile-links">
              {links.map((l) => (
                <li key={l.key}>
                  {l.url ? (
                    <a href={l.url} target="_blank" rel="noopener noreferrer nofollow">
                      <span className="profile-links__net">{l.label}</span> {l.value.replace(/^https:\/\//, '')}
                    </a>
                  ) : (
                    <span>
                      <span className="profile-links__net">{l.label}</span> {l.value}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <FriendButton profile={profile} />
        </div>
      </section>

      <section className="profile-stats">
        <div className="profile-stat"><strong>{earned.size}</strong><span>Medalhas</span></div>
        <div className="profile-stat"><strong>{totalWins}</strong><span>Vitórias</span></div>
        <div className="profile-stat"><strong>{totalPlays}</strong><span>Partidas</span></div>
      </section>

      <section>
        <h2 className="profile-section-title">Medalhas <span>{earned.size}/{MEDALS.length}</span></h2>
        <div className="medal-grid">
          {MEDALS.map((m) => {
            const at = earned.get(m.key)
            return (
              <div key={m.key} className={`medal-card${at ? '' : ' medal-card--locked'}`} title={m.description}>
                <MedalBadge medal={m} earned={!!at} size={60} />
                <strong>{m.name}</strong>
                <span>{at ? new Date(at).toLocaleDateString('pt-PT') : m.description}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="profile-section-title">Jogos</h2>
        <div className="profile-games">
          {GAMES.map((g) => {
            const st = statByGame[g.key]
            return (
              <div key={g.key} className="profile-game">
                <GameIcon game={g.key} size={36} />
                <span className="profile-game__name">{g.title}</span>
                <span className="profile-game__num">{st ? `${st.wins} vitórias · ${st.plays} partidas` : 'Ainda não jogou'}</span>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
