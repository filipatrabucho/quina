import { useEffect, useRef } from 'react'

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT

let scriptLoaded = false

function loadAdSenseScript(client) {
  if (scriptLoaded || !client) return
  scriptLoaded = true
  const script = document.createElement('script')
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`
  script.async = true
  script.crossOrigin = 'anonymous'
  document.head.appendChild(script)
}

export const adsenseConfigured = Boolean(CLIENT)

// Um bloco AdSense. "personalized" vem do consentimento do utilizador.
export default function AdBanner({ slot, format = 'auto', personalized = false, style }) {
  const pushed = useRef(false)
  useEffect(() => {
    if (!CLIENT || !slot || pushed.current) return
    pushed.current = true
    window.adsbygoogle = window.adsbygoogle || []
    if (!personalized) window.adsbygoogle.requestNonPersonalizedAds = 1
    loadAdSenseScript(CLIENT)
    try {
      window.adsbygoogle.push({})
    } catch {
      // normal se o script ainda estiver a carregar na primeira renderização
    }
  }, [slot, personalized])

  if (!CLIENT || !slot) return null

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block', ...style }}
      data-ad-client={CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={format === 'auto' ? 'true' : 'false'}
    />
  )
}
