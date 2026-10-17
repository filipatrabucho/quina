import { useEffect, useMemo, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import { recordResultOnce } from '../../lib/social.js'
import { SIZES, HIDE_MS, makeCards, flip, settle, memoriaOnline } from './memoriaLogic.js'

const BEST_KEY = 'quina-memoria-best'

function Board({ cards, open, cols, onFlip, owners }) {
  return (
    <div className={`memo-board memo-board--c${cols}`} style={{ '--cols': cols }} data-testid="memo-board">
      {cards.map((c, i) => {
        const up = c.matched || open.includes(i)
        return (
          <button
            key={c.id}
            className={`memo-card${up ? ' memo-card--up' : ''}${c.matched ? ' memo-card--done' : ''}`}
            style={c.matched && owners ? { '--owner': owners(c.matched) } : undefined}
            onClick={onFlip && !up ? () => onFlip(i) : undefined}
            disabled={!onFlip || up}
            data-testid={`memo-${i}`}
            data-face={up ? c.face : undefined}
            aria-label={up ? c.face : 'Carta virada'}
          >
            <span className="memo-card__inner">
              <span className="memo-card__back" />
              <span className="memo-card__front">{c.face}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function useClock(running) {
  const [start, setStart] = useState(null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!running) return undefined
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [running])
  return { seconds: start ? Math.floor((now - start) / 1000) : 0, begin: () => { setStart(Date.now()); setNow(Date.now()) }, reset: () => setStart(null) }
}

function readBest() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) || '{}')
  } catch {
    return {}
  }
}

function Solo() {
  const [size, setSize] = useState('normal')
  const [game, setGame] = useState(() => ({ cards: makeCards(SIZES.normal.pairs), open: [], moves: 0, hideAt: null, done: false }))
  const [started, setStarted] = useState(false)
  const [best, setBest] = useState(readBest)
  const clock = useClock(started && !game.done)

  useEffect(() => {
    if (!game.hideAt) return undefined
    const t = setTimeout(() => setGame((g) => settle(g)), HIDE_MS)
    return () => clearTimeout(t)
  }, [game.hideAt])

  useEffect(() => {
    if (!game.done) return
    const prev = best[size]
    if (!prev || game.moves < prev.moves || (game.moves === prev.moves && clock.seconds < prev.seconds)) {
      const nb = { ...best, [size]: { moves: game.moves, seconds: clock.seconds } }
      setBest(nb)
      try {
        localStorage.setItem(BEST_KEY, JSON.stringify(nb))
      } catch {
        // ignora
      }
    }
    recordResultOnce(`memoria-solo-${Date.now()}`, 'memoria', true, size)
  }, [game.done]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = (s = size) => {
    setSize(s)
    setGame({ cards: makeCards(SIZES[s].pairs), open: [], moves: 0, hideAt: null, done: false })
    setStarted(false)
    clock.reset()
  }

  const onFlip = (i) => {
    if (game.hideAt) return
    if (!started) {
      setStarted(true)
      clock.begin()
    }
    setGame((g) => (g.hideAt ? g : flip(g, i, 'tu')))
  }

  const pairsFound = game.cards.filter((c) => c.matched).length / 2
  const b = best[size]
  return (
    <div className="game-panel game-panel--wide memo">
      <div className="bot-levels">
        {Object.entries(SIZES).map(([k, v]) => (
          <button key={k} className={`mode-btn${size === k ? ' mode-btn--active' : ''}`} onClick={() => reset(k)}>
            {v.label}
          </button>
        ))}
      </div>
      <div className="memo-stats">
        <span>Jogadas <b data-testid="memo-moves">{game.moves}</b></span>
        <span>Pares <b>{pairsFound}/{SIZES[size].pairs}</b></span>
        <span>Tempo <b>{clock.seconds}s</b></span>
        {b && <span>Recorde <b>{b.moves} jog. · {b.seconds}s</b></span>}
      </div>
      <Board cards={game.cards} open={game.open} cols={SIZES[size].cols} onFlip={game.done ? null : onFlip} />
      {game.done && (
        <div className="memo-done" data-testid="memo-done">
          <p className="game-status">Muito bem! Encontraste todos os pares em {game.moves} jogadas e {clock.seconds}s.</p>
          <button className="share-btn" onClick={() => reset()}>Jogar outra vez</button>
        </div>
      )}
    </div>
  )
}

const OWNER_COLORS = ['#FF4655', '#2F80ED', '#2FBF71', '#E2A400', '#9B51E0', '#F2994A']

function OnlineBoard({ state, game, me, dispatch, amHost, isOnline }) {
  const people = (id) => state.players.find((p) => p.id === id)
  const myTurn = !game.done && game.order[game.turn] === me.id
  const color = (id) => OWNER_COLORS[game.order.indexOf(id) % OWNER_COLORS.length]
  const seated = game.order.includes(me.id)
  useEffect(() => {
    if (game.done && seated) recordResultOnce(`memoria-${state.code}-${game.round}`, 'memoria', game.winners?.length === 1 && game.winners[0] === me.id)
  }, [game.done, game.round]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="game-panel game-panel--wide memo">
      <div className="memo-players">
        {game.order.map((id) => {
          const p = people(id)
          const turn = !game.done && game.order[game.turn] === id
          return (
            <div key={id} className={`memo-player${turn ? ' memo-player--turn' : ''}`} style={{ '--owner': color(id) }} data-testid={`memo-player-${id}`}>
              <Avatar src={p?.avatar} seed={p?.seed || id} name={p?.name} size={30} />
              <span className="memo-player__name">{id === me.id ? 'Tu' : p?.name}{isOnline && !isOnline(id) ? ' · offline' : ''}</span>
              <b>{game.pairs[id] || 0}</b>
              {game.round > 1 && <small>{game.scores[id] || 0} vit.</small>}
            </div>
          )
        })}
      </div>
      <p className="game-status" data-testid="memo-status">
        {game.done
          ? game.winners.length > 1
            ? `Empate entre ${game.winners.map((id) => (id === me.id ? 'ti' : people(id)?.name)).join(' e ')}!`
            : game.winners[0] === me.id ? 'Ganhaste! Encontraste mais pares.' : `${people(game.winners[0])?.name} ganhou!`
          : myTurn
            ? game.hideAt ? 'Não é par…' : 'É a tua vez: vira duas cartas.'
            : `Vez de ${people(game.order[game.turn])?.name}…`}
      </p>
      <Board cards={game.cards} open={game.open} cols={game.cols} owners={color} onFlip={myTurn && !game.hideAt ? (i) => dispatch({ type: 'flip', index: i }) : null} />
      {game.done && amHost && <button className="share-btn" onClick={() => dispatch({ type: 'rematch' })}>Jogar outra vez</button>}
    </div>
  )
}

const HELP = (
  <>
    <p>Vira duas cartas de cada vez. Se forem iguais ficam viradas, se não voltam a esconder-se. Tenta lembrar-te onde está cada uma.</p>
    <p>No modo solo o objetivo é acabar com o menor número de jogadas. No multiplayer jogam à vez: quem acerta num par joga outra vez e ganha quem encontrar mais pares.</p>
  </>
)

export default function MemoriaGame() {
  const [size, setSize] = useState('normal')
  const prepareStart = useMemo(() => async () => ({ size }), [size])
  const lobbyOptions = ({ amHost }) =>
    amHost ? (
      <div className="meme-settings">
        <label>
          Tamanho
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            {Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.pairs} pares)</option>)}
          </select>
        </label>
      </div>
    ) : null
  return (
    <GameShell
      game="memoria"
      title="Memória"
      help={HELP}
      modes={[
        { key: 'solo', label: 'Solo' },
        { key: 'online', label: 'Multiplayer' },
      ]}
    >
      {(mode) =>
        mode === 'solo' ? (
          <Solo />
        ) : (
          <OnlineGame game="memoria" logic={memoriaOnline} renderGame={(props) => <OnlineBoard {...props} />} renderLobbyOptions={lobbyOptions} prepareStart={prepareStart} />
        )
      }
    </GameShell>
  )
}
