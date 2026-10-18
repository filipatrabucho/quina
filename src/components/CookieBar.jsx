import { useEffect, useState } from 'react'
import { trackPageView } from '../lib/analytics.js'

const KEY = 'tg-cookies'
const OPEN_EVENT = 'tg-cookies-abrir'

function readChoice() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return 'nao'
  }
}

// Volta a mostrar a barra (link "Cookies" no rodapé).
export function openCookieBar() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

// Barra de cookies do site: só controla as estatísticas (Google Analytics).
// Os anúncios continuam a usar a mensagem de consentimento da Google.
export default function CookieBar() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!readChoice()) setOpen(true)
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  const choose = (accepted) => {
    try {
      localStorage.setItem(KEY, accepted ? 'sim' : 'nao')
    } catch {}
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: accepted ? 'granted' : 'denied' })
      // A visita a esta página foi enviada antes de aceitar (sem cookies e
      // fora dos relatórios): volta a enviá-la para contar logo.
      if (accepted) trackPageView(window.location.pathname + window.location.search, document.title)
    }
    setOpen(false)
  }

  if (!open) return null
  return (
    <div className="cookie-bar" role="dialog" aria-label="Cookies" data-testid="cookie-bar">
      <p>
        Usamos cookies de estatística para perceber que jogos são mais jogados e melhorar o site.{' '}
        <a href="/privacidade.html">Saber mais</a>
      </p>
      <div className="cookie-bar__actions">
        <button type="button" className="btn btn--outline btn--small" onClick={() => choose(false)}>Recusar</button>
        <button type="button" className="btn btn--primary btn--small" onClick={() => choose(true)} data-testid="cookie-accept">Aceitar</button>
      </div>
    </div>
  )
}
