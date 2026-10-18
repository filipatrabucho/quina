import { useEffect, useRef, useState } from 'react'
import { ADS_CLIENT, adsConfigured, ensureAdsScript } from '../lib/ads.js'

export { adsConfigured as adsenseConfigured }

// Um bloco AdSense. O consentimento (anúncios personalizados ou não) é
// tratado pela mensagem de privacidade da Google, configurada no AdSense.
// minWidth: só pede o anúncio se o ecrã tiver pelo menos esta largura
// (as colunas laterais estão escondidas em ecrãs mais pequenos).
export default function AdBanner({ slot, format = 'auto', fixed = null, minWidth = 0, style }) {
  const pushed = useRef(false)
  const [fits, setFits] = useState(!minWidth)
  useEffect(() => {
    if (!minWidth) return undefined
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`)
    const update = () => setFits(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [minWidth])
  useEffect(() => {
    if (!adsConfigured || !slot || !fits || pushed.current) return
    pushed.current = true
    ensureAdsScript()
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // o script ainda está a carregar: o AdSense apanha o bloco quando acabar
    }
  }, [slot, fits])

  if (!adsConfigured || !slot || !fits) return null
  // Bloco de tamanho fixo (ex.: Lateral 160×600): sem formato adaptável.
  if (fixed) {
    return (
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: fixed[0], height: fixed[1], ...style }}
        data-ad-client={ADS_CLIENT}
        data-ad-slot={slot}
      />
    )
  }
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
