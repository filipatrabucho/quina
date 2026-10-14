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
  const stateRef = useRef(state)
  const channelRef = useRef(null)
  const clockOffset = useRef(0)

  const amHost = !!state && state.hostId === me?.id
  const amHostRef = useRef(amHost)
  amHostRef.current = amHost

  const commit = useCallback(
    (next) => {
      stateRef.current = next
      setState(next)
      localStorage.setItem(storageKey(game, code), JSON.stringify(next))
      channelRef.current?.send('state', { state: next, now: Date.now() })
    },
    [game, code]
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
    setNotFound(false)
    setError('')
  }, [game, code])

  useEffect(() => {
    if (!code || !me?.id) return undefined
    const channel = openChannel(`${game}:${code}`, me, {
      onStatus: setConnection,
      onPresence: setOnline,
      onMessage(type, data, from) {
        if (amHostRef.current) {
          if (type === 'hello') {
            applyAsHost({ type: 'join', player: data.player }, from)
            channel.send('state', { state: stateRef.current, now: Date.now() })
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
    }, 1000)
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
    serverNow: () => Date.now() + clockOffset.current,
  }
}

export function forgetRoom(game, code) {
  localStorage.removeItem(storageKey(game, code))
}
