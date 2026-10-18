// Publicidade (Google AdSense). O ID de editor pode ser trocado com a
// variável VITE_ADSENSE_CLIENT no Netlify; em desenvolvimento fica desligado.
export const ADSENSE_PUBLISHER = 'ca-pub-5462942064593521'
export const ADS_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT || (import.meta.env.PROD ? ADSENSE_PUBLISHER : '')
export const adsConfigured = Boolean(ADS_CLIENT)
// Anúncios entre partidas (AdSense para jogos H5). Só depois de a Google aprovar.
export const gameAdsOn = adsConfigured && import.meta.env.VITE_ADSENSE_GAMES === 'on'

export function ensureAdsScript() {
  if (!adsConfigured || typeof document === 'undefined') return
  // Em produção quem carrega o script é o código no <head> (só depois de a
  // pessoa mexer na página ou de alguns segundos).
  if (window.__tgLoadAds) return
  if (document.querySelector('script[src*="adsbygoogle.js"]')) return
  const s = document.createElement('script')
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}`
  s.async = true
  s.crossOrigin = 'anonymous'
  if (gameAdsOn) s.dataset.adFrequencyHint = '60s'
  document.head.appendChild(s)
}

if (typeof window !== 'undefined' && gameAdsOn) {
  window.adsbygoogle = window.adsbygoogle || []
  window.adBreak = window.adConfig = window.adBreak || function (o) { window.adsbygoogle.push(o) }
  window.adConfig({ preloadAdBreaks: 'on', sound: 'on' })
  ensureAdsScript()
}

// Antes de começar outra partida: mostra um anúncio (se a Google tiver um
// disponível e já tiver passado tempo suficiente) e depois continua.
export function gameBreak(name, then) {
  if (!gameAdsOn || typeof window.adBreak !== 'function') {
    then?.()
    return
  }
  let done = false
  const go = () => {
    if (done) return
    done = true
    then?.()
  }
  try {
    window.adBreak({ type: 'next', name, adBreakDone: go })
  } catch {
    go()
  }
  setTimeout(go, 8000) // nunca deixa o jogador preso se o anúncio falhar
}

// Abre as opções de privacidade e cookies da Google (mensagem de consentimento).
export function showPrivacyOptions() {
  window.googlefc = window.googlefc || {}
  window.googlefc.callbackQueue = window.googlefc.callbackQueue || []
  window.googlefc.callbackQueue.push(() => window.googlefc.showRevocationMessage?.())
}
