// Service worker do Tuga Games: deixa instalar o site como app e mostra o
// lembrete diário. Não guarda páginas em cache (cada visita vai à rede, para
// nunca ficar uma versão antiga do site).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})

self.addEventListener('push', (e) => {
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch {
    data = { body: e.data && e.data.text() }
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Tuga Games', {
      body: data.body || 'Há um desafio novo à tua espera.',
      icon: '/icon-192.png',
      badge: '/favicon-96.png',
      tag: data.tag || 'tuga-games',
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
