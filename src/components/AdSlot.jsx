import AdBanner, { adsenseConfigured } from './AdBanner.jsx'

// Espaços de publicidade do site:
//  - "rail": colunas laterais (160×600), só em ecrãs largos
//  - "banner": faixa horizontal (728×90 no computador, 320×100 no telemóvel)
//  - "box": retângulo médio (300×250)
// Cada tipo tem o seu bloco no AdSense (podem ser trocados com as variáveis
// VITE_AD_SLOT_*). Enquanto o AdSense não estiver configurado, mostra o espaço reservado.
const SLOTS = {
  rail: import.meta.env.VITE_AD_SLOT_RAIL || '8628167075', // "Lateral", fixo 160×600
  banner: import.meta.env.VITE_AD_SLOT_BANNER,
  box: import.meta.env.VITE_AD_SLOT_BOX,
}

const HIDE_PLACEHOLDERS = import.meta.env.VITE_ADS_PLACEHOLDER === 'off'

export default function AdSlot({ variant = 'banner', className = '' }) {
  const slot = SLOTS[variant]
  const live = adsenseConfigured && slot
  // Com o AdSense ligado, um tipo sem bloco configurado não ocupa espaço.
  if (!live && (HIDE_PLACEHOLDERS || adsenseConfigured)) return null

  return (
    <div className={`ad-slot ad-slot--${variant} ${className}`} data-testid={`ad-${variant}`}>
      <span className="ad-slot__label">Publicidade</span>
      {live ? (
        <AdBanner
          slot={slot}
          fixed={variant === 'rail' ? [160, 600] : null}
          minWidth={variant === 'rail' ? 1360 : 0}
          format={variant === 'rail' ? 'vertical' : variant === 'box' ? 'rectangle' : 'auto'}
        />
      ) : (
        <div className="ad-slot__placeholder" aria-hidden="true" />
      )}
    </div>
  )
}
