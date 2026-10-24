import { useEffect, useRef, useState } from 'react'
import AdBanner, { adsenseConfigured } from './AdBanner.jsx'
import HouseAd from './HouseAd.jsx'

// Espaços de publicidade do site:
//  - "rail": colunas laterais (160×600), só em ecrãs largos
//  - "banner": faixa horizontal (728×90 no computador, 320×100 no telemóvel)
//  - "box": retângulo médio (300×250)
// Cada tipo tem o seu bloco no AdSense (podem ser trocados com as variáveis
// VITE_AD_SLOT_*). Enquanto o AdSense não tiver anúncio para o espaço (ex.:
// site ainda não aprovado), aparece a nossa publicidade (links de afiliado).
const SLOTS = {
  rail: import.meta.env.VITE_AD_SLOT_RAIL || '8628167075', // "Lateral", fixo 160×600
  banner: import.meta.env.VITE_AD_SLOT_BANNER || '7079940827', // "horizontal", adaptável
  box: import.meta.env.VITE_AD_SLOT_BOX,
}

const HIDE_PLACEHOLDERS = import.meta.env.VITE_ADS_PLACEHOLDER === 'off'
const HOUSE_ADS_ON = import.meta.env.VITE_HOUSE_ADS !== 'off'

export default function AdSlot({ variant = 'banner', className = '' }) {
  const slot = SLOTS[variant]
  const live = adsenseConfigured && slot
  const box = useRef(null)
  const [filled, setFilled] = useState(false)

  // O AdSense marca o bloco com data-ad-status="filled" quando mostra um anúncio.
  useEffect(() => {
    if (!live || !box.current) return undefined
    const check = () => setFilled(!!box.current?.querySelector('ins.adsbygoogle[data-ad-status="filled"]'))
    const mo = new MutationObserver(check)
    mo.observe(box.current, { attributes: true, subtree: true, attributeFilter: ['data-ad-status'] })
    check()
    return () => mo.disconnect()
  }, [live])

  if (!live && !HOUSE_ADS_ON && (HIDE_PLACEHOLDERS || adsenseConfigured)) return null

  return (
    <div className={`ad-slot ad-slot--${variant} ${className}`} data-testid={`ad-${variant}`} ref={box}>
      <span className="ad-slot__label">Publicidade</span>
      {live && (
        <div className={filled ? 'ad-slot__live' : 'ad-slot__live ad-slot__live--empty'}>
          <AdBanner
            slot={slot}
            fixed={variant === 'rail' ? [160, 600] : null}
            minWidth={variant === 'rail' ? 1360 : 0}
            format={variant === 'rail' ? 'vertical' : variant === 'box' ? 'rectangle' : 'auto'}
          />
        </div>
      )}
      {!filled && (HOUSE_ADS_ON ? <HouseAd variant={variant} /> : !live && <div className="ad-slot__placeholder" aria-hidden="true" />)}
    </div>
  )
}
