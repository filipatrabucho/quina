import { supabase, supabaseConfigured } from './supabaseClient.js'
import { HOUSE_ADS } from '../data/houseAds.js'

// Publicidade da casa (até o AdSense estar ativo), gerida no Backoffice > Publicidade.
//   vertical: coluna à direita no PC (até 2 ao mesmo tempo, uma por baixo da outra)
//   horizontal: faixas por baixo dos jogos e na página inicial (PC e telemóvel)
export const AD_FORMATS = {
  vertical: { label: 'Vertical', where: 'Coluna à direita do site, só no PC (ecrãs largos). Aparecem até 2 ao mesmo tempo, uma por baixo da outra.' },
  horizontal: { label: 'Horizontal', where: 'Faixa por baixo dos jogos e na página inicial, no PC e no telemóvel. Aparece 1 de cada vez.' },
}
export const VERTICAL_AT_ONCE = 2

// Reserva: os anúncios que estavam no código (se a tabela ainda não existir ou falhar).
const FALLBACK = HOUSE_ADS.flatMap((a, i) => ['horizontal', 'vertical'].map((format) => ({ id: `${a.id}-${format}`, format, brand: a.brand, title: a.title, body: a.text, cta: a.cta, url: a.url, emoji: a.emoji, image_url: null, sort: i })))

let cache = null
export function loadActiveAds() {
  if (!cache) {
    cache = !supabaseConfigured
      ? Promise.resolve(FALLBACK)
      : supabase
          .from('house_ads')
          .select('id, format, brand, title, body, cta, url, image_url, emoji, sort')
          .eq('active', true)
          .order('sort')
          .order('created_at')
          .then(({ data, error }) => (error || !data ? FALLBACK : data))
  }
  return cache
}
export const forgetAdsCache = () => {
  cache = null
}

// ---- Backoffice ----
export async function adminListAds() {
  const { data, error } = await supabase.from('house_ads').select('*').order('format').order('sort').order('created_at')
  if (error) throw new Error(/house_ads/.test(error.message) ? 'Falta correr o supabase/schema-social.sql novo no Supabase.' : error.message)
  return data
}

export async function adminSaveAd(ad) {
  const row = {
    format: ad.format,
    brand: (ad.brand || '').trim(),
    title: (ad.title || '').trim(),
    body: (ad.body || '').trim(),
    cta: (ad.cta || '').trim() || 'Ver mais',
    url: (ad.url || '').trim(),
    image_url: ad.image_url || null,
    emoji: (ad.emoji || '').trim() || null,
    active: ad.active !== false,
    sort: Number(ad.sort) || 0,
    updated_at: new Date().toISOString(),
  }
  if (!row.title) throw new Error('Falta o título.')
  if (!/^https?:\/\//.test(row.url)) throw new Error('O link tem de começar por https://')
  const q = ad.id ? supabase.from('house_ads').update(row).eq('id', ad.id) : supabase.from('house_ads').insert(row)
  const { error } = await q
  if (error) throw new Error(error.message)
  forgetAdsCache()
}

export async function adminDeleteAd(id) {
  const { error } = await supabase.from('house_ads').delete().eq('id', id)
  if (error) throw new Error(error.message)
  forgetAdsCache()
}

export async function adminSetAdActive(id, active) {
  const { error } = await supabase.from('house_ads').update({ active, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  forgetAdsCache()
}

// Carrega a imagem de um anúncio e devolve o endereço público.
export async function uploadAdImage(file) {
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw new Error('A imagem tem de ser PNG, JPG, WEBP ou GIF.')
  if (file.size > 3 * 1024 * 1024) throw new Error('A imagem tem de ter menos de 3 MB.')
  const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('ads').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(error.message)
  return supabase.storage.from('ads').getPublicUrl(path).data.publicUrl
}
