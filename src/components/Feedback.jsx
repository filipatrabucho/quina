import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { sendFeedback } from '../lib/social.js'
import { track } from '../lib/analytics.js'

export const FEEDBACK_EVENT = 'tg-feedback-open'
export const openFeedback = () => window.dispatchEvent(new Event(FEEDBACK_EVENT))

export const FEEDBACK_KINDS = [
  { key: 'sugestao', label: 'Sugestão' },
  { key: 'jogo', label: 'Ideia de jogo' },
  { key: 'erro', label: 'Encontrei um erro' },
  { key: 'opiniao', label: 'Opinião' },
]

// Janela de feedback (abre com openFeedback() a partir de qualquer sítio).
export default function FeedbackModal() {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('sugestao')
  const [text, setText] = useState('')
  const [state, setState] = useState('edit') // edit | sending | sent
  const [error, setError] = useState('')
  const { user } = useAuth()
  const { pathname, search } = useLocation()
  const hasAccount = user && !user.is_anonymous

  useEffect(() => {
    const onOpen = () => {
      setOpen(true)
      setState('edit')
      setError('')
    }
    window.addEventListener(FEEDBACK_EVENT, onOpen)
    return () => window.removeEventListener(FEEDBACK_EVENT, onOpen)
  }, [])
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  const send = async (e) => {
    e.preventDefault()
    if (text.trim().length < 3) return setError('Escreve um bocadinho mais.')
    setState('sending')
    setError('')
    try {
      await sendFeedback(kind, text, pathname)
      track('feedback_sent', { feedback_kind: kind })
      setText('')
      setState('sent')
    } catch (err) {
      setError(err.message)
      setState('edit')
    }
  }
  const voltar = encodeURIComponent(pathname + search)
  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal feedback-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Dar feedback" data-testid="feedback-modal">
        <button className="modal-close" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
        <h2>Dá-nos o teu feedback</h2>
        {!hasAccount ? (
          <div className="feedback-login" data-testid="feedback-login">
            <p>Cria conta e dá-nos o teu feedback! Lemos todas as opiniões, sugestões e ideias de jogos novos.</p>
            <div className="game-actions">
              <Link className="btn btn--primary btn--small" to={`/conta?modo=criar&voltar=${voltar}`} onClick={() => setOpen(false)}>Criar conta</Link>
              <Link className="btn btn--outline btn--small" to={`/conta?voltar=${voltar}`} onClick={() => setOpen(false)}>Já tenho conta</Link>
            </div>
          </div>
        ) : state === 'sent' ? (
          <div className="feedback-sent" data-testid="feedback-sent">
            <p>Obrigado! 🙌 Recebemos o teu feedback.</p>
            <div className="game-actions">
              <button type="button" className="btn btn--outline btn--small" onClick={() => setState('edit')}>Enviar mais</button>
              <button type="button" className="btn btn--primary btn--small" onClick={() => setOpen(false)}>Fechar</button>
            </div>
          </div>
        ) : (
          <form className="feedback-form" onSubmit={send}>
            <p className="modal-note">O que achas do Tuga Games? Que jogo queres ver aqui? Encontraste algum erro?</p>
            <div className="feedback-kinds" role="radiogroup" aria-label="Tipo">
              {FEEDBACK_KINDS.map((k) => (
                <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} className={`home-cat${kind === k.key ? ' home-cat--active' : ''}`} onClick={() => setKind(k.key)}>
                  {k.label}
                </button>
              ))}
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 2000))} rows={6} placeholder="Escreve aqui…" autoFocus data-testid="feedback-text" />
            <small className="feedback-count">{text.length}/2000</small>
            {error && <p className="duel-error">{error}</p>}
            <button type="submit" className="share-btn" disabled={state === 'sending' || text.trim().length < 3} data-testid="feedback-send">
              {state === 'sending' ? 'A enviar…' : 'Enviar feedback'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
