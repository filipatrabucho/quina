import { supabase } from './supabaseClient.js'
import { visitorId } from './plays.js'
import { track } from './analytics.js'

// Programa "Convida amigos": quem cria conta pelo link de um amigo fica
// ligado a ele. As regras (e a validação) estão em supabase/schema-social.sql.
export const REF_RULES = { plays: 5, days: 2, window: 14, milestone: 25, amount: 5 }
// Prémios sem custo (por convites válidos).
export const REF_TIERS = [
  { valid: 1, title: 'Medalha "Recrutador" e chapéu exclusivo Auréola no Impostor' },
  { valid: 3, title: 'Cor exclusiva Dourado no Impostor' },
  { valid: 10, title: 'Título "Embaixador": medalha e ⭐ ao lado do nome no ranking' },
  { valid: 25, title: `Vale de ${REF_RULES.amount} € (e outro a cada 25 convites válidos)` },
]

const KEY = 'tg-convite'
const KEEP_MS = 30 * 24 * 3600 * 1000

export const refLink = (code) => `${typeof window !== 'undefined' ? window.location.origin : 'https://tugagames.pt'}/?ref=${encodeURIComponent(code)}`

// Guarda o código do link (?ref=...) durante 30 dias.
export function captureRef() {
  try {
    const code = new URLSearchParams(window.location.search).get('ref')
    if (code && /^[A-Za-z0-9_.]{3,20}$/.test(code)) {
      localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }))
      track('referral_click', { code })
      // Conta a visita para o Backoffice (uma por browser e por link).
      supabase.rpc('log_referral_visit', { p_code: code, p_visitor: visitorId() }).then(() => {}, () => {})
    }
  } catch {
    // sem localStorage não há convite
  }
}

export function pendingRef() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (r && Date.now() - r.at < KEEP_MS) return r.code
  } catch {
    // ignora
  }
  return null
}

const forget = () => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignora
  }
}

// Depois de criar conta: liga a conta nova a quem a convidou (uma vez).
let claiming = false
export async function claimPendingRef(user) {
  const code = pendingRef()
  if (!code || claiming || !user || user.is_anonymous) return null
  if (user.user_metadata?.username && user.user_metadata.username.toLowerCase() === code.toLowerCase()) return forget()
  claiming = true
  try {
    const { data, error } = await supabase.rpc('claim_referral', { p_code: code, p_visitor: visitorId() })
    if (error) return null // tenta outra vez noutra altura (ex.: sem rede)
    forget()
    if (data === 'pendente') track('referral_signup', { code })
    return data
  } finally {
    claiming = false
  }
}

export async function getMyReferrals() {
  const { data, error } = await supabase.rpc('my_referrals')
  if (error) throw new Error(error.message)
  return data
}

export async function adminReferrals() {
  const { data, error } = await supabase.rpc('admin_referrals')
  if (error) throw new Error(error.message)
  return data
}

export async function adminReferrerDetail(userId) {
  const { data, error } = await supabase.rpc('admin_referrer_detail', { p_user: userId })
  if (error) throw new Error(error.message)
  return data
}

export async function adminSetRewardStatus(id, status, note = null) {
  const { error } = await supabase.rpc('admin_set_reward_status', { p_id: id, p_status: status, p_note: note })
  if (error) throw new Error(error.message)
}
