import test from 'node:test'
import assert from 'node:assert/strict'
import { sendAll, message, dayNumber } from '../netlify/functions/lembrete-diario.mjs'

test('mensagem do dia', () => {
  assert.equal(dayNumber(Date.UTC(2026, 9, 21, 12)), 1)
  const m = message(Date.UTC(2026, 9, 23, 9))
  assert.match(m.title, /Emoji do Dia #3/)
  assert.match(m.url, /^\/emoji-do-dia\?utm_source=lembrete/)
})

test('envia a todos e apaga as subscrições que já não existem', async () => {
  const calls = []
  const fetchFn = async (url, opts = {}) => {
    calls.push([opts.method || 'GET', url])
    if (!opts.method) return { ok: true, json: async () => [{ endpoint: 'https://push.x/1', p256dh: 'a', auth: 'b' }, { endpoint: 'https://push.x/2', p256dh: 'a', auth: 'b' }] }
    return { ok: true }
  }
  const sent = []
  const send = async (sub, payload) => {
    if (sub.endpoint.endsWith('/2')) throw Object.assign(new Error('gone'), { statusCode: 410 })
    sent.push(JSON.parse(payload).title)
  }
  const keys = (await import('web-push')).default.generateVAPIDKeys()
  const r = await sendAll({ url: 'https://sb.test', serviceKey: 'svc', privateKey: keys.privateKey, send, fetchFn })
  assert.deepEqual(r, { total: 2, sent: 1, removed: 1 })
  assert.ok(calls.some(([m, u]) => m === 'DELETE' && u.includes(encodeURIComponent('https://push.x/2'))))
})
