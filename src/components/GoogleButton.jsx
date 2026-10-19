import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { supabase } from '../lib/supabaseClient.js'

// Só aparece depois de o login Google estar ligado no Supabase
// (variável VITE_GOOGLE_LOGIN=on no Netlify).
export const googleLoginOn = import.meta.env.VITE_GOOGLE_LOGIN === 'on'
// Com o Client ID usa-se o botão oficial da Google no próprio site, e a
// janela de login diz "tugagames.pt" (e não o domínio do Supabase).
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()

let gisPromise = null
function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error('gsi')))
      s.onerror = () => reject(new Error('gsi'))
      document.head.appendChild(s)
    }).catch((e) => {
      gisPromise = null
      throw e
    })
  }
  return gisPromise
}

// A Google recebe o nonce cifrado (SHA-256) e o Supabase confirma-o com o original.
async function makeNonce() {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hashed = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
  return { raw, hashed }
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

// Botão oficial da Google (Google Identity Services). Se o script não
// carregar (bloqueadores, rede), volta ao login por redirecionamento.
function OfficialGoogleButton({ returnTo, label, onFallback }) {
  const ref = useRef(null)
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [google, nonce] = await Promise.all([loadGoogleIdentity(), makeNonce()])
        if (cancelled || !ref.current) return
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hashed,
          ux_mode: 'popup',
          use_fedcm_for_button: true,
          callback: async ({ credential }) => {
            setError('')
            const { error: err } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce: nonce.raw })
            if (err) {
              setError('Não foi possível entrar com o Google. Tenta outra vez.')
              return
            }
            if (returnTo && returnTo !== window.location.pathname + window.location.search) navigate(returnTo)
          },
        })
        const width = Math.round(Math.min(400, Math.max(220, ref.current.offsetWidth || 300)))
        google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          logo_alignment: 'center',
          text: /criar/i.test(label) ? 'signup_with' : /entrar/i.test(label) ? 'signin_with' : 'continue_with',
          locale: 'pt-PT',
          width,
        })
      } catch {
        if (!cancelled) onFallback()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [returnTo, label, navigate, onFallback])

  return (
    <div className="google-official" data-testid="google-login">
      <div ref={ref} className="google-official__slot" />
      {error && <p className="duel-error">{error}</p>}
    </div>
  )
}

// Entrar (ou criar conta) com a conta Google / Gmail.
export default function GoogleButton({ returnTo, label = 'Continuar com Google' }) {
  const { signInWithGoogle } = useAuth()
  const [fallback, setFallback] = useState(false)
  const [onFallback] = useState(() => () => setFallback(true))
  if (!googleLoginOn) return null
  if (GOOGLE_CLIENT_ID && !fallback) return <OfficialGoogleButton returnTo={returnTo} label={label} onFallback={onFallback} />
  return (
    <button type="button" className="btn-google" onClick={() => signInWithGoogle(returnTo)} data-testid="google-login">
      <GoogleLogo />
      {label}
    </button>
  )
}
