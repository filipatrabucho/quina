import { useEffect, useState } from 'react'
import { AD_FORMATS, VERTICAL_AT_ONCE, adminListAds, adminSaveAd, adminDeleteAd, adminSetAdActive, uploadAdImage } from '../lib/houseAds.js'
import { HouseAdCard } from '../components/HouseAd.jsx'

const EMPTY = { format: 'horizontal', brand: '', title: '', body: '', cta: 'Ver mais', url: 'https://', image_url: null, emoji: '', active: true, sort: 0 }

function AdForm({ initial, onSaved, onCancel }) {
  const [ad, setAd] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setAd((a) => ({ ...a, ...patch }))
  const pickImage = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      set({ image_url: await uploadAdImage(file) })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await adminSaveAd(ad)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="ads-form" onSubmit={save} data-testid="ads-form">
      <h3 className="bo-sub">{ad.id ? 'Editar anúncio' : 'Novo anúncio'}</h3>
      <div className="ads-form__grid">
        <div className="ads-form__fields">
          <fieldset className="ads-format">
            <legend>Formato</legend>
            {Object.entries(AD_FORMATS).map(([key, f]) => (
              <label key={key} className={`ads-format__opt${ad.format === key ? ' ads-format__opt--on' : ''}`}>
                <input type="radio" name="format" value={key} checked={ad.format === key} onChange={() => set({ format: key })} data-testid={`ads-format-${key}`} />
                <span className={`ads-format__shape ads-format__shape--${key}`} aria-hidden="true" />
                <span><b>{f.label}</b><small>{f.where}</small></span>
              </label>
            ))}
          </fieldset>
          <label className="ads-field">Imagem (opcional)
            <span className="ads-image">
              {ad.image_url ? <img src={ad.image_url} alt="" /> : <span className="ads-image__none">Sem imagem: aparece o emoji</span>}
              <span className="ads-image__btns">
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickImage} disabled={busy} data-testid="ads-image" />
                {ad.image_url && <button type="button" className="link-btn" onClick={() => set({ image_url: null })}>Tirar imagem</button>}
              </span>
            </span>
          </label>
          {!ad.image_url && (
            <label className="ads-field">Emoji (quando não há imagem)
              <input value={ad.emoji || ''} onChange={(e) => set({ emoji: e.target.value })} maxLength={8} placeholder="🎮" />
            </label>
          )}
          <label className="ads-field">Marca (pequeno, em cima)
            <input value={ad.brand} onChange={(e) => set({ brand: e.target.value })} maxLength={40} placeholder="Ex.: Amazon" />
          </label>
          <label className="ads-field">Título *
            <input value={ad.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} required data-testid="ads-title" />
          </label>
          <label className="ads-field">Texto
            <textarea value={ad.body} onChange={(e) => set({ body: e.target.value })} maxLength={200} rows={2} data-testid="ads-body" />
          </label>
          <div className="ads-form__row">
            <label className="ads-field">Link *
              <input value={ad.url} onChange={(e) => set({ url: e.target.value })} required data-testid="ads-url" />
            </label>
            <label className="ads-field">Texto do botão
              <input value={ad.cta} onChange={(e) => set({ cta: e.target.value })} maxLength={30} />
            </label>
          </div>
          <div className="ads-form__row">
            <label className="ads-field ads-field--small">Ordem
              <input type="number" value={ad.sort} onChange={(e) => set({ sort: e.target.value })} />
            </label>
            <label className="ads-check">
              <input type="checkbox" checked={ad.active} onChange={(e) => set({ active: e.target.checked })} /> Ativo (aparece no site)
            </label>
          </div>
        </div>
        <div className="ads-form__preview">
          <p className="admin-note" style={{ margin: 0 }}>Pré-visualização</p>
          <div className={`ads-preview ads-preview--${ad.format}`}>
            <HouseAdCard ad={{ ...ad, id: 'preview', title: ad.title || 'Título do anúncio' }} variant={ad.format === 'vertical' ? 'rail' : 'banner'} preview />
          </div>
        </div>
      </div>
      {error && <p className="duel-error">{error}</p>}
      <div className="ads-form__actions">
        <button type="submit" className="share-btn" disabled={busy} data-testid="ads-save">{busy ? 'A guardar…' : 'Guardar anúncio'}</button>
        <button type="button" className="link-btn" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export default function AdminAds() {
  const [ads, setAds] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const load = () => adminListAds().then(setAds, (e) => setError(e.message))
  useEffect(() => {
    load()
  }, [])
  const toggle = async (ad) => {
    try {
      await adminSetAdActive(ad.id, !ad.active)
      load()
    } catch (e) {
      setError(e.message)
    }
  }
  const remove = async (ad) => {
    if (!window.confirm(`Apagar o anúncio "${ad.title}"?`)) return
    try {
      await adminDeleteAd(ad.id)
      load()
    } catch (e) {
      setError(e.message)
    }
  }
  return (
    <section className="bo-card" data-testid="bo-ads">
      <p className="admin-note" style={{ margin: 0 }}>
        A tua publicidade aparece nos espaços de anúncios enquanto o AdSense não estiver ativo (quando estiver, o AdSense tem prioridade). Ativa os anúncios que queres
        mostrar: se houver mais do que cabe, vão rodando.
      </p>
      {error && <p className="duel-error">{error}</p>}
      {editing ? (
        <AdForm initial={editing} onSaved={() => { setEditing(null); load() }} onCancel={() => setEditing(null)} />
      ) : (
        <button type="button" className="share-btn ads-new" onClick={() => setEditing({ ...EMPTY })} data-testid="ads-new">+ Novo anúncio</button>
      )}
      {!ads && !error && <p className="bo-empty">A carregar…</p>}
      {ads && Object.entries(AD_FORMATS).map(([key, f]) => {
        const list = ads.filter((a) => a.format === key)
        const on = list.filter((a) => a.active).length
        return (
          <div key={key} className="ads-group" data-testid={`ads-group-${key}`}>
            <h3 className="bo-sub">{f.label} <small className="ads-group__count">{on} {on === 1 ? 'ativo' : 'ativos'}</small></h3>
            <p className="admin-note" style={{ margin: 0 }}>
              {f.where}
              {key === 'vertical' && on > VERTICAL_AT_ONCE && ` Tens ${on} ativos: aparecem ${VERTICAL_AT_ONCE} de cada vez, a rodar.`}
              {key === 'horizontal' && on > 1 && ` Tens ${on} ativos: vão rodando.`}
              {on === 0 && ' Nenhum ativo: este espaço fica vazio.'}
            </p>
            <div className={`ads-list ads-list--${key}`}>
              {list.map((ad) => (
                <div key={ad.id} className={`ads-item${ad.active ? '' : ' ads-item--off'}`} data-testid={`ads-item-${ad.id}`}>
                  <HouseAdCard ad={ad} variant={key === 'vertical' ? 'rail' : 'banner'} preview />
                  <div className="ads-item__bar">
                    <label className="ads-check">
                      <input type="checkbox" checked={ad.active} onChange={() => toggle(ad)} data-testid={`ads-active-${ad.id}`} /> {ad.active ? 'Ativo' : 'Inativo'}
                    </label>
                    <button type="button" className="btn btn--small btn--outline" onClick={() => setEditing({ ...ad, brand: ad.brand || '', body: ad.body || '' })}>Editar</button>
                    <button type="button" className="link-btn" onClick={() => remove(ad)}>Apagar</button>
                  </div>
                </div>
              ))}
              {!list.length && <p className="bo-empty">Ainda não há anúncios {f.label.toLowerCase()}s.</p>}
            </div>
          </div>
        )
      })}
    </section>
  )
}
