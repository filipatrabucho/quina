import { useCallback, useEffect, useRef, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import { gameBreak } from '../../lib/ads.js'
import { recordResultOnce } from '../../lib/social.js'
import { loadDictionary } from './dictionary.js'
import { ALPHABET, BOT_NAMES, LIVES_OPTIONS, startGame, applyAction, tick, bombaOnline } from './bombaLogic.js'

const LEVELS = [
  { key: 'facil', label: 'Fáceis' },
  { key: 'medio', label: 'Normais' },
  { key: 'dificil', label: 'Rápidos' },
]
const REASON = { curta: 'tem de ter pelo menos 3 letras', 'sílaba': 'não tem a sílaba', repetida: 'já foi usada', 'não existe': 'não está no dicionário' }

function useNow(active, every = 200) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return undefined
    const t = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(t)
  }, [active, every])
  return now
}

function Hearts({ n }) {
  return (
    <span className="bp-hearts" aria-label={`${n} ${n === 1 ? 'vida' : 'vidas'}`}>
      {Array.from({ length: Math.max(0, n) }, (_, i) => <i key={i}>❤</i>)}
    </span>
  )
}

function Bomb({ syllable, boom }) {
  return (
    <div className={`bp-bomb${boom ? ' bp-bomb--boom' : ''}`} aria-hidden={!!boom}>
      <svg viewBox="0 0 120 120" className="bp-bomb__svg" aria-hidden="true">
        <defs>
          <radialGradient id="bp-shine" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#5A6080" />
            <stop offset="0.55" stopColor="#2A2E44" />
            <stop offset="1" stopColor="#14161F" />
          </radialGradient>
        </defs>
        <circle cx="58" cy="66" r="44" fill="url(#bp-shine)" stroke="#0B0D16" strokeWidth="3" />
        <circle cx="42" cy="48" r="8" fill="#fff" fillOpacity="0.22" />
        <rect x="64" y="14" width="20" height="16" rx="4" fill="#3A3F58" transform="rotate(35 74 22)" />
        <path d="M80 16q8-12 18-6" stroke="#F4E6C3" strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle className="bp-bomb__spark" cx="99" cy="9" r="6" fill="#FFC93C" />
      </svg>
      <b className="bp-bomb__syl" data-testid="bp-syllable">{boom ? '💥' : syllable?.toUpperCase()}</b>
    </div>
  )
}

