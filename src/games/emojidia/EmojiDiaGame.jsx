import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import GameIcon from '../../components/GameIcon.jsx'
import { recordResultOnce } from '../../lib/social.js'
import { dailyPlayers } from '../../lib/plays.js'
import { whatsappUrl } from '../../lib/share.js'
import { track } from '../../lib/analytics.js'
import { ReminderToggle, InstallButton } from '../../components/AppPromo.jsx'
import { CATEGORIES, PUZZLES } from '../emojis/puzzles.js'
import { checkGuess, hintFor } from '../emojis/emojisLogic.js'
import { PER_DAY, MAX_TRIES, STATE_KEY, DAYS_KEY, load, lisbonDay, dayNumber, puzzlesOfDay, squares, solvedCount, shareText, msToNextDay, streakOf, SQUARE } from './emojiDia.js'

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // sem localStorage o desafio funciona na mesma, só não fica guardado
  }
}

function fmtCountdown(ms) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${String(m).padStart(2, '0')}min`
}

function useCountdown() {
  const [ms, setMs] = useState(() => msToNextDay())
  useEffect(() => {
    const t = setInterval(() => setMs(msToNextDay()), 30000)
    return () => clearInterval(t)
  }, [])
  return ms
}

function Done({ n, results, players }) {
  const [copied, setCopied] = useState(false)
  const left = useCountdown()
  const days = load(DAYS_KEY, [])
  const streak = streakOf(days)
  const msg = shareText(n, results)
  const share = async () => {
    track('share', { method: 'botao', content_type: 'emoji_do_dia', item_id: String(n) })
    if (navigator.share) {
      try {
        await navigator.share({ title: `Emoji do Dia #${n}`, text: msg.text, url: msg.url })
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
    <div className="ed-done" data-testid="ed-done">
      <p className="ed-done__squares" aria-label={`${solvedCount(results)} de ${PER_DAY}`}>{squares(results)}</p>
      <h3>{solvedCount(results) === PER_DAY ? 'Perfeito! ' : ''}{solvedCount(results)}/{PER_DAY} enigmas</h3>
      <div className="ed-stats">
        <span><b>{streak}</b> {streak === 1 ? 'dia seguido' : 'dias seguidos'} 🔥</span>
        <span><b>{days.length}</b> {days.length === 1 ? 'desafio feito' : 'desafios feitos'}</span>
        {players > 0 && <span><b>{players}</b> {players === 1 ? 'pessoa jogou' : 'pessoas jogaram'} hoje</span>}
      </div>
      <div className="game-actions">
        <button type="button" className="share-btn" onClick={share} data-testid="ed-share">{copied ? 'Copiado ✓' : 'Partilhar resultado'}</button>
        <a
          className="btn btn--outline end-toast__wa"
          href={whatsappUrl(msg)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('share', { method: 'whatsapp', content_type: 'emoji_do_dia', item_id: String(n) })}
          data-testid="ed-whatsapp"
        >
          WhatsApp
        </a>
      </div>
      <p className="modal-note">Novo desafio daqui a <b data-testid="ed-next">{fmtCountdown(left)}</b>.</p>
      <div className="ed-app">
        <ReminderToggle />
        <InstallButton />
      </div>
      <p className="modal-note">Enquanto esperas:</p>
      <div className="ed-more">
        <Link to="/emoji-battle" className="ed-more__link"><GameIcon game="emojis" size={28} /> Emoji Battle</Link>
        <Link to="/palavras" className="ed-more__link"><GameIcon game="palavras" size={28} /> Palavras do dia</Link>
        <Link to="/sueca?modo=bot&jogar=1" className="ed-more__link"><GameIcon game="sueca" size={28} /> Sueca</Link>
      </div>
    </div>
  )
}

