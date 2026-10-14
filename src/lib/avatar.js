import { supabase } from './supabaseClient.js'

const AVATAR_BUCKET = 'avatars'
const cache = new Map()

export function randomSeed() {
  return Math.random().toString(36).slice(2, 10)
}

// Boneco gerado a partir de uma "seed": a mesma seed dá sempre o mesmo
// boneco, por isso basta guardar a seed para o reconstruir em qualquer lado.
let generator = null
export function loadAvatarGenerator() {
  if (!generator) generator = import('./avatarGenerator.js')
  return generator
}

export async function generatedAvatarSvg(seed) {
  return (await loadAvatarGenerator()).generatedAvatarSvg(seed)
}

// Síncrono se o gerador já estiver carregado; senão devolve null.
let loaded = null
export function generatedAvatarUriSync(seed) {
  if (!loaded) return null
  const key = String(seed || 'quina')
  if (!cache.has(key)) {
    cache.set(key, `data:image/svg+xml;utf8,${encodeURIComponent(loaded.generatedAvatarSvg(key))}`)
  }
  return cache.get(key)
}

export async function generatedAvatarUri(seed) {
  loaded = await loadAvatarGenerator()
  return generatedAvatarUriSync(seed)
}

// Reduz a imagem para um quadrado de 256px (corte ao centro), para os
// avatares carregados não pesarem.
export async function resizeImageFile(file, size = 256) {
  if (!file.type.startsWith('image/')) throw new Error('Escolhe um ficheiro de imagem.')
  if (file.size > 8 * 1024 * 1024) throw new Error('A imagem é demasiado grande (máx. 8 MB).')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Não foi possível ler essa imagem.'))
      el.src = url
    })
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    canvas
      .getContext('2d')
      .drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size)
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function uploadAvatar(userId, blob, ext, contentType) {
  const path = `${userId}/avatar-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType, upsert: true, cacheControl: '31536000' })
  if (error) throw error
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function uploadGeneratedAvatar(userId, seed) {
  const blob = new Blob([await generatedAvatarSvg(seed)], { type: 'image/svg+xml' })
  return uploadAvatar(userId, blob, 'svg', 'image/svg+xml')
}