function Table({ game, meId, people, onAction, now }) {
  const me = game.players[meId]
  const myTurn = game.phase === 'play' && game.holder === meId
  const [text, setText] = useState('')
  const inputRef = useRef(null)
  const typingTimer = useRef(null)
  const name = (id) => (id === meId ? 'Tu' : people(id)?.name || 'Jogador')

  useEffect(() => {
    setText('')
    if (myTurn) setTimeout(() => inputRef.current?.focus(), 0)
  }, [myTurn, game.syllable])
  useEffect(() => () => clearTimeout(typingTimer.current), [])

  const change = (v) => {
    setText(v)
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => onAction({ type: 'typing', text: v }), 120)
  }
  const submit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    clearTimeout(typingTimer.current)
    onAction({ type: 'word', text })
    setText('')
  }

  const n = game.order.length
  const holderIdx = game.order.indexOf(game.holder)
  const angle = (i) => (i / n) * 360 - 90
  const last = game.last
  const secsLeft = Math.max(0, Math.ceil(((game.phaseEnds || now) - now) / 1000))

  return (
    <div className="bp-game">
      <div className="bp-table" data-testid="bp-table">
        <div className="bp-center">
          {game.phase === 'countdown' ? (
            <div className="bp-count" data-testid="bp-countdown">{secsLeft || 1}</div>
          ) : (
            <Bomb syllable={game.syllable} boom={game.phase === 'boom' || game.phase === 'over'} />
          )}
          {game.phase === 'play' && holderIdx >= 0 && (
            <span className="bp-arrow" style={{ transform: `rotate(${angle(holderIdx) + 90}deg)` }} aria-hidden="true"><i /></span>
          )}
        </div>
        {game.order.map((id, i) => {
          const p = game.players[id]
          const who = people(id)
          const a = (angle(i) * Math.PI) / 180
          const holder = game.holder === id && game.phase === 'play'
          return (
            <div
              key={id}
              className={`bp-seat${holder ? ' bp-seat--turn' : ''}${p.lives <= 0 ? ' bp-seat--out' : ''}${id === meId ? ' bp-seat--me' : ''}`}
              style={{ left: `${50 + Math.cos(a) * 40}%`, top: `${50 + Math.sin(a) * 40}%` }}
              data-testid={`bp-seat-${id === meId ? 'me' : id}`}
            >
              <Avatar src={who?.avatar} seed={who?.seed || id} name={who?.name} size={40} />
              <span className="bp-seat__name">{name(id)}</span>
              <Hearts n={p.lives} />
              {holder && game.typing && id !== meId && <span className="bp-seat__typing" data-testid="bp-typing">{game.typing}</span>}
            </div>
          )
        })}
      </div>

      <div className="bp-status" aria-live="polite" data-testid="bp-status">
        {game.phase === 'countdown' && 'Prepara-te…'}
        {game.phase === 'boom' && (
          <b className="bp-status--boom">💥 A bomba rebentou nas mãos de {name(game.boom.id)}{game.boom.out ? ', que está fora!' : '!'}</b>
        )}
        {game.phase === 'play' && (myTurn ? <b>É a tua vez! Escreve uma palavra com «{game.syllable.toUpperCase()}».</b> : `${name(game.holder)} tem a bomba…`)}
        {game.phase === 'play' && last && (
          <span className={`bp-last${last.ok ? ' bp-last--ok' : ''}`} key={last.at} data-testid="bp-last">
            {last.ok ? `✓ ${name(last.by)}: ${last.word.toUpperCase()}${last.bonus ? ' (+1 vida pelo alfabeto!)' : ''}` : `✗ ${name(last.by)}: «${last.word}» ${REASON[last.reason]}`}
          </span>
        )}
      </div>

      {me && game.phase !== 'over' && me.lives > 0 && (
        <>
          <form className="bp-input" onSubmit={submit}>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => change(e.target.value)}
              disabled={!myTurn}
              placeholder={myTurn ? `Palavra com «${game.syllable?.toUpperCase()}»` : 'Espera pela tua vez'}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={30}
              data-testid="bp-input"
            />
            <button type="submit" className="share-btn" disabled={!myTurn || !text.trim()} data-testid="bp-send">Enviar</button>
          </form>
          <div className="bp-letters" title="Usa todas as letras para ganhar uma vida">
            {ALPHABET.split('').map((ch) => <span key={ch} className={me.letters.includes(ch) ? 'on' : ''}>{ch.toUpperCase()}</span>)}
          </div>
        </>
      )}
      {me && me.lives <= 0 && game.phase !== 'over' && <p className="modal-note">Ficaste sem vidas. Vê quem ganha!</p>}
    </div>
  )
}

function Over({ game, meId, people, children }) {
  const name = (id) => (id === meId ? 'Tu' : people(id)?.name || 'Jogador')
  const ranked = [...game.order].sort((a, b) => game.players[b].lives - game.players[a].lives || game.players[b].words - game.players[a].words)
  return (
    <div className="bp-over" data-testid="bp-over">
      <h3>{game.winner === meId ? 'Ganhaste! 🎉' : game.winner ? `${name(game.winner)} ganhou!` : 'Acabou!'}</h3>
      <ol className="bp-rank">
        {ranked.map((id) => (
          <li key={id}>
            <span>{name(id)}</span>
            <small>{game.players[id].words} {game.players[id].words === 1 ? 'palavra' : 'palavras'}{game.wins[id] ? ` · ${game.wins[id]} ${game.wins[id] === 1 ? 'vitória' : 'vitórias'}` : ''}</small>
          </li>
        ))}
      </ol>
      {children}
    </div>
  )
}

