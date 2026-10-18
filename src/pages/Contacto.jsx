import { useState } from 'react'

export const CONTACT_EMAIL = 'tuga.games.staff@gmail.com'

const TOPICS = [
  ['Sugestão de jogo', 'Tenho uma ideia para um jogo novo'],
  ['Erro no site', 'Encontrei um erro'],
  ['Conta e dados', 'Pedido sobre a minha conta ou os meus dados'],
  ['Parcerias e publicidade', 'Proposta de parceria'],
  ['Outro assunto', 'Contacto pelo site'],
]

export default function Contacto() {
  const [topic, setTopic] = useState(TOPICS[0][0])
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const subject = `[Tuga Games] ${TOPICS.find((t) => t[0] === topic)[1]}`
  const body = `${message}\n\n${name ? `Nome: ${name}\n` : ''}Página: https://tugagames.pt/contacto`
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Copia o email:', CONTACT_EMAIL)
    }
  }

  return (
    <main className="info-page">
      <span className="eyebrow">Tuga Games PT</span>
      <h1>Contacto</h1>
      <p className="info-page__lead">
        Tens uma sugestão, encontraste um erro ou queres falar connosco sobre parcerias? Escreve-nos para{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} data-testid="contact-email">{CONTACT_EMAIL}</a>. Respondemos normalmente em poucos dias.
      </p>
      <button className="btn btn--outline btn--small" onClick={copy}>{copied ? 'Copiado!' : 'Copiar email'}</button>

      <form
        className="account-card account-form info-form"
        onSubmit={(e) => {
          e.preventDefault()
          window.location.href = mailto
        }}
      >
        <h2>Enviar mensagem</h2>
        <label className="account-field">
          <span>Assunto</span>
          <select value={topic} onChange={(e) => setTopic(e.target.value)}>
            {TOPICS.map(([t]) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="account-field">
          <span>O teu nome (opcional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </label>
        <label className="account-field">
          <span>Mensagem</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000} required />
        </label>
        <button className="btn btn--primary" type="submit" disabled={!message.trim()} data-testid="contact-send">Abrir no email</button>
        <p className="modal-note">O botão abre a tua aplicação de email com a mensagem já escrita.</p>
      </form>

      <h2>Pedidos sobre a tua conta</h2>
      <p>
        Para apagares a tua conta ou pedires uma cópia dos teus dados, envia o pedido a partir do email associado à conta e indica o
        teu username. Mais detalhes na <a href="/privacidade.html">política de privacidade</a>.
      </p>
    </main>
  )
}
