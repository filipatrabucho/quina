import { useState } from 'react'
import { useSocial } from './SocialContext.jsx'
import Avatar from '../components/Avatar.jsx'

// Botão "Convidar amigos": envia o link da sala diretamente para o chat.
export default function InviteFriends({ title, url }) {
  const s = useSocial()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState({})
  if (!s?.enabled || !s.me) return null

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
    <div className="invite-friends">
      <button className="btn btn--outline btn--small" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Convidar amigos
      </button>
      {open && (
        <div className="invite-friends__list">
          {s.friends.length === 0 ? (
            <p className="chat-empty chat-empty--small">
              Ainda não tens amigos.{' '}
              <button className="link-btn" onClick={() => s.setPanel({ open: true, view: 'adicionar', friendId: null })}>
                Adicionar
              </button>
            </p>
          ) : (
            s.friends.map(({ profile }) => (
              <div key={profile.id} className="chat-person">
                <span className="chat-person__avatar">
                  <Avatar src={profile.avatar_url} seed={profile.id} name={profile.username} size={28} />
                  {s.online.has(profile.id) && <span className="chat-online-dot" />}
                </span>
                <span className="chat-person__name">{profile.username}</span>
                <button
                  className="btn btn--primary btn--small"
                  disabled={!!sent[profile.id] && sent[profile.id] !== 'erro'}
                  onClick={() => invite(profile.id)}
                  data-testid={`invite-${profile.username}`}
                >
                  {sent[profile.id] === 'enviado' ? 'Enviado' : sent[profile.id] === 'erro' ? 'Tentar de novo' : 'Convidar'}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
