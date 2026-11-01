import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, supabaseConfigured } from '../supabaseClient.js'

// Chat de voz da sala (beta): o áudio vai direto entre os browsers (WebRTC,
// cada um ligado a cada um) e o Supabase Realtime só serve para combinar as
// ligações. Nada passa nem fica guardado no nosso servidor.
export const VOICE_MAX = 8

// Servidores para atravessar as redes. STUN grátis da Google; para quem está
// atrás de redes mais fechadas (dados móveis, empresas) é preciso um TURN,
// configurado no Netlify: VITE_TURN_URLS (separados por vírgula),
// VITE_TURN_USERNAME e VITE_TURN_CREDENTIAL.
function iceServers() {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
  const urls = (import.meta.env.VITE_TURN_URLS || '').split(',').map((u) => u.trim()).filter(Boolean)
  if (urls.length) list.push({ urls, username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL })
  return list
}
export const hasTurn = () => !!(import.meta.env.VITE_TURN_URLS || '').trim()

// Nível do som (0 a 1) de uma stream, para mostrar quem está a falar.
function meter(stream) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    const src = ctx.createMediaStreamSource(stream)
    const an = ctx.createAnalyser()
    an.fftSize = 512
    src.connect(an)
    const buf = new Uint8Array(an.fftSize)
    return {
      level() {
        an.getByteTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += (v - 128) ** 2
        return Math.sqrt(sum / buf.length) / 128
      },
      close() {
        ctx.close().catch(() => {})
      },
    }
  } catch {
    return { level: () => 0, close() {} }
  }
}

