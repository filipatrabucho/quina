import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { getMyReferrals, refLink, REF_RULES, REF_TIERS } from '../lib/referral.js'
import { whatsappUrl } from '../lib/share.js'
import { track } from '../lib/analytics.js'

const fmtDate = (d) => new Date(d).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })

function statusOf(r) {
  if (r.status === 'valido') return { label: 'Válido ✓', cls: 'ok' }
  if (r.status === 'recusado') return { label: 'Não conta', cls: 'no' }
  if (r.expired) return { label: 'Expirou', cls: 'no' }
  return { label: `A confirmar: ${Math.min(r.plays, REF_RULES.plays)}/${REF_RULES.plays} partidas, ${Math.min(r.days, REF_RULES.days)}/${REF_RULES.days} dias`, cls: 'wait' }
}

function Rules() {
  return (
    <section className="invite-card">
      <h2>Como funciona</h2>
      <ol className="invite-steps">
        <li>Partilha o teu link com amigos (WhatsApp, Discord, onde quiseres).</li>
        <li>O teu amigo cria uma conta nova através do link.</li>
        <li>
          O convite fica <b>válido</b> quando ele jogar <b>{REF_RULES.plays} partidas em {REF_RULES.days} dias diferentes</b>, nos primeiros {REF_RULES.window} dias.
        </li>
      </ol>
      <h3>Prémios</h3>
      <ul className="invite-tiers">
        {REF_TIERS.map((t) => (
          <li key={t.valid}><b>{t.valid}</b> {t.valid === 1 ? 'convite válido' : 'convites válidos'}: {t.title}</li>
        ))}
      </ul>
      <p className="modal-note">
        Contas criadas no mesmo browser de quem convida, ou mais de 10 convites num dia, não contam. Os vales são revistos à mão antes de serem enviados
        (por email, para o endereço da tua conta). O programa pode mudar ou acabar a qualquer momento; os prémios já ganhos mantêm-se.
      </p>
    </section>
  )
}

export default function Convidar() {
  const { user, loading } = useAuth()
  const account = user && !user.is_anonymous
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!account) return
    getMyReferrals().then(setData, (e) => setError(e.message))
  }, [account, user?.id])

  const link = data?.code ? refLink(data.code) : ''
  const msg = { text: 'Bora jogar comigo no Tuga Games? Mini-jogos grátis para jogar com amigos (Sueca, Impostor, Stop e muito mais).', url: link }
  const copy = async () => {
    track('referral_share', { method: 'copiar' })
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('Copia o teu link:', link)
    }
  }
  const share = async () => {
    track('referral_share', { method: 'partilhar' })
    try {
      await navigator.share({ title: 'Tuga Games', text: msg.text, url: link })
    } catch {
      // cancelado
    }
  }

  const valid = data?.valid || 0
  const next = REF_TIERS.find((t) => t.valid > valid) || { valid: (Math.floor(valid / REF_RULES.milestone) + 1) * REF_RULES.milestone, title: `Mais um vale de ${REF_RULES.amount} €` }
  const prev = [...REF_TIERS].reverse().find((t) => t.valid <= valid)?.valid || 0
  const pct = Math.round(((valid - prev) / Math.max(1, next.valid - prev)) * 100)

  return (
    <main className="invite-page">
      <header className="invite-head">
        <h1>🎁 Convida amigos</h1>
        <p>Traz os teus amigos para o Tuga Games e ganha medalhas, itens exclusivos e, a partir de {REF_RULES.milestone} convites válidos, vales de {REF_RULES.amount} €.</p>
      </header>

      {!loading && !account && (
        <section className="invite-card invite-card--cta" data-testid="invite-login">
          <p>Para teres o teu link de convite precisas de uma conta (é grátis).</p>
          <Link className="share-btn" to="/conta?modo=criar&voltar=%2Fconvidar">Criar conta grátis</Link>
          <Link className="link-btn" to="/conta?voltar=%2Fconvidar">Já tenho conta: entrar</Link>
        </section>
      )}

      {account && (
        <>
          {error && <p className="duel-error">{error}</p>}
          <section className="invite-card" data-testid="invite-link">
            <h2>O teu link</h2>
            <div className="invite-link">
              <input readOnly value={link || 'A carregar…'} onFocus={(e) => e.target.select()} aria-label="O teu link de convite" data-testid="invite-url" />
              <button type="button" className="share-btn" onClick={copy} disabled={!link} data-testid="invite-copy">{copied ? 'Copiado ✓' : 'Copiar'}</button>
            </div>
            <div className="invite-share">
              <a className="btn btn--outline" href={link ? whatsappUrl(msg) : undefined} target="_blank" rel="noopener noreferrer" onClick={() => track('referral_share', { method: 'whatsapp' })}>WhatsApp</a>
              {typeof navigator !== 'undefined' && navigator.share && <button type="button" className="btn btn--outline" onClick={share}>Partilhar…</button>}
            </div>
          </section>

          <section className="invite-card" data-testid="invite-progress">
            <h2>O teu progresso</h2>
            <p className="invite-count"><b data-testid="invite-valid">{valid}</b> {valid === 1 ? 'convite válido' : 'convites válidos'}</p>
            <div className="ref-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
            <p className="modal-note">Próximo prémio aos <b>{next.valid}</b>: {next.title}</p>
            {data?.rewards?.length > 0 && (
              <ul className="invite-rewards" data-testid="invite-rewards">
                {data.rewards.map((w) => (
                  <li key={w.milestone}>
                    Vale de {w.amount} € ({w.milestone} convites):{' '}
                    <b className={`invite-st invite-st--${w.status === 'enviado' ? 'ok' : w.status === 'recusado' ? 'no' : 'wait'}`}>
                      {w.status === 'enviado' ? `enviado a ${fmtDate(w.sent_at)}` : w.status === 'recusado' ? 'recusado' : 'a rever pela equipa'}
                    </b>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="invite-card" data-testid="invite-list">
            <h2>Amigos que convidaste</h2>
            {!data ? (
              <p className="rank-empty">A carregar…</p>
            ) : data.list.length === 0 ? (
              <p className="rank-empty">Ainda ninguém criou conta com o teu link. Partilha-o no grupo do Discord ou no WhatsApp!</p>
            ) : (
              <ul className="invite-people">
                {data.list.map((r) => {
                  const st = statusOf(r)
                  return (
                    <li key={r.username}>
                      <Link to={`/u/${r.username}`}>{r.username}</Link>
                      <small>{fmtDate(r.created_at)}</small>
                      <span className={`invite-st invite-st--${st.cls}`}>{st.label}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <Rules />
    </main>
  )
}
