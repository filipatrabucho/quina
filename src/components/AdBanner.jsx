import { useEffect, useRef } from 'react'
import { ADS_CLIENT, adsConfigured, ensureAdsScript } from '../lib/ads.js'

export { adsConfigured as adsenseConfigured }

// Um bloco AdSense. O consentimento (anúncios personalizados ou não) é
// tratado pela mensagem de privacidade da Google, configurada no AdSense.
export default function AdBanner({ slot, format = 'auto', style }) {
  const pushed = useRef(false)
  useEffect(() => {
    if (!adsConfigured || !slot || pushed.current) return
    pushed.current = true
    ensureAdsScript()
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // o script ainda está a carregar: o AdSense apanha o bloco quando acabar
    }
  }, [slot])

  if (!adsConfigured || !slot) return null
  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block', ...style }}
      data-ad-client={ADS_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={format === 'auto' ? 'true' : 'false'}
    />
  )
}
