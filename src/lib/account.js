import { supabase } from './supabaseClient.js'
import { randomSeed, uploadGeneratedAvatar, uploadAvatar, resizeImageFile } from './avatar.js'

export const USERNAME_RE = /^[A-Za-z0-9_.]{3,20}$/

function translateAuthError(error) {
  const msg = error?.message || String(error)
  if (/already registered|already been registered|already exists/i.test(msg)) return 'Já existe uma conta com esse email.'
  if (/invalid login credentials/i.test(msg)) return 'Email ou password errados.'
  if (/email not confirmed/i.test(msg)) return 'Ainda não confirmaste o email. Vê a tua caixa de correio.'
  if (/password should be at least/i.test(msg)) return 'A password tem de ter pelo menos 6 carateres.'
  if (/unable to validate email|invalid email|email address .* is invalid/i.test(msg)) return 'Esse email não é válido.'
  if (/database error saving new user/i.test(msg)) return 'Esse username já está a ser usado.'
  if (/rate limit/i.test(msg)) return 'Demasiadas tentativas. Espera um bocadinho e tenta outra vez.'
  if (/profiles_username_unico|duplicate key/i.test(msg)) return 'Esse username já está a ser usado.'
  return msg
}

function fail(error) {
  throw new Error(translateAuthError(error))
}

// Devolve true/false, ou null se não deu para confirmar (ex.: o SQL das
// contas ainda não foi corrido), nesse caso deixamos seguir.
export async function isUsernameAvailable(username) {
  const { data, error } = await supabase.rpc('username_available', { p_username: username })
  if (error) return null
  return data
}

export async function signUpWithEmail({ email, password, username }) {
  const name = username.trim()
  if (!USERNAME_RE.test(name)) {
    throw new Error('O username tem de ter 3 a 20 carateres: letras, números, "_" ou ".".')
  }
  if (password.length < 6) throw new Error('A password tem de ter pelo menos 6 carateres.')
  if ((await isUsernameAvailable(name)) === false) throw new Error('Esse username já está a ser usado.')

  // Cada conta nova recebe logo um boneco gerado (guardamos a seed; o
  // ficheiro vai para o Storage assim que houver sessão).
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { username: name, full_name: name, avatar_seed: randomSeed() },
      emailRedirectTo: `${window.location.origin}/conta`,
    },
  })
  if (error) fail(error)
  // Com "Confirm email" ligado, o Supabase não devolve sessão e, se o email
  // já existir, devolve um utilizador sem identidades.
  if (data.user && data.user.identities?.length === 0) throw new Error('Já existe uma conta com esse email.')
  if (data.session) await ensureStoredAvatar(data.session.user)
  return { needsConfirmation: !data.session }
}

export async function signInWithEmail({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) fail(error)
  await ensureStoredAvatar(data.user)
  return data.user
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/conta`,
  })
  if (error) fail(error)
}

async function saveAvatarUrl(user, avatarUrl, extra = {}) {
  const { data, error } = await supabase.auth.updateUser({ data: { avatar_url: avatarUrl, ...extra } })
  if (error) fail(error)
  // O perfil público pode ainda não existir (SQL por correr); não é grave.
  await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id)
  return data.user
}

// Contas com email que ainda não têm o boneco no Storage: gera e carrega.
// Se o Storage falhar, o boneco continua a aparecer (é gerado a partir da
// seed), só não fica com URL partilhável.
const ensuring = new Set()
export async function ensureStoredAvatar(user) {
  if (!user || user.is_anonymous || user.user_metadata?.avatar_url) return user
  if (!user.user_metadata?.username || ensuring.has(user.id)) return user
  ensuring.add(user.id)
  try {
    const seed = user.user_metadata.avatar_seed || randomSeed()
    const url = await uploadGeneratedAvatar(user.id, seed)
    return await saveAvatarUrl(user, url, { avatar_seed: seed })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Não foi possível guardar o avatar gerado:', e)
    return user
  } finally {
    ensuring.delete(user.id)
  }
}

export async function uploadAvatarFile(user, file) {
  const blob = await resizeImageFile(file)
  const url = await uploadAvatar(user.id, blob, 'webp', 'image/webp')
  return saveAvatarUrl(user, url)
}

export async function regenerateAvatar(user) {
  const seed = randomSeed()
  const url = await uploadGeneratedAvatar(user.id, seed)
  return saveAvatarUrl(user, url, { avatar_seed: seed })
}

export async function changeUsername(user, username) {
  const name = username.trim()
  if (!USERNAME_RE.test(name)) {
    throw new Error('O username tem de ter 3 a 20 carateres: letras, números, "_" ou ".".')
  }
  const { error: profileError } = await supabase.from('profiles').update({ username: name }).eq('id', user.id)
  if (profileError) fail(profileError)
  const { data, error } = await supabase.auth.updateUser({ data: { username: name, full_name: name } })
  if (error) fail(error)
  return data.user
}