function Board({ game, meId, people, onAction, now, children }) {
  return (
    <div className="game-panel game-panel--wide">
      {game.phase === 'over' ? (
        <Over game={game} meId={meId} people={people}>{children}</Over>
      ) : (
        <Table game={game} meId={meId} people={people} onAction={onAction} now={now} />
      )}
    </div>
  )
}

function Options({ value, onChange, botsMin = 1, botsMax = 5, showBots = true }) {
  return (
    <>
      {showBots && (
        <>
          <p className="game-status">Quantos bots?</p>
          <div className="bot-levels">
            {Array.from({ length: botsMax - botsMin + 1 }, (_, i) => botsMin + i).map((n) => (
              <button key={n} type="button" className={`mode-btn${value.bots === n ? ' mode-btn--active' : ''}`} onClick={() => onChange({ ...value, bots: n })} data-testid={`bp-bots-${n}`}>
                {n}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="modal-note">Bots:</p>
      <div className="bot-levels">
        {LEVELS.map((l) => (
          <button key={l.key} type="button" className={`mode-btn${value.level === l.key ? ' mode-btn--active' : ''}`} onClick={() => onChange({ ...value, level: l.key })} data-testid={`bp-level-${l.key}`}>
            {l.label}
          </button>
        ))}
      </div>
      <p className="modal-note">Vidas:</p>
      <div className="bot-levels">
        {LIVES_OPTIONS.map((n) => (
          <button key={n} type="button" className={`mode-btn${value.lives === n ? ' mode-btn--active' : ''}`} onClick={() => onChange({ ...value, lives: n })} data-testid={`bp-lives-${n}`}>
            {n} ❤
          </button>
        ))}
      </div>
    </>
  )
}

// ---------- Contra bots ----------
const botPeople = (id) => (id === 'tu' ? { name: 'Tu' } : { name: BOT_NAMES[Number(id.slice(3))], seed: id })

function VsBots() {
  const [opts, setOpts] = useState({ bots: 2, level: 'medio', lives: 2 })
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const now = useNow(!!game, 200)

  useEffect(() => {
    if (!game || game.phase === 'over') return undefined
    const t = setInterval(() => setGame((g) => (g && g.phase !== 'over' ? tick(g, Date.now()) : g)), 100)
    return () => clearInterval(t)
  }, [game?.startedAt, game?.phase === 'over']) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (game?.phase === 'over') recordResultOnce(`bombapalavras-bot-${game.startedAt}`, 'bombapalavras', game.winner === 'tu', String(game.players.tu.words))
  }, [game?.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const onAction = useCallback((a) => setGame((g) => (g ? applyAction(g, 'tu', a, Date.now()) : g)), [])
  const start = async () => {
    setLoading(true)
    setError('')
    try {
      await loadDictionary()
      const ids = ['tu', ...Array.from({ length: opts.bots }, (_, i) => `bot${i}`)]
      setGame(startGame(ids, ids.slice(1), Date.now(), Math.random, opts))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!game) {
    return (
      <div className="game-panel">
        <Options value={opts} onChange={setOpts} />
        <button type="button" className="share-btn" onClick={start} disabled={loading} data-testid="bp-start">{loading ? 'A carregar o dicionário…' : 'Começar'}</button>
        {error && <p className="duel-error">{error}</p>}
      </div>
    )
  }
  return (
    <Board game={game} meId="tu" people={botPeople} onAction={onAction} now={now}>
      <div className="game-actions">
        <button type="button" className="share-btn" data-testid="bp-again" onClick={() => gameBreak('bombapalavras', () => setGame((g) => applyAction(g, 'tu', { type: 'rematch' }, Date.now())))}>
          Jogar outra vez
        </button>
        <button type="button" className="mode-btn" onClick={() => setGame(null)}>Mudar definições</button>
      </div>
    </Board>
  )
}

// ---------- Online ----------
function OnlineBoard({ state, game, me, dispatch, serverNow, amHost }) {
  const people = useCallback((id) => state.players.find((p) => p.id === id) || (id.startsWith('bot') ? { name: BOT_NAMES[Number(id.slice(3))], seed: id } : null), [state.players])
  const seated = !!game.players[me.id]
  const [ready, setReady] = useState(!amHost)
  const t = useNow(true, 200)
  const now = t + (serverNow() - Date.now())
  // O anfitrião valida as palavras: precisa do dicionário (ex.: depois de recarregar a página).
  useEffect(() => {
    if (amHost) loadDictionary().then(() => setReady(true), () => setReady(true))
  }, [amHost])
  useEffect(() => {
    if (game.phase === 'over' && seated) recordResultOnce(`bombapalavras-${state.code}-${game.startedAt}`, 'bombapalavras', game.winner === me.id, String(game.players[me.id].words))
  }, [game.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!ready) return <p className="page-loading">A carregar o dicionário…</p>
  return (
    <Board game={game} meId={seated ? me.id : null} people={people} onAction={dispatch} now={now}>
      {seated && (
        <div className="game-actions">
          <button type="button" className="share-btn" data-testid="bp-again" onClick={() => dispatch({ type: 'rematch' })}>Jogar outra vez</button>
        </div>
      )}
    </Board>
  )
}

const lobbyChoice = { bots: 0, level: 'medio', lives: 2 }
function LobbyOptions({ state, amHost }) {
  const humans = state.players.length
  const min = Math.max(0, 2 - humans)
  const max = Math.max(0, 8 - humans)
  const [opts, setOpts] = useState({ bots: Math.max(min, lobbyChoice.bots), level: lobbyChoice.level, lives: lobbyChoice.lives })
  Object.assign(lobbyChoice, { ...opts, bots: Math.min(max, Math.max(min, opts.bots)) })
  if (!amHost) return null
  return (
    <div className="bomb-lobby-bots">
      <Options value={{ ...opts, bots: lobbyChoice.bots }} onChange={setOpts} botsMin={min} botsMax={max} />
    </div>
  )
}

const HELP = (
  <>
    <p>No centro está a bomba com uma <strong>sílaba</strong> (por exemplo «CA»). Quem tem a bomba escreve uma palavra que tenha essa sílaba (CAsa, maCAco, faCA…) e carrega em Enter.</p>
    <p>Se a palavra existir e ainda não tiver sido usada, a bomba passa ao seguinte, com outra sílaba. Não há relógio à vista: a bomba rebenta quando calhar e quem a tiver perde uma vida.</p>
    <p>Os acentos não contam (podes escrever «cao» ou «cão»). Usa todas as letras do alfabeto (as que aparecem por baixo) para ganhares uma vida extra.</p>
    <p>Ganha quem ficar por último. Joga contra bots (sem conta) ou cria uma sala e convida os amigos para a chamada.</p>
  </>
)

export default function BombaGame() {
  return (
    <GameShell
      game="bombapalavras"
      title="Bomba de Palavras"
      help={HELP}
      modes={[
        { key: 'bot', label: 'vs Bots' },
        { key: 'online', label: 'Multiplayer' },
      ]}
    >
      {(mode) =>
        mode === 'bot' ? (
          <VsBots />
        ) : (
          <OnlineGame
            game="bombapalavras"
            logic={bombaOnline}
            renderLobbyOptions={(props) => <LobbyOptions {...props} />}
            prepareStart={async () => {
              await loadDictionary()
              return { ...lobbyChoice }
            }}
            renderGame={(props) => <OnlineBoard {...props} />}
          />
        )
      }
    </GameShell>
  )
}
