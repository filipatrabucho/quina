import { useEffect, useRef, useState } from 'react'
import Avatar from '../Avatar.jsx'
import { CHAT_MAX } from '../../lib/rooms/useGameRoom.js'

const hm = (t) => new Date(t).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

// Chat de grupo da sala: toda a gente que está na sala (jogadores e quem está a ver).
// Botão discreto ao lado do jogo, com o nº de mensagens por ler.
export default function RoomChat({ chat, sendChat, players, me }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [seen, setSeen] = useState(chat.length)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const unread = open ? 0 : chat.slice(seen).filter((m) => m.from !== me.id).length

  useEffect(() => {
    if (open) setSeen(chat.length)
  }, [open, chat.length])
  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
    inputRef.current?.focus()
  }, [open, chat.length])

  const who = (id) => players.find((p) => p.id === id) || { id, name: 'Jogador', seed: id }
  const send = (e) => {
    e.preventDefault()
    if (sendChat(text)) setText('')
  }

  return (
    <>
      <button
        type="button"
        className={`room-chat-btn${unread ? ' room-chat-btn--new' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Chat da sala${unread ? ` (${unread} por ler)` : ''}`}
        aria-expanded={open}
        data-testid="room-chat-btn"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 5h16v11H9l-5 4z" />
          <path d="M8 9h8M8 12h5" />
        </svg>
        {unread > 0 && <span className="chat-fab__badge" data-testid="room-chat-unread">{unread}</span>}
      </button>
      {open && (
        <section className="room-chat" aria-label="Chat da sala" data-testid="room-chat">
          <header className="room-chat__head">
            <strong>Chat da sala</strong>
            <small>{players.length} {players.length === 1 ? 'pessoa' : 'pessoas'}</small>
            <button type="button" className="chat-icon-btn" onClick={() => setOpen(false)} aria-label="Fechar o chat da sala">×</button>
          </header>
          <div className="room-chat__list" ref={listRef} aria-live="polite">
            {chat.length === 0 && <p className="room-chat__empty">Ainda ninguém escreveu. Diz olá à malta! 👋</p>}
            {chat.map((m) => {
              const p = who(m.from)
              const mine = m.from === me.id
              return (
                <div key={m.id} className={`room-chat__msg${mine ? ' room-chat__msg--mine' : ''}`}>
                  {!mine && <Avatar src={p.avatar} seed={p.seed || p.id} name={p.name} size={24} />}
                  <div className="room-chat__bubble">
                    {!mine && <b>{p.name}</b>}
                    <span>{m.text}</span>
                    <small>{hm(m.at)}</small>
                  </div>
                </div>
              )
            })}
          </div>
          <form className="room-chat__form" onSubmit={send}>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escreve para a sala…"
              maxLength={CHAT_MAX}
              autoComplete="off"
              data-testid="room-chat-input"
            />
            <button type="submit" className="share-btn" disabled={!text.trim()} data-testid="room-chat-send">Enviar</button>
          </form>
        </section>
      )}
    </>
  )
}
