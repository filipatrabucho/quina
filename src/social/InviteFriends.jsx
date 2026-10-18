import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSocial } from './SocialContext.jsx'
import Avatar from '../components/Avatar.jsx'

// "Convidar amigos": janela com pesquisa, amigos online primeiro, seleção de
// vários e grupos guardados. O convite chega diretamente ao chat de cada um.
export default function InviteFriends({ title, url }) {
  const s = useSocial()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [onlyOnline, setOnlyOnline] = useState(false)
  const [sent, setSent] = useState({})
  const [selected, setSelected] = useState(() => new Set())
  const [naming, setNaming] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupError, setGroupError] = useState('')

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
  const friendIds = new Set(s.friends.map((f) => f.profile.id))
  const onlineIds = s.friends.map((f) => f.profile.id).filter((id) => s.online.has(id))
  const onlineCount = onlineIds.length

  const invite = async (friendId) => {
    setSent((x) => ({ ...x, [friendId]: 'a-enviar' }))
    try {
      await s.sendInvite(friendId, { title, url, game: title })
      setSent((x) => ({ ...x, [friendId]: 'enviado' }))
    } catch {
      setSent((x) => ({ ...x, [friendId]: 'erro' }))
    }
  }
  const inviteMany = async (ids) => {
    await Promise.all(ids.filter((id) => sent[id] !== 'enviado').map(invite))
    setSelected(new Set())
  }
  const toggle = (id) =>
    setSelected((sel) => {
      const next = new Set(sel)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const saveGroup = async (e) => {
    e.preventDefault()
    if (!groupName.trim()) return
    setGroupError('')
    try {
      await s.createGroup(groupName, [...selected])
      setNaming(false)
      setGroupName('')
    } catch (err) {
      setGroupError(/friend_groups|relation|schema cache/i.test(err.message) ? 'Os grupos ainda não estão ativos (falta correr o SQL do Supabase).' : err.message)
    }
  }
  const label = (id) =>
    sent[id] === 'enviado' ? 'Enviado' : sent[id] === 'a-enviar' ? 'A enviar…' : sent[id] === 'erro' ? 'Tentar de novo' : 'Convidar'

  return (
    <>
      <button className="btn btn--outline btn--small" onClick={() => setOpen(true)} data-testid="invite-open">
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
                {s.groups.length > 0 && (
                  <div className="invite-groups" aria-label="Grupos">
                    {s.groups.map((g) => {
                      const members = g.members.filter((id) => friendIds.has(id))
                      const on = members.filter((id) => s.online.has(id)).length
                      return (
                        <span key={g.id} className="invite-group">
                          <button
                            className="invite-group__pick"
                            onClick={() => setSelected(new Set(members))}
                            title="Selecionar o grupo"
                            data-testid={`group-${g.name}`}
                          >
                            <b>{g.name}</b> <small>{on}/{members.length} online</small>
                          </button>
                          <button className="invite-group__del" onClick={() => s.deleteGroup(g.id)} aria-label={`Apagar o grupo ${g.name}`}>×</button>
                        </span>
                      )
                    })}
                  </div>
                )}
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
                  {onlineCount > 0 && (
                    <button className="link-btn" onClick={() => setSelected(new Set(onlineIds))} data-testid="select-online">
                      Selecionar os online
                    </button>
                  )}
                </div>
                <div className="invite-modal__list">
                  {list.length === 0 && <p className="chat-empty chat-empty--small">Nenhum amigo encontrado.</p>}
                  {list.map(({ profile, online }) => (
                    <div key={profile.id} className={`chat-person invite-row${selected.has(profile.id) ? ' invite-row--on' : ''}`}>
                      <label className="invite-row__pick">
                        <input type="checkbox" checked={selected.has(profile.id)} onChange={() => toggle(profile.id)} data-testid={`pick-${profile.username}`} />
                        <span className="chat-person__avatar">
                          <Avatar src={profile.avatar_url} seed={profile.id} name={profile.username} size={34} />
                          {online && <span className="chat-online-dot" />}
                        </span>
                        <span className="chat-person__name">
                          {profile.username}
                          <small className={online ? 'invite-status invite-status--on' : 'invite-status'}>{online ? 'online' : 'offline'}</small>
                        </span>
                      </label>
                      <button
                        className="btn btn--primary btn--small"
                        disabled={!!sent[profile.id] && sent[profile.id] !== 'erro'}
                        onClick={() => invite(profile.id)}
                        data-testid={`invite-${profile.username}`}
                      >
                        {label(profile.id)}
                      </button>
                    </div>
                  ))}
                </div>
                {selected.size > 0 && (
                  <div className="invite-bar">
                    {naming ? (
                      <form className="invite-bar__name" onSubmit={saveGroup}>
                        <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Nome do grupo" maxLength={40} autoFocus aria-label="Nome do grupo" data-testid="group-name" />
                        <button className="btn btn--primary btn--small" type="submit" disabled={!groupName.trim()} data-testid="group-save">Guardar</button>
                        <button className="link-btn" type="button" onClick={() => setNaming(false)}>Cancelar</button>
                      </form>
                    ) : (
                      <>
                        <span className="invite-bar__count">{selected.size} {selected.size === 1 ? 'selecionado' : 'selecionados'}</span>
                        <button className="link-btn" onClick={() => setNaming(true)} data-testid="group-new">Guardar como grupo</button>
                        <button className="btn btn--primary btn--small" onClick={() => inviteMany([...selected])} data-testid="invite-selected">
                          Convidar {selected.size}
                        </button>
                      </>
                    )}
                    {groupError && <p className="duel-error">{groupError}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
