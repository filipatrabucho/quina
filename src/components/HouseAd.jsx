import { useEffect, useState } from 'react'
import { loadActiveAds, VERTICAL_AT_ONCE } from '../lib/houseAds.js'
import { track } from '../lib/analytics.js'

// Roda os anúncios: cada espaço novo na página mostra o anúncio seguinte.
const turn = { vertical: Math.floor(Math.random() * 100), horizontal: Math.floor(Math.random() * 100) }

// Um anúncio (também usado na pré-visualização do Backoffice).
export function HouseAdCard({ ad, variant = 'banner', preview = false }) {
  const theme = /amazon/i.test(ad.url) ? 'amazon' : /instant-gaming/i.test(ad.url) ? 'ig' : 'own'
  return (
    <a
      className={`house-ad house-ad--${variant} house-ad--${theme}${ad.image_url ? ' house-ad--img' : ''}`}
      href={preview ? undefined : ad.url}
      target="_blank"
      rel="sponsored noopener noreferrer"
      onClick={preview ? (e) => e.preventDefault() : () => track('affiliate_click', { item_id: String(ad.id), placement: variant })}
      data-testid="house-ad"
      data-ad={ad.id}
    >
      {ad.image_url ? (
        <img className="house-ad__img" src={ad.image_url} alt="" loading="lazy" />
      ) : (
        <span className="house-ad__emoji" aria-hidden="true">{ad.emoji || '⭐'}</span>
      )}
      <span className="house-ad__body">
        {ad.brand && <small className="house-ad__brand">{ad.brand}</small>}
        <b>{ad.title}</b>
        {ad.body && <span className="house-ad__text">{ad.body}</span>}
      </span>
      <span className="house-ad__cta">{ad.cta}</span>
      <span className="house-ad__note">Publicidade: podemos receber uma comissão, sem custo para ti.</span>
    </a>
  )
}

export default function HouseAd({ variant = 'banner' }) {
  const format = variant === 'rail' ? 'vertical' : 'horizontal'
  const [ads, setAds] = useState(null)
  useEffect(() => {
    let alive = true
    loadActiveAds().then((all) => {
      if (!alive) return
      const list = all.filter((a) => a.format === format)
      if (!list.length) return setAds([])
      // vertical: até 2 ao mesmo tempo (um por baixo do outro); horizontal: 1
      const n = format === 'vertical' ? Math.min(VERTICAL_AT_ONCE, list.length) : 1
      const start = turn[format]
      turn[format] += n
      setAds(Array.from({ length: n }, (_, i) => list[(start + i) % list.length]))
    })
    return () => {
      alive = false
    }
  }, [format])
  if (!ads || !ads.length) return null
  return (
    <div className={`house-ads house-ads--${format}`}>
      {ads.map((ad) => <HouseAdCard key={ad.id} ad={ad} variant={variant} />)}
    </div>
  )
}
