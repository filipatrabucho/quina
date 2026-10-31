import { useCallback, useEffect, useRef, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import { recordResultOnce } from '../../lib/social.js'
import DrawCanvas, { Tools } from './DrawCanvas.jsx'
import { WORDS } from './words.js'
import { ROUND_OPTIONS, DRAW_OPTIONS, mask, desenhoOnline } from './desenhoLogic.js'

const LEVEL = { facil: 'fácil', medio: 'média', dificil: 'difícil' }
const secs = (ms) => Math.max(0, Math.ceil(ms / 1000))

function useNow(every = 250) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(t)
  }, [every])
  return now
}

// Ferramentas de quem desenha (cor e grossura ficam guardadas entre vezes).
function useBrush() {
  const [color, setColor] = useState('#14141C')
  const [size, setSize] = useState(10)
  return { color, setColor, size, setSize }
}

// ---------- Online ----------
function Chat({ game, meId, name, onSend }) {
  const [text, setText] = useState('')
  const ref = useRef(null)
  const iGuessed = game.guessed?.[meId] != null
  const drawing = game.phase === 'draw'
  const visible = game.chat.filter((m) => {
    if (m.kind === 'close') return m.by === meId
    if (m.onlyGuessed) return m.by === meId || meId === game.drawer || iGuessed
    return true
  })
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [visible.length])
  const canGuess = drawing && meId !== game.drawer && !iGuessed
  const send = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text)
    setText('')
  }
  return (
    <div className="dw-chat">
      <div className="dw-chat__list" ref={ref} data-testid="dw-chat" aria-live="polite">
        {visible.map((m, i) => (
          <p key={i} className={`dw-msg dw-msg--${m.kind}${m.by === meId ? ' dw-msg--me' : ''}`}>
            {m.kind === 'system' && m.text}
            {m.kind === 'correct' && <><b>{name(m.by)}</b> acertou! (+{m.pts})</>}
            {m.kind === 'close' && <>«{m.text}» está quase!</>}
            {(m.kind === 'guess' || m.kind === 'talk') && <><b>{name(m.by)}:</b> {m.text}</>}
          </p>
        ))}
      </div>
      <form className="dw-chat__form" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={canGuess ? 'Escreve o teu palpite…' : meId === game.drawer && drawing ? 'Estás a desenhar (podes conversar)' : iGuessed ? 'Já acertaste! Conversa com quem acertou' : 'Escreve uma mensagem'}
          maxLength={40}
          autoComplete="off"
          data-testid="dw-guess"
        />
        <button type="submit" className="share-btn" disabled={!text.trim()} data-testid="dw-send">Enviar</button>
      </form>
    </div>
  )
}

function Players({ game, meId, people, name }) {
  const ranked = [...game.order].sort((a, b) => game.scores[b] - game.scores[a])
  return (
    <ol className="dw-players" data-testid="dw-players">
      {ranked.map((id) => {
        const who = people(id)
        return (
          <li key={id} className={`${id === game.drawer && game.phase !== 'over' ? 'dw-p--drawer' : ''}${game.guessed?.[id] != null ? ' dw-p--ok' : ''}`}>
            <Avatar src={who?.avatar} seed={who?.seed || id} name={who?.name} size={26} />
            <span className="dw-p__name">{name(id)}{id === game.drawer && game.phase !== 'over' ? ' ✏️' : ''}{game.guessed?.[id] != null ? ' ✓' : ''}</span>
            <b>{game.scores[id]}</b>
          </li>
        )
      })}
    </ol>
  )
}

