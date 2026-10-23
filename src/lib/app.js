import { supabase, supabaseConfigured } from './supabaseClient.js'
import { track } from './analytics.js'

// Instalar o site como app e lembrete diário (notificações push).
// Chave pública VAPID (a privada está só no Netlify, na variável VAPID_PRIVATE_KEY).
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BCsAq-_TViDa5iZAYtr_wQh7RJu3D1AHR819A9yMJYCpMCrFAuWyr8TIhLgUxtc10vTOq7QrR9N6AnZ8-XEI-zg'
const INSTALL_EVENT = 'tg-install-ready'

const inIframe = () => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || inIframe() || !import.meta.env.PROD) return
  // Guarda o pedido de instalação do Chrome para o botão "Instalar".
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    window.__tgInstall = e
    window.dispatchEvent(new Event(INSTALL_EVENT))
  })
  window.addEventListener('appinstalled', () => {
    window.__tgInstall = null
    track('app_installed')
  })
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

export const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
export const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
export const canPromptInstall = () => typeof window !== 'undefined' && !!window.__tgInstall
export const onInstallReady = (fn) => {
  window.addEventListener(INSTALL_EVENT, fn)
  return () => window.removeEventListener(INSTALL_EVENT, fn)
}

export async function promptInstall() {
  const e = window.__tgInstall
  if (!e) return false
  e.prompt()
  const r = await e.userChoice.catch(() => null)
  track('install_prompt', { result: r?.outcome || 'desconhecido' })
  window.__tgInstall = null
  return r?.outcome === 'accepted'
}

// ---- Lembrete diário ----
export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && supabaseConfigured && !inIframe()

function keyBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// Sem resposta do serviço de notificações do browser: desiste com uma mensagem clara.
const withTimeout = (promise, ms = 12000) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('O browser não respondeu. Tenta outra vez daqui a pouco.')), ms))])

async function registration() {
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'))
  await navigator.serviceWorker.ready
  return reg
}

export async function pushEnabled() {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.getRegistration()
  return !!(await reg?.pushManager.getSubscription())
}

export async function enablePush(visitor) {
  if (!pushSupported()) throw new Error('Este browser não deixa receber lembretes.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Não deste autorização para notificações.')
  let sub
  try {
    const reg = await withTimeout(registration())
    sub = (await reg.pushManager.getSubscription()) || (await withTimeout(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) })))
  } catch (e) {
    // As mensagens do browser vêm em inglês (ex.: janela anónima, notificações bloqueadas).
    throw new Error(/browser não respondeu/.test(e.message) ? e.message : 'Este browser não deixou ligar o lembrete (numa janela anónima não funciona).')
  }
  const j = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_visitor: visitor })
  if (error) throw new Error(error.message)
  track('reminder_on')
  return true
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
  track('reminder_off')
}
