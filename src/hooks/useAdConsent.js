import { useEffect, useState } from 'react'

const CONSENT_KEY = 'quina-consentimento-anuncios'

export function useAdConsent() {
  const [consent, setConsentState] = useState(() => localStorage.getItem(CONSENT_KEY))

  useEffect(() => {
    function onStorage(e) {
      if (e.key === CONSENT_KEY) setConsentState(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setConsent = (value) => {
    localStorage.setItem(CONSENT_KEY, value)
    setConsentState(value)
  }

  return {
    consent,
    accept: () => setConsent('aceite'),
    decline: () => setConsent('recusado'),
  }
}