function OnlineBoard({ state, game, me, dispatch, serverNow }) {
  const people = useCallback((id) => state.players.find((p) => p.id === id), [state.players])
  const meId = game.order.includes(me.id) ? me.id : null
  const name = (id) => (id === meId ? 'Tu' : people(id)?.name || 'Jogador')
  const t = useNow(250)
  const now = t + (serverNow() - Date.now())
  const brush = useBrush()
  const amDrawer = meId && meId === game.drawer
  const onStroke = useCallback((s) => dispatch({ type: 'stroke', ...s }), [dispatch])

  useEffect(() => {
    if (game.phase === 'over' && meId) recordResultOnce(`desenho-${state.code}-${game.startedAt}`, 'desenho', game.winners.includes(meId), String(game.scores[meId]))
  }, [game.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (game.phase === 'over') {
    const ranked = [...game.order].sort((a, b) => game.scores[b] - game.scores[a])
    return (
      <div className="game-panel game-panel--wide">
        <div className="dw-over" data-testid="dw-over">
          <h3>{game.winners.includes(meId) ? 'Ganhaste! 🎉' : `${game.winners.map(name).join(' e ')} ${game.winners.length > 1 ? 'ganharam' : 'ganhou'}!`}</h3>
          <ol className="bp-rank">
            {ranked.map((id) => <li key={id}><span>{name(id)}</span><small>{game.scores[id]} pontos</small></li>)}
          </ol>
          {meId && <button type="button" className="share-btn" onClick={() => dispatch({ type: 'rematch' })} data-testid="dw-again">Jogar outra vez</button>}
        </div>
      </div>
    )
  }

  const showWord = amDrawer || game.guessed?.[meId] != null || game.phase === 'reveal'
  return (
    <div className="game-panel game-panel--wide">
      <div className="dw-game">
        <div className="dw-top">
          <span className="dw-round">Ronda {game.round}/{game.cfg.rounds}</span>
          <span className="dw-word" data-testid="dw-word">
            {game.phase === 'choose' ? (amDrawer ? 'Escolhe uma palavra' : `${name(game.drawer)} está a escolher…`) : showWord ? game.word : <span className="dw-mask">{mask(game.word, game.revealed)}</span>}
            {game.phase === 'draw' && !showWord && <small> ({[...game.word].filter((c) => c !== ' ' && c !== '-').length} letras)</small>}
          </span>
          <span className={`dw-time${game.phase === 'draw' && game.phaseEnds - now < 10000 ? ' dw-time--low' : ''}`} data-testid="dw-time">⏱ {secs(game.phaseEnds - now)}</span>
        </div>
        <div className="dw-main">
          <div className="dw-board">
            <div className="dw-canvas-wrap">
              <DrawCanvas strokes={game.strokes} canDraw={amDrawer && game.phase === 'draw'} color={brush.color} size={brush.size} onStroke={onStroke} />
              {game.phase === 'choose' && (
                <div className="dw-overlay" data-testid="dw-choose">
                  {amDrawer ? (
                    <>
                      <p>És tu a desenhar! Escolhe uma palavra:</p>
                      <div className="dw-choices">
                        {game.choices.map((c, i) => (
                          <button key={c.word} type="button" className="share-btn" onClick={() => dispatch({ type: 'choose', i })} data-testid={`dw-choice-${i}`}>
                            {c.word} <small>({LEVEL[c.level]})</small>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p>{name(game.drawer)} está a escolher uma palavra…</p>
                  )}
                </div>
              )}
              {game.phase === 'reveal' && (
                <div className="dw-overlay dw-overlay--soft" data-testid="dw-reveal">
                  <p>A palavra era <b>{game.word}</b></p>
                  <small>{Object.keys(game.guessed).length ? `${Object.keys(game.guessed).map(name).join(', ')} ${Object.keys(game.guessed).length > 1 ? 'acertaram' : 'acertou'}` : 'Ninguém acertou.'}</small>
                </div>
              )}
            </div>
            {amDrawer && game.phase === 'draw' && (
              <Tools {...brush} onUndo={() => dispatch({ type: 'undo' })} onClear={() => dispatch({ type: 'clear' })} canUndo={game.strokes.length > 0} />
            )}
          </div>
          <div className="dw-side">
            <Players game={game} meId={meId} people={people} name={name} />
            {meId && <Chat game={game} meId={meId} name={name} onSend={(text) => dispatch({ type: 'guess', text })} />}
          </div>
        </div>
      </div>
    </div>
  )
}

const lobbyChoice = { rounds: 2, drawSecs: 80 }
function LobbyOptions({ amHost }) {
  const [opts, setOpts] = useState({ ...lobbyChoice })
  Object.assign(lobbyChoice, opts)
  if (!amHost) return null
  return (
    <div className="bomb-lobby-bots">
      <p className="modal-note">Rondas (cada um desenha uma vez por ronda):</p>
      <div className="bot-levels">
        {ROUND_OPTIONS.map((n) => (
          <button key={n} type="button" className={`mode-btn${opts.rounds === n ? ' mode-btn--active' : ''}`} onClick={() => setOpts({ ...opts, rounds: n })} data-testid={`dw-rounds-${n}`}>{n}</button>
        ))}
      </div>
      <p className="modal-note">Tempo para desenhar:</p>
      <div className="bot-levels">
        {DRAW_OPTIONS.map((n) => (
          <button key={n} type="button" className={`mode-btn${opts.drawSecs === n ? ' mode-btn--active' : ''}`} onClick={() => setOpts({ ...opts, drawSecs: n })} data-testid={`dw-secs-${n}`}>{n} s</button>
        ))}
      </div>
    </div>
  )
}

// ---------- Num só ecrã (partilhar o ecrã na chamada) ----------
function newWord(level, used) {
  const pool = WORDS[level].filter((w) => !used.includes(w))
  const list = pool.length ? pool : WORDS[level]
  return list[Math.floor(Math.random() * list.length)]
}

function OneScreen() {
  const [level, setLevel] = useState('facil')
  const [drawSecs, setDrawSecs] = useState(80)
  const [play, setPlay] = useState(null) // { word, ends, used, ok, skip, over }
  const [strokes, setStrokes] = useState([])
  const [peek, setPeek] = useState(false)
  const brush = useBrush()
  const now = useNow(250)
  const timeUp = play && !play.over && now >= play.ends

  useEffect(() => {
    if (timeUp) setPlay((p) => ({ ...p, over: true }))
  }, [timeUp])

  const onStroke = useCallback((s) => {
    setStrokes((list) => {
      const last = list[list.length - 1]
      if (last && last.sid === s.sid) return [...list.slice(0, -1), { ...last, p: last.p + s.p }]
      return [...list, s]
    })
  }, [])
  const next = (field) => {
    setStrokes([])
    setPeek(false)
    setPlay((p) => {
      const used = p ? [...p.used, p.word] : []
      return { word: newWord(level, used), ends: Date.now() + drawSecs * 1000, used, ok: (p?.ok || 0) + (field === 'ok' ? 1 : 0), skip: (p?.skip || 0) + (field === 'skip' ? 1 : 0), over: false }
    })
  }

  if (!play) {
    return (
      <div className="game-panel">
        <p className="game-status">Num só ecrã: partilha o ecrã na chamada, desenha, e os amigos dizem os palpites em voz alta.</p>
        <p className="modal-note">Palavras:</p>
        <div className="bot-levels">
          {Object.keys(WORDS).map((l) => (
            <button key={l} type="button" className={`mode-btn${level === l ? ' mode-btn--active' : ''}`} onClick={() => setLevel(l)} data-testid={`dw-level-${l}`}>{LEVEL[l]}</button>
          ))}
        </div>
        <p className="modal-note">Tempo por desenho:</p>
        <div className="bot-levels">
          {DRAW_OPTIONS.map((n) => (
            <button key={n} type="button" className={`mode-btn${drawSecs === n ? ' mode-btn--active' : ''}`} onClick={() => setDrawSecs(n)}>{n} s</button>
          ))}
        </div>
        <button type="button" className="share-btn" onClick={() => next()} data-testid="dw-one-start">Começar</button>
      </div>
    )
  }

  return (
    <div className="game-panel game-panel--wide">
      <div className="dw-game">
        <div className="dw-top">
          <span className="dw-round">✓ {play.ok} · passadas {play.skip}</span>
          <button
            type="button"
            className="mode-btn dw-peek"
            onPointerDown={() => setPeek(true)}
            onPointerUp={() => setPeek(false)}
            onPointerLeave={() => setPeek(false)}
            onContextMenu={(e) => e.preventDefault()}
            data-testid="dw-peek"
          >
            {peek || play.over ? <b data-testid="dw-one-word">{play.word}</b> : '👁 Mantém carregado para ver a palavra'}
          </button>
          <span className={`dw-time${play.ends - now < 10000 ? ' dw-time--low' : ''}`}>⏱ {secs(play.ends - now)}</span>
        </div>
        <div className="dw-board">
          <div className="dw-canvas-wrap">
            <DrawCanvas strokes={strokes} canDraw={!play.over} color={brush.color} size={brush.size} onStroke={onStroke} />
            {play.over && (
              <div className="dw-overlay dw-overlay--soft">
                <p>Acabou o tempo! Era <b>{play.word}</b></p>
              </div>
            )}
          </div>
          {!play.over && <Tools {...brush} onUndo={() => setStrokes((l) => l.slice(0, -1))} onClear={() => setStrokes([])} canUndo={strokes.length > 0} />}
        </div>
        <div className="game-actions">
          {!play.over && <button type="button" className="share-btn" onClick={() => next('ok')} data-testid="dw-one-ok">Acertaram! ✓</button>}
          <button type="button" className="mode-btn" onClick={() => next(play.over ? undefined : 'skip')} data-testid="dw-one-next">{play.over ? 'Próxima palavra' : 'Passar'}</button>
          <button type="button" className="link-btn" onClick={() => setPlay(null)}>Mudar definições</button>
        </div>
      </div>
    </div>
  )
}

const HELP = (
  <>
    <p>À vez, cada jogador escolhe uma de três palavras (fácil, média ou difícil) e desenha-a. Os outros escrevem palpites na conversa.</p>
    <p>Quanto mais depressa acertares, mais pontos ganhas (o primeiro ganha um bónus). Quem desenha ganha pontos por cada pessoa que acerta. A meio do tempo aparece uma letra de ajuda, e outra perto do fim.</p>
    <p>Não vale escrever letras ou a palavra no desenho! Se o palpite estiver quase certo, avisamos só a ti.</p>
    <p>Sem conta, joga <strong>Num só ecrã</strong>: partilha o ecrã na chamada do Discord, desenha, e os amigos dizem os palpites em voz alta.</p>
  </>
)

export default function DesenhoGame() {
  return (
    <GameShell
      game="desenho"
      title="Desenha e Adivinha"
      help={HELP}
      wide
      modes={[
        { key: 'online', label: 'Multiplayer' },
        { key: 'ecra', label: 'Num só ecrã' },
      ]}
    >
      {(mode) =>
        mode === 'ecra' ? (
          <OneScreen />
        ) : (
          <OnlineGame
            game="desenho"
            logic={desenhoOnline}
            renderLobbyOptions={(props) => <LobbyOptions {...props} />}
            prepareStart={() => ({ ...lobbyChoice })}
            renderGame={(props) => <OnlineBoard {...props} />}
          />
        )
      }
    </GameShell>
  )
}
