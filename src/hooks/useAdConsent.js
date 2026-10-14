import { useEffect, useState } from 'react'

const CONSENT_KEY = 'quina-consentimento-anuncios'
const EVENT = 'quina-consentimento'

function read() {
  try {
    return localStorage.getItem(CONSENT_KEY)
  } catch {
    return null
  }
}

export function useAdConsent() {
  const [consent, setConsentState] = useState(read)

  useEffect(() => {
    const sync = () => setConsentState(read())
    window.addEventListener('storage', sync)
    window.addEventListener(EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(EVENT, sync)
    }
  }, [])

  const setConsent = (value) => {
    localStorage.setItem(CONSENT_KEY, value)
    window.dispatchEvent(new Event(EVENT))
  }

  return {
    consent,
    accept: () => setConsent('aceite'),
    decline: () => setConsent('recusado'),
  }
}
