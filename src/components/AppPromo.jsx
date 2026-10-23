import { useEffect, useState } from 'react'
import { visitorId } from '../lib/plays.js'
import { canPromptInstall, onInstallReady, promptInstall, isIOS, isStandalone, pushSupported, pushEnabled, enablePush, disablePush } from '../lib/app.js'

const HIDE_KEY = 'tg-app-promo-fechado'

// Lembrete diário (notificação) — ligar/desligar.
export function ReminderToggle({ compact = false }) {
  const [state, setState] = useState('loading') // loading | off | on | busy | unsupported
  const [error, setError] = useState('')
  useEffect(() => {
    if (!pushSupported()) return setState('unsupported')
    pushEnabled().then((on) => setState(on ? 'on' : 'off'), () => setState('off'))
  }, [])
  if (state === 'unsupported' || state === 'loading') return null
  const toggle = async () => {
    setError('')
    const was = state
    setState('busy')
    try {
      if (was === 'on') {
        await disablePush()
        setState('off')
      } else {
        await enablePush(visitorId())
        setState('on')
      }
    } catch (e) {
      setError(e.message || 'Não foi possível ligar o lembrete.')
      setState(was)
    }
  }
  return (
    <span className={`reminder${compact ? ' reminder--compact' : ''}`}>
      <button type="button" className={`btn btn--small ${state === 'on' ? 'btn--outline' : 'btn--primary'}`} onClick={toggle} disabled={state === 'busy'} data-testid="reminder-toggle">
        {state === 'on' ? '🔔 Lembrete diário ligado' : state === 'busy' ? 'A tratar…' : '🔔 Lembrar-me todos os dias'}
      </button>
      {error && <small className="reminder__err" data-testid="reminder-error">{error}</small>}
    </span>
  )
}

// Instalar o site como app (Android/Chrome: botão; iPhone: instruções).
export function InstallButton() {
  const [ready, setReady] = useState(false)
  const [ios, setIos] = useState(false)
  const [help, setHelp] = useState(false)
  useEffect(() => {
    if (isStandalone()) return undefined
    setReady(canPromptInstall())
    setIos(isIOS())
    return onInstallReady(() => setReady(true))
  }, [])
  if (!ready && !ios) return null
  return (
    <span className="install">
      <button type="button" className="btn btn--outline btn--small" onClick={() => (ready ? promptInstall().then(() => setReady(false)) : setHelp((h) => !h))} data-testid="install-app">
        📲 Instalar no telemóvel
      </button>
      {help && <small className="install__help">No Safari, toca em <b>Partilhar</b> (o quadrado com a seta) e depois em <b>Adicionar ao ecrã principal</b>.</small>}
    </span>
  )
}

// Cartão na página inicial: instalar + lembrete (pode ser fechado).
export default function AppPromo() {
  const [show, setShow] = useState(false)
  const [can, setCan] = useState(false)
  useEffect(() => {
    let hidden = false
    try {
      hidden = localStorage.getItem(HIDE_KEY) === '1'
    } catch {
      hidden = false
    }
    const update = () => setCan(!isStandalone() && (canPromptInstall() || isIOS()) || pushSupported())
    update()
    setShow(!hidden)
    return onInstallReady(update)
  }, [])
  if (!show || !can) return null
  return (
    <section className="app-promo" data-testid="app-promo">
      <div className="app-promo__text">
        <b>Não percas o Emoji do Dia</b>
        <small>Recebe um lembrete por dia e tem o Tuga Games no telemóvel, como uma app.</small>
      </div>
      <div className="app-promo__actions">
        <ReminderToggle compact />
        <InstallButton />
      </div>
      <button
        type="button"
        className="app-promo__close"
        aria-label="Fechar"
        onClick={() => {
          setShow(false)
          try {
            localStorage.setItem(HIDE_KEY, '1')
          } catch {
            // ignora
          }
        }}
      >
        ×
      </button>
    </section>
  )
}
