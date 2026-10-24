import { useState } from 'react'
import { HOUSE_ADS } from '../data/houseAds.js'
import { track } from '../lib/analytics.js'

// Roda os anúncios: cada espaço novo na página mostra o anúncio seguinte.
let next = Math.floor(Math.random() * HOUSE_ADS.length)

export default function HouseAd({ variant = 'banner' }) {
  const [ad] = useState(() => HOUSE_ADS[next++ % HOUSE_ADS.length])
  return (
    <a
      className={`house-ad house-ad--${variant} house-ad--${ad.theme}`}
      href={ad.url}
      target="_blank"
      rel="sponsored noopener noreferrer"
      onClick={() => track('affiliate_click', { item_id: ad.id, placement: variant })}
      data-testid="house-ad"
      data-ad={ad.id}
    >
      <span className="house-ad__emoji" aria-hidden="true">{ad.emoji}</span>
      <span className="house-ad__body">
        <small className="house-ad__brand">{ad.brand}</small>
        <b>{ad.title}</b>
        <span className="house-ad__text">{ad.text}</span>
      </span>
      <span className="house-ad__cta">{ad.cta}</span>
      <span className="house-ad__note">Ligação de afiliado: podemos receber uma comissão, sem custo para ti.</span>
    </a>
  )
}
