import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../hooks/useAuth.js'
import {
  getProfileById,
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
} from '../lib/social.js'

const SocialContext = createContext(null)
export const useSocial = () => useContext(SocialContext)

export function SocialProvider({ children }) {
  const { user } = useAuth()
  const myId = user && !user.is_anonymous ? user.id : null
  const [me, setMe] = useState(null)
  const [friendships, setFriendships] = useState([])
  const [people, setPeople] = useState({}) // id -> perfil
  const [unread, setUnread] = useState({})
  const [online, setOnline] = useState(() => new Set())
  const [conversations, setConversations] = useState({}) // friendId -> mensagens
  const [panel, setPanel] = useState({ open: false, view: 'amigos', friendId: null })
  const [toasts, setToasts] = useState([])
  const panelRef = useRef(panel)
  panelRef.current = panel

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

  const refreshFriendships = useCallback(async () => {
    if (!myId) return
    const list = await listFriendships()
    setFriendships(list)
    await loadPeople(list.map((f) => (f.requester === myId ? f.addressee : f.requester)))
  }, [myId, loadPeople])

  // Arranque: perfil, amizades, mensagens por ler.
  useEffect(() => {
    setMe(null)
    setFriendships([])
    setUnread({})
    setConversations({})
    if (!myId) return
    let alive = true
    getProfileById(myId).then((p) => alive && setMe(p)).catch(() => {})
    refreshFriendships().catch(() => {})
    listUnread(myId).then((u) => alive && setUnread(u)).catch(() => {})
    return () => {
      alive = false
    }
  }, [myId, refreshFriendships])

  // Tempo real: mensagens recebidas, amizades e medalhas.
  useEffect(() => {
    if (!myId || !me) return undefined
    const channel = supabase
      .channel(`social-${myId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient=eq.${myId}` }, ({ new: m }) => {
        setConversations((c) => (c[m.sender] ? { ...c, [m.sender]: [...c[m.sender], m] } : c))
        const p = panelRef.current
        if (p.open && p.view === 'conversa' && p.friendId === m.sender) {
          markRead(m.sender)
        } else {
          setUnread((u) => ({ ...u, [m.sender]: (u[m.sender] || 0) + 1 }))
        }
        loadPeople([m.sender])
        if (m.kind === 'convite') pushToast({ kind: 'convite', from: m.sender, invite: m.payload })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, ({ eventType, new: f }) => {
        if (eventType === 'INSERT' && f.addressee === myId) pushToast({ kind: 'pedido', from: f.requester })
        if (eventType === 'UPDATE' && f.requester === myId && f.status === 'aceite') pushToast({ kind: 'aceite', from: f.addressee })
        refreshFriendships().catch(() => {})
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_medals', filter: `user_id=eq.${myId}` }, ({ new: m }) => {
        pushToast({ kind: 'medalha', medal: m.medal })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [myId, me, refreshFriendships, loadPeople, pushToast])

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
    me,
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
    async removeFriend(friendshipId) {
      await removeFriendship(friendshipId)
      await refreshFriendships()
    },
  }

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}