export function useVoice({ game, code, me, enabled }) {
  const [joined, setJoined] = useState(false)
  const [members, setMembers] = useState([]) // quem está na voz: { id, name, avatar, seed, muted }
  const [muted, setMuted] = useState(false)
  const [silenced, setSilenced] = useState({}) // id -> true (eu não quero ouvir)
  const [speaking, setSpeaking] = useState({}) // id -> true
  const [links, setLinks] = useState({}) // id -> estado da ligação
  const [error, setError] = useState('')
  const chRef = useRef(null)
  const micRef = useRef(null)
  const peers = useRef(new Map()) // id -> { pc, audio, meter }
  const myMeter = useRef(null)
  const kicked = useRef(false)
  const joinedAt = useRef(0)
  const gone = useRef({}) // id -> quando disse "adeus" (o servidor pode demorar a avisar)

  const send = (event, payload) => chRef.current?.send({ type: 'broadcast', event, payload: { ...payload, from: me.id } })

  const dropPeer = useCallback((id) => {
    const p = peers.current.get(id)
    if (!p) return
    p.pc.close()
    p.meter?.close()
    if (p.audio) {
      p.audio.srcObject = null
      p.audio.remove()
    }
    peers.current.delete(id)
    setLinks((l) => {
      const n = { ...l }
      delete n[id]
      return n
    })
  }, [])

  const peerFor = useCallback(
    (id) => {
      if (peers.current.has(id)) return peers.current.get(id)
      const pc = new RTCPeerConnection({ iceServers: iceServers() })
      const entry = { pc, audio: null, meter: null, pending: [] }
      peers.current.set(id, entry)
      micRef.current?.getTracks().forEach((t) => pc.addTrack(t, micRef.current))
      pc.onicecandidate = (e) => e.candidate && send('sig', { to: id, kind: 'ice', data: e.candidate.toJSON() })
      pc.ontrack = (e) => {
        const stream = e.streams[0] || new MediaStream([e.track])
        if (!entry.audio) {
          entry.audio = new Audio()
          entry.audio.autoplay = true
          entry.audio.playsInline = true
          entry.audio.dataset.voice = id
          document.body.appendChild(entry.audio)
        }
        entry.audio.srcObject = stream
        entry.audio.play().catch(() => {})
        entry.meter?.close()
        entry.meter = meter(stream)
      }
      pc.onconnectionstatechange = () => {
        setLinks((l) => ({ ...l, [id]: pc.connectionState }))
        if (pc.connectionState === 'failed') pc.restartIce?.()
      }
      return entry
    },
    [me?.id] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const leave = useCallback(() => {
    for (const id of [...peers.current.keys()]) dropPeer(id)
    micRef.current?.getTracks().forEach((t) => t.stop())
    micRef.current = null
    myMeter.current?.close()
    myMeter.current = null
    const ch = chRef.current
    chRef.current = null
    if (ch) ch.send({ type: 'broadcast', event: 'bye', payload: { from: me.id, joinedAt: joinedAt.current } })
    // Avisa logo os outros de que saiu (e só depois fecha o canal).
    if (ch) Promise.resolve(ch.untrack()).catch(() => {}).finally(() => supabase.removeChannel(ch))
    setJoined(false)
    setMembers([])
    setSpeaking({})
  }, [dropPeer, me?.id])

  const join = useCallback(async () => {
    setError('')
    if (kicked.current) return setError('O anfitrião tirou-te da voz nesta sala.')
    if (!supabaseConfigured) return setError('A voz precisa da ligação ao servidor.')
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') return setError('Este browser não suporta chat de voz.')
    try {
      micRef.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    } catch {
      return setError('Não deu para usar o microfone. Dá autorização ao site nas definições do browser.')
    }
    myMeter.current = meter(micRef.current)
    setMuted(false)
    const ch = supabase.channel(`voz:${game}:${code}`, { config: { broadcast: { self: false }, presence: { key: me.id } } })
    chRef.current = ch
    const sync = () => {
      const list = Object.values(ch.presenceState())
        .map((metas) => metas[metas.length - 1])
        .filter((m) => !(gone.current[m.id] >= (m.joinedAt || 0)))
      setMembers(list)
      const ids = new Set(list.map((m) => m.id))
      for (const id of [...peers.current.keys()]) if (!ids.has(id)) dropPeer(id)
      // Quem tem o id "menor" começa a ligação (assim só um dos dois liga).
      for (const m of list) {
        if (m.id === me.id || peers.current.has(m.id)) continue
        const { pc } = peerFor(m.id)
        if (me.id < m.id) {
          pc.createOffer()
            .then((o) => pc.setLocalDescription(o))
            .then(() => send('sig', { to: m.id, kind: 'offer', data: pc.localDescription.toJSON() }))
            .catch(() => {})
        }
      }
    }
    ch.on('presence', { event: 'sync' }, sync)
    ch.on('broadcast', { event: 'bye' }, ({ payload }) => {
      if (!payload?.from) return
      gone.current[payload.from] = payload.joinedAt || Date.now()
      sync()
    })
    ch.on('broadcast', { event: 'sig' }, async ({ payload }) => {
      if (payload?.to !== me.id) return
      const entry = peerFor(payload.from)
      const { pc } = entry
      // Candidatos que chegam antes da proposta ficam à espera.
      const flush = async () => {
        while (entry.pending.length) await pc.addIceCandidate(entry.pending.shift()).catch(() => {})
      }
      try {
        if (payload.kind === 'offer') {
          await pc.setRemoteDescription(payload.data)
          await flush()
          await pc.setLocalDescription(await pc.createAnswer())
          send('sig', { to: payload.from, kind: 'answer', data: pc.localDescription.toJSON() })
        } else if (payload.kind === 'answer') {
          await pc.setRemoteDescription(payload.data)
          await flush()
        } else if (payload.kind === 'ice') {
          if (pc.remoteDescription) await pc.addIceCandidate(payload.data)
          else entry.pending.push(payload.data)
        }
      } catch {
        // mensagem fora de ordem: a ligação recompõe-se
      }
    })
    ch.on('broadcast', { event: 'kick' }, ({ payload }) => {
      if (payload?.to !== me.id) return
      kicked.current = true
      leave()
      setError('O anfitrião tirou-te da voz.')
    })
    await new Promise((resolve) => {
      ch.subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return
        const current = Object.keys(ch.presenceState()).length
        if (current >= VOICE_MAX) {
          leave()
          setError(`A voz já tem ${VOICE_MAX} pessoas.`)
        } else {
          joinedAt.current = Date.now()
          await ch.track({ id: me.id, name: me.name, avatar: me.avatar || null, seed: me.seed || null, muted: false, joinedAt: joinedAt.current })
          setJoined(true)
        }
        resolve()
      })
    })
  }, [game, code, me, peerFor, dropPeer, leave]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = useCallback(() => {
    const next = !muted
    micRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next
    })
    setMuted(next)
    chRef.current?.track({ id: me.id, name: me.name, avatar: me.avatar || null, seed: me.seed || null, muted: next, joinedAt: joinedAt.current })
  }, [muted, me])

  const toggleSilence = useCallback((id) => {
    setSilenced((s) => {
      const n = { ...s, [id]: !s[id] }
      const p = peers.current.get(id)
      if (p?.audio) p.audio.muted = !!n[id]
      return n
    })
  }, [])

  const kick = useCallback((id) => send('kick', { to: id }), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Quem está a falar (atualiza 5 vezes por segundo).
  useEffect(() => {
    if (!joined) return undefined
    const t = setInterval(() => {
      const next = {}
      if (myMeter.current && !muted && myMeter.current.level() > 0.04) next[me.id] = true
      for (const [id, p] of peers.current) if (p.meter && !silenced[id] && p.meter.level() > 0.04) next[id] = true
      setSpeaking((s) => (Object.keys(s).join() === Object.keys(next).join() ? s : next))
    }, 200)
    return () => clearInterval(t)
  }, [joined, muted, silenced, me?.id])

  // Sai da voz ao sair da sala (ou se a voz deixar de estar disponível).
  useEffect(() => () => leave(), [leave])
  useEffect(() => {
    if (!enabled && joined) leave()
  }, [enabled, joined, leave])

  return { joined, members, muted, silenced, speaking, links, error, join, leave, toggleMute, toggleSilence, kick }
}