export default function EmojiDiaGame() {
  const day = lisbonDay()
  const n = dayNumber(day)
  const ids = puzzlesOfDay(n)
  // { i: enigma atual, tries: tentativas no atual, results: [1|2|3|0], last: 'quase'|'errado'|null }
  const [st, setSt] = useState(() => load(STATE_KEY(day), { i: 0, tries: 0, results: [], last: null }))
  const [text, setText] = useState('')
  const [flash, setFlash] = useState(null) // resposta certa/falhada do enigma anterior
  const [players, setPlayers] = useState(null)
  const inputRef = useRef(null)
  const done = st.results.length >= PER_DAY

  useEffect(() => save(STATE_KEY(day), st), [st, day])
  useEffect(() => {
    dailyPlayers('emojidia').then(setPlayers)
  }, [done])
  useEffect(() => {
    if (!done) return
    const days = load(DAYS_KEY, [])
    if (!days.includes(day)) save(DAYS_KEY, [...days, day].slice(-400))
    recordResultOnce(`emojidia-${day}`, 'emojidia', solvedCount(st.results) >= 3, String(solvedCount(st.results)))
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!flash) return undefined
    const t = setTimeout(() => setFlash(null), 2600)
    return () => clearTimeout(t)
  }, [flash])

  const finish = (result) => {
    const p = PUZZLES[ids[st.i]]
    setFlash({ ok: result > 0, answer: p.a[0], square: SQUARE[result] })
    setSt((s) => ({ i: s.i + 1, tries: 0, results: [...s.results, result], last: null }))
    setText('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const submit = (e) => {
    e.preventDefault()
    if (!text.trim() || done) return
    const r = checkGuess(text, PUZZLES[ids[st.i]])
    const tries = st.tries + 1
    if (r === 'certo') return finish(tries)
    if (tries >= MAX_TRIES) return finish(0)
    setSt((s) => ({ ...s, tries, last: r }))
    setText('')
  }

  const puzzle = !done ? PUZZLES[ids[st.i]] : null
  return (
    <>
      <header className="header header--game">
        <span className="icon-btn icon-btn--ghost" aria-hidden="true" />
        <h2 className="game-title"><GameIcon game="emojidia" size={30} />Emoji do Dia <span className="ed-num">#{n}</span></h2>
        <span className="icon-btn icon-btn--ghost" aria-hidden="true" />
      </header>
      <main className="game-area">
        <div className="game-panel ed">
          {!done && <div className="ed-progress" aria-label="Progresso">
            {Array.from({ length: PER_DAY }, (_, k) => (
              <span key={k} className={`ed-dot${k === st.i ? ' ed-dot--now' : ''}`}>{st.results[k] != null ? SQUARE[st.results[k]] : k + 1}</span>
            ))}
          </div>}
          {flash && (
            <p className={`ed-flash${flash.ok ? ' ed-flash--ok' : ''}`} data-testid="ed-flash">
              {flash.square} {flash.ok ? 'Certo!' : 'Era'} <b>{flash.answer}</b>
            </p>
          )}
          {done ? (
            <Done n={n} results={st.results} players={players} />
          ) : (
            <>
              <div className="emoji-puzzle">
                <span className="emoji-puzzle__cat">{CATEGORIES[puzzle.c]}</span>
                <div className="emoji-puzzle__emojis" data-testid="ed-emojis">{puzzle.e}</div>
                {st.tries >= 2 ? (
                  <p className="emoji-puzzle__hint" data-testid="ed-hint">{hintFor(puzzle.a[0])}</p>
                ) : (
                  <p className="emoji-puzzle__hint emoji-puzzle__hint--off">Tens {MAX_TRIES - st.tries} {MAX_TRIES - st.tries === 1 ? 'tentativa' : 'tentativas'}. A pista aparece à 3.ª.</p>
                )}
              </div>
              <form className="emoji-guess" onSubmit={submit}>
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Nome do filme, série ou jogo"
                  autoComplete="off"
                  autoFocus
                  data-testid="ed-input"
                />
                <button className="share-btn" type="submit" disabled={!text.trim()} data-testid="ed-send">Enviar</button>
                {st.last && <p className={`emoji-feedback${st.last === 'quase' ? ' emoji-feedback--close' : ''}`} data-testid="ed-feedback">{st.last === 'quase' ? 'Quase! Estás perto.' : 'Não é isso.'}</p>}
              </form>
              <button type="button" className="link-btn" onClick={() => finish(0)} data-testid="ed-skip">Não sei, passar</button>
              <p className="modal-note">
                Os mesmos 5 enigmas para toda a gente, todos os dias. {players > 0 ? `${players} ${players === 1 ? 'pessoa já jogou' : 'pessoas já jogaram'} hoje.` : 'Sê dos primeiros hoje!'}
              </p>
            </>
          )}
        </div>
      </main>
    </>
  )
}
