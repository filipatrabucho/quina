import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { GAME_FINISHED } from '../lib/plays.js'
import { shareMessage, whatsappUrl } from '../lib/share.js'
import { track } from '../lib/analytics.js'

// Jogos que já têm a sua própria partilha no fim.
const OWN_SHARE = ['palavras', 'fiada']

// No fim de cada partida: partilhar o resultado e, para quem joga sem conta,
// de vez em quando, um convite para criar conta.
export default function GameEndToast() {
  const [info, setInfo] = useState(null)
  const [copied, setCopied] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    const onEnd = (e) => {
      const d = e.detail || {}
      const askAccount = d.guest && (d.guestPlays === 2 || (d.guestPlays > 2 && d.guestPlays % 5 === 0))
      if (OWN_SHARE.includes(d.game) && !askAccount) return
      setCopied(false)
      setInfo({ ...d, askAccount, share: !OWN_SHARE.includes(d.game), at: Date.now() })
    }
    window.addEventListener(GAME_FINISHED, onEnd)
    return () => window.removeEventListener(GAME_FINISHED, onEnd)
  }, [])

  // Desaparece sozinho (mais devagar quando sugere criar conta).
  useEffect(() => {
    if (!info) return undefined
    const t = setTimeout(() => setInfo(null), info.askAccount ? 20000 : 12000)
    return () => clearTimeout(t)
  }, [info])
  useEffect(() => setInfo(null), [pathname])

  if (!info) return null
  const msg = shareMessage(info)
  const share = async () => {
    track('share', { method: 'botao', content_type: 'resultado', item_id: info.game })
    if (navigator.share) {
      try {
        await navigator.share({ title: msg.title, text: msg.text, url: msg.url })
      } catch {
        // cancelado
      }
      return
    }
    try {
      await navigator.clipboard.writeText(`${msg.text} ${msg.url}`)
      setCopied(true)
    } catch {
      window.prompt('Copia o texto:', `${msg.text} ${msg.url}`)
    }
  }

  return (
    <div className="end-toast" role="status" data-testid="end-toast">
      <button type="button" className="end-toast__close" onClick={() => setInfo(null)} aria-label="Fechar">×</button>
      {info.share && (
        <>
          <strong className="end-toast__title">{info.won ? 'Boa! Desafia os teus amigos' : 'Desafia os teus amigos'}</strong>
          <p className="end-toast__text">{msg.text}</p>
          <div className="end-toast__actions">
            <button type="button" className="btn btn--primary btn--small" onClick={share} data-testid="end-share">
              {copied ? 'Copiado ✓' : 'Partilhar'}
            </button>
            <a
              className="btn btn--outline btn--small end-toast__wa"
              href={whatsappUrl(msg)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('share', { method: 'whatsapp', content_type: 'resultado', item_id: info.game })}
              data-testid="end-whatsapp"
            >
              WhatsApp
            </a>
          </div>
        </>
      )}
      {info.askAccount && (
        <div className="end-toast__account" data-testid="end-account">
          <span>Gostas de jogar? Cria conta grátis para guardar as vitórias, ganhar medalhas, subir no top e jogar online com amigos.</span>
          <Link
            className="btn btn--primary btn--small"
            to={`/conta?modo=criar&voltar=${encodeURIComponent(pathname)}`}
            onClick={() => track('sign_up_prompt', { game_name: info.game })}
          >
            Criar conta
          </Link>
        </div>
      )}
    </div>
  )
}
