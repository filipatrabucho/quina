import { supabase, supabaseConfigured } from '../supabaseClient.js'

// Canal de uma sala: mensagens (broadcast) + quem está ligado (presence).
// Em produção usa o Supabase Realtime (não precisa de tabelas nem SQL).
// Sem Supabase configurado, usa BroadcastChannel, só liga separadores do
// mesmo browser, mas chega para desenvolver e testar localmente.
export function openChannel(topic, me, { onMessage, onPresence, onStatus }) {
  const useLocal =
    !supabaseConfigured || new URLSearchParams(window.location.search).get('transporte') === 'local'
  return useLocal
    ? openLocalChannel(topic, me, { onMessage, onPresence, onStatus })
    : openSupabaseChannel(topic, me, { onMessage, onPresence, onStatus })
}

function openSupabaseChannel(topic, me, { onMessage, onPresence, onStatus }) {
  const channel = supabase.channel(topic, {
    config: { broadcast: { self: false, ack: false }, presence: { key: me.id } },
  })
  let ready = false
  const queue = []

  channel
    .on('broadcast', { event: 'm' }, ({ payload }) => {
      if (payload?.to && payload.to !== me.id) return
      onMessage(payload.type, payload.data, payload.from)
    })
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      onPresence(Object.values(state).map((metas) => metas[metas.length - 1]))
    })
    .subscribe(async (status) => {
      onStatus?.(status === 'SUBSCRIBED' ? 'ligado' : status === 'CLOSED' ? 'fechado' : 'a-ligar')
      if (status === 'SUBSCRIBED') {
        ready = true
        await channel.track(me)
        while (queue.length) channel.send(queue.shift())
      }
    })

  return {
    send(type, data, to) {
      const msg = { type: 'broadcast', event: 'm', payload: { type, data, from: me.id, to } }
      if (ready) channel.send(msg)
      else queue.push(msg)
    },
    leave() {
      supabase.removeChannel(channel)
    },
  }
}

const HEARTBEAT_MS = 1500
const PRESENCE_TIMEOUT_MS = 5000

function openLocalChannel(topic, me, { onMessage, onPresence, onStatus }) {
  const bc = new BroadcastChannel(`quina:${topic}`)
  const peers = new Map() // id -> { meta, seen }
  let closed = false

  const emitPresence = () => {
    onPresence([me, ...[...peers.values()].map((p) => p.meta)])
  }

  bc.onmessage = (e) => {
    const msg = e.data
    if (!msg || msg.from === me.id) return
    if (msg.kind === 'hb' || msg.kind === 'bye') {
      const known = peers.has(msg.from)
      if (msg.kind === 'bye') {
        peers.delete(msg.from)
        emitPresence()
        return
      }
      peers.set(msg.from, { meta: msg.meta, seen: Date.now() })
      if (!known) {
        emitPresence()
        bc.postMessage({ kind: 'hb', from: me.id, meta: me }) // apresenta-te logo ao novo
      }
      return
    }
    if (msg.to && msg.to !== me.id) return
    onMessage(msg.type, msg.data, msg.from)
  }

  const beat = () => {
    if (closed) return
    bc.postMessage({ kind: 'hb', from: me.id, meta: me })
    const now = Date.now()
    let changed = false
    for (const [id, p] of peers) {
      if (now - p.seen > PRESENCE_TIMEOUT_MS) {
        peers.delete(id)
        changed = true
      }
    }
    if (changed) emitPresence()
  }
  const timer = setInterval(beat, HEARTBEAT_MS)
  const onUnload = () => bc.postMessage({ kind: 'bye', from: me.id })
  window.addEventListener('beforeunload', onUnload)

  setTimeout(() => {
    onStatus?.('ligado')
    beat()
    emitPresence()
  }, 0)

  return {
    send(type, data, to) {
      if (!closed) bc.postMessage({ kind: 'm', type, data, from: me.id, to })
    },
    leave() {
      closed = true
      clearInterval(timer)
      window.removeEventListener('beforeunload', onUnload)
      bc.postMessage({ kind: 'bye', from: me.id })
      bc.close()
    },
  }
}
