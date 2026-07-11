import { useEffect } from 'react'

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

export default function AdBanner({ slot }) {
  useEffect(() => {
    if (!CLIENT || !slot) return
    loadAdSenseScript(CLIENT)
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // normal se o script ainda estiver a carregar na primeira renderização
    }
  }, [slot])

  if (!CLIENT || !slot) return null

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block' }}
      data-ad-client={CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}