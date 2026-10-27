import { supabase } from '../../lib/supabaseClient.js'
import { COLORS, HATS } from './impostorLogic.js'

// Cor e chapéu escolhidos (só com conta). Ficam na conta e, como reserva, no browser.
const KEY = 'tg-impostor-look'
export const hasAccount = (user) => !!user && !user.is_anonymous

function clean(look) {
  if (!look || typeof look !== 'object') return null
  const color = Number.isInteger(look.color) && look.color >= 0 && look.color < COLORS.length ? look.color : null
  const hat = HATS.includes(look.hat) ? look.hat : null
  return { color, hat }
}

export function loadLook(user) {
  if (!hasAccount(user)) return null
  const fromAccount = clean(user.user_metadata?.impostor_look)
  if (fromAccount) return fromAccount
  try {
    return clean(JSON.parse(localStorage.getItem(KEY)))
  } catch {
    return null
  }
}

export async function saveLook(look) {
  const value = clean(look)
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // sem localStorage fica só na conta
  }
  const { error } = await supabase.auth.updateUser({ data: { impostor_look: value } })
  if (error) throw error
}
