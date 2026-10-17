import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSocial } from './SocialContext.jsx'
import Avatar from '../components/Avatar.jsx'

// Botão "Convidar amigos": abre uma janela com pesquisa e a lista de amigos
// (online primeiro). O convite chega diretamente ao chat do amigo.
export default function InviteFriends({ title, url }) {
  const s = useSocial()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [onlyOnline, setOnlyOnline] = useState(false)
  const [sent, setSent] = useState({})

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const list = useMemo(() => {
    if (!s?.friends) return []
    const q = query.trim().toLowerCase()
    return s.friends
      .map(({ profile }) => ({ profile, online: s.online.has(profile.id) }))
      .filter((f) => (!q || f.profile.username.toLowerCase().includes(q)) && (!onlyOnline || f.online))
      .sort((a, b) => Number(b.online) - Number(a.online) || a.profile.username.localeCompare(b.profile.username))
  }, [s?.friends, s?.online, query, onlyOnline])

  if (!s?.enabled || !s.me) return null
  const onlineCount = s.friends.filter(({ profile }) => s.online.has(profile.id)).length

  const invite = async (friendId) => {
    setSent((x) => ({ ...x, [friendId]: 'a-enviar' }))
    try {
      await s.sendInvite(friendId, { title, url, game: title })
      setSent((x) => ({ ...x, [friendId]: 'enviado' }))
    } catch {
      setSent((x) => ({ ...x, [friendId]: 'erro' }))
    }
  }

  return (
    <>
      <button className="btn btn--outline btn--small" onClick={() => setOpen(true)}>
        Convidar amigos{onlineCount > 0 ? ` · ${onlineCount} online` : ''}
      </button>
      {open && createPortal(
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal invite-modal" role="dialog" aria-label="Convidar amigos" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
            <h2>Convidar amigos</h2>
            <p className="modal-note">{title}</p>

            {s.friends.length === 0 ? (
              <div className="chat-empty">
                <p>Ainda não tens amigos.</p>
                <button
                  className="btn btn--primary btn--small"
                  onClick={() => {
                    setOpen(false)
                    s.setPanel({ open: true, view: 'adicionar', friendId: null })
                  }}
                >
                  Adicionar amigos
                </button>
              </div>
            ) : (
              <>
                <div className="invite-modal__tools">
                  <input
                    className="chat-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Procurar amigo…"
                    aria-label="Procurar amigo"
                    autoFocus
                  />
                  <label className="invite-modal__toggle">
                    <input type="checkbox" checked={onlyOnline} onChange={(e) => setOnlyOnline(e.target.checked)} />
                    Só online ({onlineCount})
                  </label>
                </div>
                <div className="invite-modal__list">
                  {list.length === 0 && <p className="chat-empty chat-empty--small">Nenhum amigo encontrado.</p>}
                  {list.map(({ profile, online }) => (
                    <div key={profile.id} className="chat-person">
                      <span className="chat-person__avatar">
                        <Avatar src={profile.avatar_url} seed={profile.id} name={profile.username} size={34} />
                        {online && <span className="chat-online-dot" />}
                      </span>
                      <span className="chat-person__name">
                        {profile.username}
                        <small className={online ? 'invite-status invite-status--on' : 'invite-status'}>
                          {online ? 'online' : 'offline'}
                        </small>
                      </span>
                      <button
                        className="btn btn--primary btn--small"
                        disabled={!!sent[profile.id] && sent[profile.id] !== 'erro'}
                        onClick={() => invite(profile.id)}
                        data-testid={`invite-${profile.username}`}
                      >
                        {sent[profile.id] === 'enviado'
                          ? 'Enviado'
                          : sent[profile.id] === 'a-enviar'
                            ? 'A enviar…'
                            : sent[profile.id] === 'erro'
                              ? 'Tentar de novo'
                              : 'Convidar'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
