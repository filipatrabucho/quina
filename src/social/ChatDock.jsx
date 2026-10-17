import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSocial } from './SocialContext.jsx'
import { searchProfiles } from '../lib/social.js'
import { medalByKey } from '../data/medals.js'
import Avatar from '../components/Avatar.jsx'
import MedalBadge from './MedalBadge.jsx'

export function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  )
}

function PersonRow({ profile, online, right, onClick }) {
  return (
    <div className={`chat-person${onClick ? ' chat-person--click' : ''}`} onClick={onClick}>
      <span className="chat-person__avatar">
        <Avatar src={profile.avatar_url} seed={profile.id} name={profile.username} size={34} />
        {online && <span className="chat-online-dot" title="Online" />}
      </span>
      <span className="chat-person__name">{profile.username}</span>
      {right}
    </div>
  )
}

// Abrir um link de convite (do próprio site) sem recarregar a página.
function useOpenInvite() {
  const navigate = useNavigate()
  return (url) => {
    try {
      const u = new URL(url, window.location.origin)
      if (u.origin === window.location.origin) navigate(u.pathname + u.search)
      else window.location.href = u.href
    } catch {
      // link inválido
    }
  }
}

function InviteCard({ message, mine }) {
  const openInvite = useOpenInvite()
  const inv = message.payload || {}
  return (
    <div className={`chat-invite${mine ? ' chat-invite--mine' : ''}`}>
      <span className="chat-invite__label">{mine ? 'Convite enviado' : 'Convite para jogar'}</span>
      <strong>{inv.title || 'Sala de jogo'}</strong>
      {!mine && (
        <button className="btn btn--primary btn--small" onClick={() => openInvite(inv.url)}>
          Entrar na sala
        </button>
      )}
    </div>
  )
}

function Conversation({ friendId }) {
  const s = useSocial()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const listRef = useRef(null)
  const friend = s.people[friendId]
  const msgs = s.conversations[friendId] || []

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [msgs.length])

  const send = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setError('')
    const body = text
    setText('')
    try {
      await s.sendMessage(friendId, body)
    } catch (err) {
      setError(err.message)
      setText(body)
    }
  }

  return (
    <div className="chat-conv">
      <div className="chat-conv__head">
        <button className="chat-icon-btn" onClick={() => s.setPanel({ open: true, view: 'amigos', friendId: null })} aria-label="Voltar">
          ←
        </button>
        {friend && (
          <Link to={`/u/${friend.username}`} className="chat-conv__who">
            <Avatar src={friend.avatar_url} seed={friend.id} name={friend.username} size={28} />
            <span>{friend.username}</span>
            {s.online.has(friendId) && <span className="chat-online-text">online</span>}
          </Link>
        )}
      </div>
      <div className="chat-conv__list" ref={listRef} data-testid="chat-messages">
        {msgs.length === 0 && <p className="chat-empty">Ainda não há mensagens. Diz olá!</p>}
        {msgs.map((m) => {
          const mine = m.sender === s.myId
          return (
            <div key={m.id} className={`chat-msg${mine ? ' chat-msg--mine' : ''}`}>
              {m.kind === 'convite' ? <InviteCard message={m} mine={mine} /> : <span className="chat-bubble">{m.body}</span>}
            </div>
          )
        })}
      </div>
      {error && <p className="duel-error chat-error">{error}</p>}
      <form className="chat-conv__form" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreve uma mensagem…"
          maxLength={1000}
          aria-label="Mensagem"
        />
        <button className="btn btn--primary btn--small" type="submit" disabled={!text.trim()}>
          Enviar
        </button>
      </form>
    </div>
  )
}

