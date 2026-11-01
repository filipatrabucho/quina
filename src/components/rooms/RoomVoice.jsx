import { useState } from 'react'
import Avatar from '../Avatar.jsx'
import { useVoice, VOICE_MAX, hasTurn } from '../../lib/rooms/useVoice.js'

const LINK = { connected: 'ligado', connecting: 'a ligar…', new: 'a ligar…', checking: 'a ligar…', disconnected: 'falhou a ligação', failed: 'não liga (rede)', closed: 'saiu' }

const Mic = ({ off }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
)

// Chat de voz da sala (beta, só testers): entrar, microfone, silenciar e tirar da voz.
export default function RoomVoice({ game, code, me, amHost, hostId }) {
  const [open, setOpen] = useState(false)
  const v = useVoice({ game, code, me, enabled: true })
  const others = v.members.filter((m) => m.id !== me.id)
  const full = !v.joined && v.members.length >= VOICE_MAX

  return (
    <>
      <button
        type="button"
        className={`room-voice-btn${v.joined ? ' room-voice-btn--on' : ''}${v.speaking[me.id] ? ' room-voice-btn--talk' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={v.joined ? 'Voz: estás ligado' : 'Chat de voz'}
        aria-expanded={open}
        data-testid="room-voice-btn"
      >
        <Mic off={v.joined && v.muted} />
      </button>
      {open && (
        <section className="room-chat room-voice" aria-label="Chat de voz" data-testid="room-voice">
          <header className="room-chat__head">
            <strong>Voz</strong>
            <small className="room-voice__beta">beta</small>
            <small>{v.members.length}/{VOICE_MAX}</small>
            <button type="button" className="chat-icon-btn" onClick={() => setOpen(false)} aria-label="Fechar a voz">×</button>
          </header>
          <div className="room-chat__list">
            {!v.joined && (
              <div className="room-voice__intro">
                <p>Fala com quem está nesta sala. Só quem está na sala te ouve e nada é gravado.</p>
                {v.members.length > 0 && <p className="modal-note">Já {v.members.length === 1 ? 'está 1 pessoa' : `estão ${v.members.length} pessoas`} na voz.</p>}
                <button type="button" className="share-btn" onClick={v.join} disabled={full} data-testid="voice-join">{full ? 'A voz está cheia' : 'Entrar na voz'}</button>
                {!hasTurn() && <p className="modal-note">Em teste: em algumas redes (dados móveis, empresas) a ligação ainda pode não dar.</p>}
              </div>
            )}
            {v.joined && (
              <ul className="room-voice__list" data-testid="voice-members">
                <li className={v.speaking[me.id] ? 'talking' : ''}>
                  <Avatar src={me.avatar} seed={me.seed || me.id} name={me.name} size={30} />
                  <span>{me.name} (tu){v.muted ? ' · microfone desligado' : ''}</span>
                </li>
                {others.map((m) => (
                  <li key={m.id} className={v.speaking[m.id] ? 'talking' : ''} data-voice-member={m.id}>
                    <Avatar src={m.avatar} seed={m.seed || m.id} name={m.name} size={30} />
                    <span>
                      {m.name}{m.id === hostId ? ' 👑' : ''}
                      <small>{m.muted ? 'microfone desligado' : LINK[v.links[m.id]] || 'a ligar…'}</small>
                    </span>
                    <button type="button" className="mode-btn mode-btn--small" onClick={() => v.toggleSilence(m.id)} aria-pressed={!!v.silenced[m.id]} title="Deixar de ouvir esta pessoa (só para ti)">
                      {v.silenced[m.id] ? '🔇' : '🔊'}
                    </button>
                    {amHost && <button type="button" className="mode-btn mode-btn--small" onClick={() => v.kick(m.id)} title="Tirar da voz">Tirar</button>}
                  </li>
                ))}
                {others.length === 0 && <li className="room-voice__alone">Ainda estás sozinho na voz. Avisa os outros no chat!</li>}
              </ul>
            )}
            {v.error && <p className="duel-error">{v.error}</p>}
          </div>
          {v.joined && (
            <div className="room-voice__bar">
              <button type="button" className={`mode-btn${v.muted ? ' mode-btn--active' : ''}`} onClick={v.toggleMute} data-testid="voice-mute">
                <Mic off={v.muted} /> {v.muted ? 'Ligar microfone' : 'Desligar microfone'}
              </button>
              <button type="button" className="share-btn" onClick={v.leave} data-testid="voice-leave">Sair da voz</button>
            </div>
          )}
        </section>
      )}
    </>
  )
}
