export default function ConsentBanner({ onAccept, onDecline }) {
  return (
    <div className="consent-banner">
      <p>
        Usamos anúncios para ajudar a manter o Quina gratuito. Aceitas cookies de anúncios
        personalizados?{' '}
        <a href="/privacidade.html" target="_blank" rel="noopener noreferrer">
          Saber mais
        </a>
      </p>
      <div className="consent-banner__actions">
        <button className="consent-btn consent-btn--decline" onClick={onDecline}>
          Recusar
        </button>
        <button className="consent-btn consent-btn--accept" onClick={onAccept}>
          Aceitar
        </button>
      </div>
    </div>
  )
}