function FriendsList() {
  const s = useSocial()
  if (s.friends.length === 0) {
    return (
      <div className="chat-empty">
        <p>Ainda não tens amigos.</p>
        <button className="btn btn--outline btn--small" onClick={() => s.setPanel({ open: true, view: 'adicionar' })}>
          Adicionar amigos
        </button>
      </div>
    )
  }
  const sorted = [...s.friends].sort(
    (a, b) => (s.online.has(b.profile.id) ? 1 : 0) - (s.online.has(a.profile.id) ? 1 : 0) || a.profile.username.localeCompare(b.profile.username)
  )
  return (
    <div className="chat-list">
      {sorted.map(({ profile }) => (
        <PersonRow
          key={profile.id}
          profile={profile}
          online={s.online.has(profile.id)}
          onClick={() => s.openConversation(profile.id)}
          right={s.unread[profile.id] ? <span className="chat-badge">{s.unread[profile.id]}</span> : null}
        />
      ))}
    </div>
  )
}

function Requests() {
  const s = useSocial()
  const [busy, setBusy] = useState(false)
  const act = async (fn) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="chat-list">
      <h4 className="chat-section">Recebidos</h4>
      {s.incoming.length === 0 && <p className="chat-empty chat-empty--small">Nenhum pedido.</p>}
      {s.incoming.map((f) => {
        const p = s.people[f.requester]
        return p ? (
          <PersonRow
            key={f.id}
            profile={p}
            online={s.online.has(p.id)}
            right={
              <span className="chat-actions">
                <button className="btn btn--primary btn--small" disabled={busy} onClick={() => act(() => s.acceptFriend(f.id))}>Aceitar</button>
                <button className="btn btn--outline btn--small" disabled={busy} onClick={() => act(() => s.removeFriend(f.id))}>Recusar</button>
              </span>
            }
          />
        ) : null
      })}
      <h4 className="chat-section">Enviados</h4>
      {s.outgoing.length === 0 && <p className="chat-empty chat-empty--small">Nenhum pedido pendente.</p>}
      {s.outgoing.map((f) => {
        const p = s.people[f.addressee]
        return p ? (
          <PersonRow
            key={f.id}
            profile={p}
            right={<button className="btn btn--outline btn--small" disabled={busy} onClick={() => act(() => s.removeFriend(f.id))}>Cancelar</button>}
          />
        ) : null
      })}
    </div>
  )
}

