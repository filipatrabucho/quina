// Lembrete diário do Emoji do Dia (função agendada do Netlify).
// Precisa destas variáveis no Netlify: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// VAPID_PRIVATE_KEY (e opcionalmente VITE_VAPID_PUBLIC_KEY, se a chave mudar).
import webpush from 'web-push'

const PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY || 'BCsAq-_TViDa5iZAYtr_wQh7RJu3D1AHR819A9yMJYCpMCrFAuWyr8TIhLgUxtc10vTOq7QrR9N6AnZ8-XEI-zg'
const FIRST_DAY = Date.UTC(2026, 9, 21)

export function dayNumber(now = Date.now()) {
  const day = new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Europe/Lisbon' })
  const [y, m, d] = day.split('-').map(Number)
  return Math.floor((Date.UTC(y, m - 1, d) - FIRST_DAY) / 86400000) + 1
}

export function message(now = Date.now()) {
  const n = dayNumber(now)
  return {
    title: `🎬 Emoji do Dia #${n}`,
    body: 'Os 5 enigmas de hoje já estão prontos. Mantém a tua sequência! 🔥',
    url: '/emoji-do-dia?utm_source=lembrete&utm_medium=push&utm_campaign=emoji_do_dia',
    tag: `emoji-do-dia-${n}`,
  }
}

export async function sendAll({ url, serviceKey, privateKey, send = webpush.sendNotification, fetchFn = fetch, now = Date.now() }) {
  webpush.setVapidDetails('mailto:tuga.games.staff@gmail.com', PUBLIC_KEY, privateKey)
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
  const res = await fetchFn(`${url}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth`, { headers })
  if (!res.ok) throw new Error(`Supabase respondeu ${res.status}`)
  const subs = await res.json()
  const payload = JSON.stringify(message(now))
  let sent = 0
  const gone = []
  for (const s of subs) {
    try {
      await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600 })
      sent++
    } catch (e) {
      // 404/410: a pessoa desligou as notificações ou desinstalou; apaga.
      if (e.statusCode === 404 || e.statusCode === 410) gone.push(s.endpoint)
    }
  }
  for (const endpoint of gone) {
    await fetchFn(`${url}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE', headers })
  }
  return { total: subs.length, sent, removed: gone.length }
}

export default async () => {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!url || !serviceKey || !privateKey) {
    console.log('lembrete-diario: faltam variáveis (SUPABASE_SERVICE_ROLE_KEY e/ou VAPID_PRIVATE_KEY)')
    return new Response('faltam variáveis', { status: 200 })
  }
  const r = await sendAll({ url, serviceKey, privateKey })
  console.log('lembrete-diario:', JSON.stringify(r))
  return new Response(JSON.stringify(r), { status: 200 })
}

// Todos os dias às 9:00 UTC (9h em Lisboa no inverno, 10h no verão).
export const config = { schedule: '0 9 * * *' }
