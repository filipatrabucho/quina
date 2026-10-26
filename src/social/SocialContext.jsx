import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../hooks/useAuth.js'
import {
  getOrCreateMyProfile,
  getProfilesByIds,
  listFriendships,
  listUnread,
  listMessages,
  sendMessage as apiSendMessage,
  sendInvite as apiSendInvite,
  markRead,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  listIncoming,
  listGroups,
  createGroup as apiCreateGroup,
  getMyRole,
  deleteGroup as apiDeleteGroup,
  listGameSettings,
} from '../lib/social.js'
import { applyGameSettings, settingsFromRows } from '../data/games.js'
import { playNotify } from '../lib/sound.js'

const POLL_MS = 8000

const SocialContext = createContext(null)
export const useSocial = () => useContext(SocialContext)

export function SocialProvider({ children }) {
  const { user, loading: authLoading } = useAuth()
  const myId = user && !user.is_anonymous ? user.id : null
  const [me, setMe] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [friendships, setFriendships] = useState([])
  const [people, setPeople] = useState({}) // id -> perfil
  const [unread, setUnread] = useState({})
  const [online, setOnline] = useState(() => new Set())
  const [conversations, setConversations] = useState({}) // friendId -> mensagens
  const [panel, setPanel] = useState({ open: false, view: 'amigos', friendId: null })
  const [toasts, setToasts] = useState([])
  const [groups, setGroups] = useState([])
  const [role, setRole] = useState(null)
  const [roleLoaded, setRoleLoaded] = useState(false)
  // Jogos em beta/produção mudados no backoffice (para toda a gente, com ou sem conta).
  const [catalog, setCatalog] = useState({ version: 0, loaded: typeof window !== 'undefined' && !!window.__TG_GAMES__ })
  const refreshCatalog = useCallback(
    () =>
      listGameSettings()
        .then((rows) => {
          applyGameSettings(settingsFromRows(rows))
          setCatalog((c) => ({ version: c.version + 1, loaded: true }))
        })
        .catch(() => setCatalog((c) => (c.loaded ? c : { ...c, loaded: true }))),
    []
  )
  useEffect(() => {
    refreshCatalog()
    const t = setInterval(refreshCatalog, 60000)
    return () => clearInterval(t)
  }, [refreshCatalog])
  const panelRef = useRef(panel)
  panelRef.current = panel
  const seenMsgs = useRef(null) // ids de mensagens já tratadas (null = ainda não carregou)
  const prevFriendships = useRef(null)

  const pushToast = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, ...toast }])
    if (toast.kind !== 'convite') setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000)
  }, [])
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const loadPeople = useCallback(async (ids) => {
    const missing = ids.filter(Boolean)
    if (!missing.length) return
    const list = await getProfilesByIds([...new Set(missing)])
    setPeople((p) => ({ ...p, ...Object.fromEntries(list.map((x) => [x.id, x])) }))
  }, [])

  // Lê as amizades e avisa do que mudou (pedido novo, pedido aceite).
  const refreshFriendships = useCallback(async () => {
    if (!myId) return
    const list = await listFriendships()
    const prev = prevFriendships.current
    if (prev) {
      const before = new Map(prev.map((f) => [f.id, f]))
      for (const f of list) {
        const old = before.get(f.id)
        if (!old && f.status === 'pendente' && f.addressee === myId) {
          pushToast({ kind: 'pedido', from: f.requester })
          playNotify('amigos')
        }
        if (old && old.status !== 'aceite' && f.status === 'aceite' && f.requester === myId) {
          pushToast({ kind: 'aceite', from: f.addressee })
          playNotify('amigos')
        }
      }
    }
    prevFriendships.current = list
    setFriendships(list)
    await loadPeople(list.map((f) => (f.requester === myId ? f.addressee : f.requester)))
  }, [myId, loadPeople, pushToast])

  // Uma mensagem recebida (pelo tempo real ou pela verificação periódica).
  const handleIncoming = useCallback(
    (m) => {
      if (!seenMsgs.current || seenMsgs.current.has(m.id)) return
      seenMsgs.current.add(m.id)
      setConversations((c) => (c[m.sender] && !c[m.sender].some((x) => x.id === m.id) ? { ...c, [m.sender]: [...c[m.sender], m] } : c))
      const p = panelRef.current
      const viewing = p.open && p.view === 'conversa' && p.friendId === m.sender && document.visibilityState === 'visible'
      if (viewing) markRead(m.sender)
      else if (!m.read_at) setUnread((u) => ({ ...u, [m.sender]: (u[m.sender] || 0) + 1 }))
      loadPeople([m.sender])
      if (m.kind === 'convite') {
        pushToast({ kind: 'convite', from: m.sender, invite: m.payload })
        playNotify('convite')
      } else if (!viewing) {
        pushToast({ kind: 'mensagem', from: m.sender, body: m.body })
        playNotify('mensagem')
      }
    },
    [loadPeople, pushToast]
  )

  // Arranque: perfil, amizades, mensagens por ler.
  useEffect(() => {
    setMe(null)
    setFriendships([])
    setUnread({})
    setConversations({})
    setGroups([])
    setRole(null)
    setRoleLoaded(!myId)
    seenMsgs.current = null
    prevFriendships.current = null
    if (!myId) return
    let alive = true
    setProfileError('')
    getOrCreateMyProfile(myId)
      .then((p) => {
        if (!alive) return
        setMe(p)
        if (!p) setProfileError('O teu perfil ainda não existe na base de dados.')
      })
      .catch((e) => alive && setProfileError(e.message))
    refreshFriendships().catch(() => {})
    listUnread(myId).then((u) => alive && setUnread(u)).catch(() => {})
    listIncoming(myId)
      .then((list) => {
        if (alive) seenMsgs.current = new Set(list.map((m) => m.id))
      })
      .catch(() => {
        if (alive) seenMsgs.current = new Set()
      })
    listGroups().then((g) => alive && setGroups(g)).catch(() => {})
    getMyRole()
      .then((r) => alive && setRole(r))
      .catch(() => {})
      .finally(() => alive && setRoleLoaded(true))
    return () => {
      alive = false
    }
  }, [myId, refreshFriendships])

  // Tempo real: mensagens recebidas, amizades e medalhas.
  useEffect(() => {
    if (!myId || !me) return undefined
    const channel = supabase
      .channel(`social-${myId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient=eq.${myId}` }, ({ new: m }) => handleIncoming(m))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        refreshFriendships().catch(() => {})
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_medals', filter: `user_id=eq.${myId}` }, ({ new: m }) => {
        pushToast({ kind: 'medalha', medal: m.medal })
        playNotify('medalha')
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [myId, me, refreshFriendships, handleIncoming, pushToast])

  // Verificação periódica (e ao voltar à página): se o tempo real falhar
  // ou a ligação cair, as mensagens e os pedidos chegam na mesma.
  useEffect(() => {
    if (!myId || !me) return undefined
    let busy = false
    const check = async () => {
      if (busy || document.visibilityState !== 'visible') return
      busy = true
      try {
        const [msgs] = await Promise.all([listIncoming(myId, 20), refreshFriendships()])
        // Um tester novo (ou removido) vê a mudança sem ter de sair e entrar.
        getMyRole().then(setRole).catch(() => {})
        if (!seenMsgs.current) seenMsgs.current = new Set(msgs.map((m) => m.id))
        else msgs.forEach(handleIncoming)
        const u = await listUnread(myId)
        const p = panelRef.current
        if (p.open && p.view === 'conversa' && u[p.friendId]) {
          markRead(p.friendId)
          delete u[p.friendId]
        }
        setUnread(u)
      } catch {
        // sem rede: tenta na próxima
      } finally {
        busy = false
      }
    }
    const t = setInterval(check, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [myId, me, refreshFriendships, handleIncoming])

  // Quem está online (presença partilhada por todos os utilizadores com conta).
  useEffect(() => {
    if (!myId || !me) return undefined
    const channel = supabase.channel('quina-online', { config: { presence: { key: myId } } })
    channel
      .on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(channel.presenceState()))))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channel.track({ id: myId })
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [myId, me])

  const otherOf = useCallback((f) => (f.requester === myId ? f.addressee : f.requester), [myId])
  const friends = useMemo(
    () => friendships.filter((f) => f.status === 'aceite').map((f) => ({ friendship: f, profile: people[otherOf(f)] })).filter((x) => x.profile),
    [friendships, people, otherOf]
  )
  const incoming = useMemo(() => friendships.filter((f) => f.status === 'pendente' && f.addressee === myId), [friendships, myId])
  const outgoing = useMemo(() => friendships.filter((f) => f.status === 'pendente' && f.requester === myId), [friendships, myId])
  const relationWith = useCallback(
    (otherId) => {
      const f = friendships.find((x) => otherOf(x) === otherId)
      if (!f) return { state: 'nenhuma' }
      if (f.status === 'aceite') return { state: 'amigos', friendship: f }
      return { state: f.requester === myId ? 'enviado' : 'recebido', friendship: f }
    },
    [friendships, otherOf, myId]
  )

  const openConversation = useCallback(
    async (friendId) => {
      setPanel({ open: true, view: 'conversa', friendId })
      loadPeople([friendId])
      if (!conversations[friendId]) {
        const msgs = await listMessages(myId, friendId)
        setConversations((c) => ({ ...c, [friendId]: msgs }))
      }
      if (unread[friendId]) {
        setUnread((u) => ({ ...u, [friendId]: 0 }))
        markRead(friendId)
      }
    },
    [myId, conversations, unread, loadPeople]
  )

  const value = {
    enabled: !!myId,
    role,
    roleLoaded: !authLoading && roleLoaded,
    canSeeBeta: role === 'admin' || role === 'tester',
    catalogVersion: catalog.version,
    catalogLoaded: catalog.loaded,
    refreshCatalog,
    me,
    profileError,
    myId,
    people,
    friends,
    incoming,
    outgoing,
    online,
    unread,
    totalUnread: Object.values(unread).reduce((a, b) => a + b, 0) + incoming.length,
    conversations,
    panel,
    setPanel,
    toasts,
    dismissToast,
    relationWith,
    loadPeople,
    openConversation,
    async sendMessage(friendId, body) {
      const m = await apiSendMessage(myId, friendId, body)
      if (m) setConversations((c) => ({ ...c, [friendId]: [...(c[friendId] || []), m] }))
    },
    async sendInvite(friendId, invite) {
      const m = await apiSendInvite(myId, friendId, invite)
      setConversations((c) => (c[friendId] ? { ...c, [friendId]: [...c[friendId], m] } : c))
    },
    async addFriend(otherId) {
      await sendFriendRequest(myId, otherId)
      await refreshFriendships()
    },
    async acceptFriend(friendshipId) {
      await acceptFriendRequest(friendshipId)
      await refreshFriendships()
    },
    groups,
    async createGroup(name, members) {
      const g = await apiCreateGroup(myId, name, members)
      setGroups((list) => [...list, g])
      return g
    },
    async deleteGroup(id) {
      await apiDeleteGroup(id)
      setGroups((list) => list.filter((g) => g.id !== id))
    },
    async removeFriend(friendshipId) {
      await removeFriendship(friendshipId)
      await refreshFriendships()
    },
  }

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}