function AddFriends() {
  const s = useSocial()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    const t = setTimeout(() => {
      searchProfiles(q, s.myId).then(setResults).catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(t)
  }, [q, s.myId])

  const add = async (id) => {
    setError('')
    try {
      await s.addFriend(id)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="chat-list">
      <input
        className="chat-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Procurar username…"
        aria-label="Procurar username"
        autoFocus
      />
      {error && <p className="duel-error chat-error">{error}</p>}
      {q.trim().length >= 2 && results.length === 0 && <p className="chat-empty chat-empty--small">Ninguém encontrado.</p>}
      {results.map((p) => {
        const rel = s.relationWith(p.id)
        const right =
          rel.state === 'amigos' ? (
            <span className="chat-tag">Amigos</span>
          ) : rel.state === 'enviado' ? (
            <span className="chat-tag">Pedido enviado</span>
          ) : rel.state === 'recebido' ? (
            <button className="btn btn--primary btn--small" onClick={() => s.acceptFriend(rel.friendship.id)}>Aceitar</button>
          ) : (
            <button className="btn btn--primary btn--small" onClick={() => add(p.id)}>Adicionar</button>
          )
        return <PersonRow key={p.id} profile={p} right={right} />
      })}
    </div>
  )
}

function Toasts() {
  const s = useSocial()
  const openInvite = useOpenInvite()
  return (
    <div className="social-toasts" aria-live="polite">
      {s.toasts.map((t) => {
        const who = t.from ? s.people[t.from]?.username || 'Alguém' : null
        if (t.kind === 'medalha') {
          const medal = medalByKey[t.medal]
          if (!medal) return null
          return (
            <div key={t.id} className="social-toast social-toast--medal">
              <MedalBadge medal={medal} size={44} />
              <div>
                <span className="social-toast__label">Nova medalha</span>
                <strong>{medal.name}</strong>
                <span className="social-toast__sub">{medal.description}</span>
              </div>
            </div>
          )
        }
        if (t.kind === 'convite') {
          return (
            <div key={t.id} className="social-toast social-toast--invite" data-testid="invite-toast">
              <div>
                <span className="social-toast__label">Convite</span>
                <strong>{who} convidou-te para {t.invite?.title || 'jogar'}</strong>
              </div>
              <div className="social-toast__actions">
                <button
                  className="btn btn--primary btn--small"
                  onClick={() => {
                    s.dismissToast(t.id)
                    openInvite(t.invite?.url)
                  }}
                >
                  Entrar
                </button>
                <button className="btn btn--outline btn--small" onClick={() => s.dismissToast(t.id)}>Ignorar</button>
              </div>
            </div>
          )
        }
        return (
          <div key={t.id} className="social-toast" onClick={() => s.dismissToast(t.id)}>
            <span className="social-toast__label">Amigos</span>
            <strong>{t.kind === 'pedido' ? `${who} enviou-te um pedido de amizade` : `${who} aceitou o teu pedido de amizade`}</strong>
          </div>
        )
      })}
    </div>
  )
}

export default function ChatDock() {
  const s = useSocial()
  if (!s) return null
  const { panel, setPanel } = s
  const tabs = [
    { key: 'amigos', label: 'Amigos' },
    { key: 'pedidos', label: `Pedidos${s.incoming.length ? ` (${s.incoming.length})` : ''}` },
    { key: 'adicionar', label: 'Adicionar' },
  ]

  return (
    <>
      <Toasts />
      {panel.open && (
        <div className="chat-panel" role="dialog" aria-label="Chat e amigos">
          <div className="chat-panel__head">
            <strong>Chat</strong>
            <button className="chat-icon-btn" onClick={() => setPanel({ ...panel, open: false })} aria-label="Fechar chat">
              ×
            </button>
          </div>
          {s.enabled && !s.me ? (
            <div className="chat-empty">
              {s.profileError ? (
                <>
                  <p>Não foi possível preparar o teu perfil para o chat.</p>
                  <p className="chat-error-detail">{s.profileError}</p>
                  <p className="modal-note">Confirma que correste o supabase/schema-social.sql no Supabase e faz refresh.</p>
                </>
              ) : (
                <p>A preparar o teu perfil…</p>
              )}
            </div>
          ) : !s.enabled ? (
            <div className="chat-empty">
              <p>Entra com a tua conta para falares com amigos, receberes convites e ganhares medalhas.</p>
              <Link className="btn btn--primary btn--small" to="/conta" onClick={() => setPanel({ ...panel, open: false })}>
                Entrar / Criar conta
              </Link>
            </div>
          ) : panel.view === 'conversa' && panel.friendId ? (
            <Conversation friendId={panel.friendId} />
          ) : (
            <>
              <div className="chat-tabs" role="tablist">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={panel.view === t.key}
                    className={`tab${panel.view === t.key ? ' tab--active' : ''}`}
                    onClick={() => setPanel({ open: true, view: t.key, friendId: null })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="chat-body">
                {panel.view === 'pedidos' ? <Requests /> : panel.view === 'adicionar' ? <AddFriends /> : <FriendsList />}
              </div>
            </>
          )}
        </div>
      )}
      <button
        className="chat-fab"
        onClick={() => setPanel({ ...panel, open: !panel.open })}
        aria-label={`Chat${s.totalUnread ? ` (${s.totalUnread} por ler)` : ''}`}
      >
        <ChatIcon />
        {s.totalUnread > 0 && <span className="chat-fab__badge">{s.totalUnread}</span>}
      </button>
    </>
  )
}

// Botão do chat para o cabeçalho (usado no telemóvel, onde o botão
// flutuante taparia os controlos dos jogos).
export function HeaderChatButton() {
  const s = useSocial()
  if (!s) return null
  return (
    <button
      className="header-chat-btn"
      onClick={() => s.setPanel({ ...s.panel, open: !s.panel.open })}
      aria-label={`Chat${s.totalUnread ? ` (${s.totalUnread} por ler)` : ''}`}
    >
      <ChatIcon />
      {s.totalUnread > 0 && <span className="chat-fab__badge">{s.totalUnread}</span>}
    </button>
  )
}
