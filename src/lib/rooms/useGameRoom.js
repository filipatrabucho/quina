import { useCallback, useEffect, useRef, useState } from 'react'
import { openChannel } from './transport.js'
import { reduceRoom, seatOf } from './reduceRoom.js'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function randomRoomCode(length = 5) {
  let code = ''
  for (let i = 0; i < length; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

const storageKey = (game, code) => `quina-sala-${game}-${code}`
const chatKey = (game, code) => `quina-sala-chat-${game}-${code}`
export const CHAT_MAX = 200 // letras por mensagem
const CHAT_KEEP = 80 // mensagens guardadas

function loadChat(game, code) {
  try {
    const list = JSON.parse(localStorage.getItem(chatKey(game, code)) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

// Mensagem do chat da sala vinda de outro jogador (só aceita o que é válido).
function cleanChat(m, from) {
  if (!m || typeof m.text !== 'string' || typeof m.id !== 'string') return null
  const text = m.text.trim().slice(0, CHAT_MAX)
  if (!text) return null
  return { id: m.id.slice(0, 20), from, text, at: Number(m.at) || Date.now() }
}

function loadSaved(game, code) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(game, code)) || 'null')
  } catch {
    return null
  }
}

// Estado inicial de uma sala nova, criada por "host".
export function createRoomState(game, code, host, logic) {
  const state = {
    v: 1,
    code,
    hostId: host.id,
    status: 'lobby',
    maxPlayers: logic.maxPlayers,
    players: [seatOf(host)],
    game: null,
  }
  localStorage.setItem(storageKey(game, code), JSON.stringify(state))
  return state
}

/**
 * Liga-se a uma sala (como anfitrião ou convidado).
 * - O anfitrião guarda o estado oficial (também em localStorage, para
 *   sobreviver a um refresh) e difunde-o a cada alteração.
 * - Os outros enviam ações ao anfitrião e recebem o estado.
 */
export function useGameRoom({ game, code, me, logic }) {
  const [state, setState] = useState(() => (code ? loadSaved(game, code) : null))
  const [online, setOnline] = useState([])
  const [connection, setConnection] = useState('a-ligar')
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  // Chat da sala: vai pelo mesmo canal (não fica guardado no servidor).
  const [chat, setChat] = useState(() => (code ? loadChat(game, code) : []))
  const chatRef = useRef(chat)
  const addChat = useCallback(
    (list) => {
      const known = new Set(chatRef.current.map((m) => m.id))
      const fresh = list.filter((m) => m && !known.has(m.id))
      if (!fresh.length) return
      const next = [...chatRef.current, ...fresh].sort((a, b) => a.at - b.at).slice(-CHAT_KEEP)
      chatRef.current = next
      setChat(next)
      try {
        localStorage.setItem(chatKey(game, code), JSON.stringify(next))
      } catch {
        // sem armazenamento: fica só nesta página
      }
    },
    [game, code]
  )
  const stateRef = useRef(state)
  const channelRef = useRef(null)
  const clockOffset = useRef(0)

  const amHost = !!state && state.hostId === me?.id
  const amHostRef = useRef(amHost)
  amHostRef.current = amHost

  // Jogos em tempo real (ex.: Bombas) mudam o estado muitas vezes por
  // segundo: o envio fica limitado a uma mensagem a cada `broadcastMs`.
  const sendTimer = useRef(null)
  const lastSent = useRef(0)
  const flush = useCallback(() => {
    sendTimer.current = null
    lastSent.current = Date.now()
    const current = stateRef.current
    localStorage.setItem(storageKey(game, code), JSON.stringify(current))
    channelRef.current?.send('state', { state: current, now: Date.now() })
  }, [game, code])
  useEffect(
    () => () => {
      clearTimeout(sendTimer.current)
      sendTimer.current = null
    },
    []
  )

  const commit = useCallback(
    (next) => {
      stateRef.current = next
      setState(next)
      const gap = logic.broadcastMs || 0
      if (!gap) return flush()
      if (sendTimer.current) return undefined
      const wait = Math.max(0, gap - (Date.now() - lastSent.current))
      sendTimer.current = setTimeout(flush, wait)
      return undefined
    },
    [logic, flush]
  )

  const applyAsHost = useCallback(
    (action, fromId) => {
      const current = stateRef.current
      try {
        const next = reduceRoom(current, action, fromId, logic)
        if (next !== current) commit({ ...next, v: current.v + 1 })
        return null
      } catch (e) {
        return e.message
      }
    },
    [logic, commit]
  )

  // Ao mudar de sala, recarrega o que houver guardado.
  useEffect(() => {
    const saved = code ? loadSaved(game, code) : null
    stateRef.current = saved
    setState(saved)
    const savedChat = code ? loadChat(game, code) : []
    chatRef.current = savedChat
    setChat(savedChat)
    setNotFound(false)
    setError('')
  }, [game, code])

  useEffect(() => {
    if (!code || !me?.id) return undefined
    const channel = openChannel(`${game}:${code}`, me, {
      onStatus: setConnection,
      onPresence: setOnline,
      onMessage(type, data, from) {
        // Chat: chega a toda a gente; quem entra recebe as últimas mensagens do anfitrião.
        if (type === 'chat') return addChat([cleanChat(data, from)])
        if (type === 'chatlog') return addChat((Array.isArray(data?.list) ? data.list : []).slice(-CHAT_KEEP).map((m) => cleanChat(m, m?.from)).filter(Boolean))
        if (amHostRef.current) {
          if (type === 'hello') {
            applyAsHost({ type: 'join', player: data.player }, from)
            channel.send('state', { state: stateRef.current, now: Date.now() })
            if (chatRef.current.length) channel.send('chatlog', { list: chatRef.current.slice(-40) }, from)
          } else if (type === 'action') {
            const err = applyAsHost(data.action, from)
            if (err) channel.send('error', { message: err }, from)
          }
          return
        }
        if (type === 'state') {
          const incoming = data.state
          const current = stateRef.current
          if (current && current.hostId === incoming.hostId && incoming.v < current.v) return
          clockOffset.current = data.now - Date.now()
          stateRef.current = incoming
          setState(incoming)
          setNotFound(false)
        } else if (type === 'error') {
          setError(data.message)
        }
      },
    })
    channelRef.current = channel

    let helloTimer = null
    let notFoundTimer = null
    if (!amHostRef.current) {
      const hello = () => channel.send('hello', { player: me })
      hello()
      helloTimer = setInterval(() => {
        if (!stateRef.current) hello()
      }, 2000)
      notFoundTimer = setTimeout(() => {
        if (!stateRef.current) setNotFound(true)
      }, 8000)
    } else {
      // Anfitrião que voltou (refresh): atualiza o seu nome/avatar e avisa.
      applyAsHost({ type: 'join', player: me }, me.id)
      channel.send('state', { state: stateRef.current, now: Date.now() })
    }

    return () => {
      clearInterval(helloTimer)
      clearTimeout(notFoundTimer)
      channel.leave()
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, code, me?.id, amHost])

  // Anfitrião: relógio do jogo (para limites de tempo) e reenvio periódico
  // do estado, para quem perdeu alguma mensagem.
  useEffect(() => {
    if (!amHost) return undefined
    const t = setInterval(() => {
      if (logic.tick && stateRef.current?.status === 'playing') applyAsHost({ type: 'tick' }, me.id)
    }, logic.tickMs || 1000)
    const r = setInterval(() => {
      channelRef.current?.send('state', { state: stateRef.current, now: Date.now() })
    }, 5000)
    return () => {
      clearInterval(t)
      clearInterval(r)
    }
  }, [amHost, logic, applyAsHost, me?.id])

  const dispatch = useCallback(
    (action) => {
      setError('')
      if (amHostRef.current) {
        const err = applyAsHost(action, me.id)
        if (err) setError(err)
      } else {
        channelRef.current?.send('action', { action })
      }
    },
    [applyAsHost, me?.id]
  )

  // Envia uma mensagem para o chat da sala (máx. 1 a cada 0,7 s).
  const lastChat = useRef(0)
  const sendChat = useCallback(
    (raw) => {
      const text = String(raw || '').trim().slice(0, CHAT_MAX)
      if (!text || !me?.id) return false
      if (Date.now() - lastChat.current < 700) return false
      lastChat.current = Date.now()
      const m = { id: Math.random().toString(36).slice(2, 12), text, at: Date.now() }
      addChat([{ ...m, from: me.id }])
      channelRef.current?.send('chat', m)
      return true
    },
    [addChat, me?.id]
  )

  const hostOnline = !state || amHost || online.some((p) => p?.id === state.hostId)

  return {
    state,
    amHost,
    online,
    hostOnline,
    connection,
    error,
    setError,
    notFound,
    dispatch,
    chat,
    sendChat,
    serverNow: () => Date.now() + clockOffset.current,
  }
}

export function forgetRoom(game, code) {
  localStorage.removeItem(storageKey(game, code))
}
