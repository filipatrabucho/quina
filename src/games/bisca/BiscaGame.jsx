import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import Card from '../../components/Card.jsx'
import { gameBreak } from '../../lib/ads.js'
import { recordResultOnce } from '../../lib/social.js'
import { SUIT_SYMBOL, SUIT_NAME } from '../../lib/cards.js'
import { SUECA_RANKS } from '../sueca/suecaLogic.js'
import { BOT_NAMES, TARGET, TURN_MS, startGame, applyAction, tick, legalCards, canSwap, trickWinner, handPoints, teamOf, biscaOnline } from './biscaLogic.js'

const SPOTS4 = ['bottom', 'right', 'top', 'left']
const SPOTS2 = ['bottom', 'top']
const SUIT_ORDER = { s: 0, h: 1, c: 2, d: 3 }
const botPerson = (id) => ({ name: BOT_NAMES[Number(id.slice(3))] || 'Bot', seed: id })
const sortHand = (cards) => [...cards].sort((a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || SUECA_RANKS.indexOf(b.rank) - SUECA_RANKS.indexOf(a.rank))
const red = (suit) => suit === 'h' || suit === 'd'

function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  return now
}

function Seat({ game, id, meId, person, spot, now }) {
  const me = id === meId
  const turn = game.turn === id
  const n = game.hands[id]?.length || 0
  const left = turn && game.deadline && !me ? Math.max(0, game.deadline - now) : 0
  const four = game.order.length === 4
  const partner = !me && teamOf(game, id) === teamOf(game, meId)
  return (
    <div className={`sk-seat sk-seat--${spot}${turn ? ' sk-seat--turn' : ''}`} data-testid={me ? 'bc-seat-me' : 'bc-seat'}>
      {!me && (
        <div className="sk-backs" aria-label={`${n} cartas`}>
          {Array.from({ length: n }, (_, i) => <span key={i} className="sk-back" />)}
        </div>
      )}
      <div className="sk-plate">
        <Avatar src={person?.avatar} seed={person?.seed || id} name={person?.name} size={28} />
        <span className="sk-plate__info">
          <b>{me ? 'Tu' : person?.name || 'Jogador'}</b>
          {four && <small>{me ? 'a tua equipa' : partner ? 'parceiro' : 'adversário'}</small>}
        </span>
        {game.dealer === id && <span className="sk-dealer" title="Baralhou">B</span>}
      </div>
      {left > 0 && <span className="pk-timer" style={{ '--t': left / TURN_MS }} />}
    </div>
  )
}

function Table({ game, meId, people, onAction, now, children }) {
  const n = game.order.length
  const spots = n === 4 ? SPOTS4 : SPOTS2
  const at = Math.max(0, game.order.indexOf(meId))
  const seated = game.order.includes(meId)
  const rot = game.order.map((_, k) => game.order[(at + k) % n])
  const spotOf = (id) => spots[rot.indexOf(id)]
  const us = seated ? teamOf(game, meId) : 0
  const them = 1 - us
  const pts = handPoints(game)
  const myTurn = game.phase === 'play' && game.turn === meId
  const legal = new Set(myTurn ? legalCards(game, meId).map((c) => c.id) : [])
  const hand = sortHand(game.hands[meId] || [])
  const winIdx = game.phase === 'trick' ? trickWinner(game.trick, game.trump.suit) : -1
  const name = (id) => (id === meId ? 'Tu' : people(id)?.name || 'Jogador')
  const fmt = (msg) => msg.replace(/@([\w-]+)/g, (_, id) => name(id))
  const secs = myTurn && game.deadline ? Math.max(0, Math.ceil((game.deadline - now) / 1000)) : null
  const other = n === 2 ? rot[1] : null
  const usLabel = n === 2 ? 'Tu' : 'Nós'
  const themLabel = n === 2 ? name(other) : 'Eles'
  const swap = seated && canSwap(game, meId)

  return (
    <div className="sk-wrap">
      <div className="sk-score" data-testid="bc-score">
        <span className="sk-score__team sk-score__team--us"><small>{usLabel}</small><b>{game.games[us]}</b></span>
        <span className="sk-score__mid">
          jogos (a {TARGET})
          <span className="sk-trump">Trunfo: <b className={red(game.trump.suit) ? 'sk-red' : ''}>{SUIT_SYMBOL[game.trump.suit]} {SUIT_NAME[game.trump.suit]}</b></span>
        </span>
        <span className="sk-score__team"><small className="bc-them">{themLabel}</small><b>{game.games[them]}</b></span>
      </div>
      <div className={`sk-table${n === 2 ? ' bc-table--2' : ''}`} data-testid="bc-table">
        <div className="sk-felt">
          {game.stock.length > 0 && (
            <div className="bc-stock" data-testid="bc-stock" title={`${game.stock.length} cartas no monte`}>
              <span className="bc-stock__trump"><Card card={game.trump.card} /></span>
              {game.stock.length > 1 && <span className="bc-stock__pile"><Card hidden /></span>}
              <b className="bc-stock__n">{game.stock.length}</b>
            </div>
          )}
          <div className="sk-trick">
            {game.trick.map((t, i) => (
              <span key={t.card.id} className={`sk-trick__card sk-trick__card--${spotOf(t.id)}${i === winIdx ? ' sk-trick__card--win' : ''}`}>
                <Card card={t.card} />
              </span>
            ))}
          </div>
          <div className="sk-points">
            <span>{usLabel} <b>{pts[us]}</b></span>
            <span>{themLabel} <b>{pts[them]}</b></span>
          </div>
        </div>
        {rot.map((id) => (
          <Seat key={id} game={game} id={id} meId={meId} person={people(id)} spot={spotOf(id)} now={now} />
        ))}
      </div>

      {seated && (
        <div className={`sk-hand bc-hand${myTurn ? ' sk-hand--turn' : ''}`} data-testid="bc-hand">
          {hand.map((c) => {
            const ok = legal.has(c.id)
            return (
              <button key={c.id} type="button" className={`sk-card${ok ? ' sk-card--legal' : ''}`} disabled={!ok} onClick={() => onAction({ type: 'play', card: c.id })} data-testid="bc-card" data-legal={ok ? '1' : '0'}>
                <Card card={c} dim={myTurn && !ok} />
              </button>
            )
          })}
        </div>
      )}
      {swap && (
        <button type="button" className="mode-btn bc-swap" onClick={() => onAction({ type: 'swap' })} data-testid="bc-swap">
          Trocar o 2 de {SUIT_NAME[game.trump.suit]} pelo trunfo virado
        </button>
      )}
      <p className="game-status sk-status" data-testid="bc-status">
        {game.phase === 'play' &&
          (myTurn
            ? `A tua vez${secs != null ? ` (${secs} s)` : ''}: escolhe uma carta${!game.stock.length && game.trick.length ? ' (o monte acabou: tens de assistir)' : ''}.`
            : `Vez de ${name(game.turn)}…`)}
        {game.phase === 'trick' && `${name(game.trick[winIdx].id)} ganha a vaza.`}
      </p>

      {(game.phase === 'end' || game.phase === 'over') && game.result && (
        <div className={`sk-end${game.result.team === us ? ' sk-end--win' : game.result.team === them ? ' sk-end--lose' : ''}`} data-testid="bc-end">
          <b>
            {game.result.team == null
              ? 'Empate a 60: ninguém ganha jogos'
              : `${game.result.team === us ? (n === 2 ? 'Ganhaste' : 'Ganhámos') : `${themLabel} ${n === 2 ? 'ganhou' : 'ganharam'}`} ${game.result.gamesWon} ${game.result.gamesWon === 1 ? 'jogo' : 'jogos'}${game.result.kind === 'capote' ? ' (capote!)' : game.result.kind === 'bandeira' ? ' (bandeira!)' : ''}`}
          </b>
          <span>Pontos desta mão: {usLabel.toLowerCase()} {game.result.points[us]}, {n === 2 ? themLabel : 'eles'} {game.result.points[them]}.</span>
        </div>
      )}
      {children}
      {game.log.length > 0 && (
        <ul className="sk-log">
          {game.log.slice(0, 5).map((m, i) => <li key={i}>{fmt(m)}</li>)}
        </ul>
      )}
    </div>
  )
}

const newBotGame = (seats) => {
  const bots = Array.from({ length: seats - 1 }, (_, i) => `bot${i}`)
  return startGame(['tu', ...bots], bots, Date.now(), Math.random, { timed: false })
}

function VsBots() {
  const [params] = useSearchParams()
  const [seats, setSeats] = useState(2)
  const [game, setGame] = useState(() => (params.get('jogar') ? newBotGame(2) : null))
  const [error, setError] = useState('')
  const now = useNow()
  const people = (id) => (id === 'tu' ? { name: 'Tu' } : botPerson(id))

  useEffect(() => {
    if (!game) return undefined
    const t = setInterval(() => setGame((g) => (g ? tick(g, Date.now()) : g)), 250)
    return () => clearInterval(t)
  }, [!!game]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (game?.phase === 'over') recordResultOnce(`bisca-bot-${Date.now()}`, 'bisca', game.winner === teamOf(game, 'tu'))
  }, [game?.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const onAction = useCallback((a) => {
    setError('')
    setGame((g) => {
      try {
        return applyAction(g, 'tu', a)
      } catch (e) {
        setError(e.message)
        return g
      }
    })
  }, [])

  if (!game) {
    return (
      <div className="game-panel">
        <p className="game-status">Como queres jogar?</p>
        <div className="bot-levels">
          <button className={`mode-btn${seats === 2 ? ' mode-btn--active' : ''}`} onClick={() => setSeats(2)} data-testid="bc-seats-2">1 contra 1</button>
          <button className={`mode-btn${seats === 4 ? ' mode-btn--active' : ''}`} onClick={() => setSeats(4)} data-testid="bc-seats-4">2 contra 2</button>
        </div>
        <p className="modal-note">{seats === 2 ? 'Tu contra um bot.' : 'Tu e um bot contra dois bots.'} Ganha quem chegar primeiro a {TARGET} jogos.</p>
        <button className="share-btn" data-testid="bc-start" onClick={() => setGame(newBotGame(seats))}>Começar partida</button>
      </div>
    )
  }
  const won = game.phase === 'over' && game.winner === teamOf(game, 'tu')
  return (
    <div className="game-panel game-panel--wide">
      <Table game={game} meId="tu" people={people} onAction={onAction} now={now}>
        {game.phase === 'end' && <button className="mode-btn" onClick={() => onAction({ type: 'next' })} data-testid="bc-next">Próxima mão</button>}
        {game.phase === 'over' && (
          <div className="pk-over" data-testid="bc-over">
            <h3>{won ? 'Ganhaste a partida!' : 'Perdeste a partida.'}</h3>
            <div className="game-actions">
              <button className="share-btn" onClick={() => gameBreak('bisca', () => onAction({ type: 'rematch' }))}>Nova partida</button>
              <button className="mode-btn" onClick={() => setGame(null)}>Mudar de mesa</button>
            </div>
          </div>
        )}
      </Table>
      {error && <p className="duel-error">{error}</p>}
    </div>
  )
}

function OnlineBoard({ state, game, me, dispatch, serverNow }) {
  const people = (id) => state.players.find((p) => p.id === id) || (id.startsWith('bot') ? botPerson(id) : null)
  const t = useNow()
  const now = t + (serverNow() - Date.now())
  const seated = game.order.includes(me.id)
  useEffect(() => {
    if (game.phase === 'over' && seated) recordResultOnce(`bisca-${state.code}-${game.handNo}-${game.games.join('.')}`, 'bisca', game.winner === teamOf(game, me.id))
  }, [game.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="game-panel game-panel--wide">
      <Table game={game} meId={me.id} people={people} onAction={dispatch} now={now}>
        {game.phase === 'end' && seated && <button className="mode-btn" onClick={() => dispatch({ type: 'next' })} data-testid="bc-next">Próxima mão</button>}
        {game.phase === 'over' && (
          <div className="pk-over" data-testid="bc-over">
            <h3>{seated ? (game.winner === teamOf(game, me.id) ? 'Ganhaste a partida!' : 'Perdeste a partida.') : 'Fim da partida'}</h3>
            {seated && <button className="share-btn" onClick={() => dispatch({ type: 'rematch' })}>Nova partida</button>}
          </div>
        )}
      </Table>
    </div>
  )
}

const lobbyChoice = { seats: 2, together: true }
function LobbySeats({ state, amHost }) {
  const [seats, setSeats] = useState(2)
  const [together, setTogether] = useState(true)
  const n = state.players.length
  const shown = n > 2 ? 4 : seats
  lobbyChoice.seats = shown
  lobbyChoice.together = together
  return (
    <div className="bomb-lobby-bots">
      <p className="modal-note">
        {shown === 2 ? (n === 1 ? 'Jogas 1 contra 1 com um bot.' : 'Um contra o outro.') : `2 contra 2${n < 4 ? `: os lugares que faltam (${4 - n}) ficam com bots` : ''}.`}
      </p>
      {amHost && n <= 2 && (
        <div className="bot-levels">
          <button type="button" className={`mode-btn${shown === 2 ? ' mode-btn--active' : ''}`} onClick={() => setSeats(2)} data-testid="bc-lobby-2">1 contra 1</button>
          <button type="button" className={`mode-btn${shown === 4 ? ' mode-btn--active' : ''}`} onClick={() => setSeats(4)} data-testid="bc-lobby-4">2 contra 2</button>
        </div>
      )}
      {amHost && n === 2 && shown === 4 && (
        <div className="bot-levels">
          <button type="button" className={`mode-btn${together ? ' mode-btn--active' : ''}`} onClick={() => setTogether(true)}>Mesma equipa</button>
          <button type="button" className={`mode-btn${!together ? ' mode-btn--active' : ''}`} onClick={() => setTogether(false)}>Equipas diferentes</button>
        </div>
      )}
    </div>
  )
}

const HELP = (
  <>
    <p>A Bisca joga-se a 2 (um contra um) ou a 4 (duas equipas, com o parceiro à frente), com o baralho de 40 cartas (sem 8, 9 e 10). Cada um tem sempre 3 cartas na mão.</p>
    <p>A carta virada por baixo do monte é o <strong>trunfo</strong>. Depois de cada vaza, quem a ganhou compra primeiro. Enquanto houver monte podes jogar qualquer carta; quando o monte acaba, tens de <strong>assistir</strong>.</p>
    <p>Quem tiver o <strong>2 de trunfo</strong> pode trocá-lo pela carta virada (enquanto houver monte).</p>
    <p>Força: Ás, 7, Rei, Valete, Dama, 6, 5, 4, 3, 2. Pontos: Ás 11, 7 10, Rei 4, Valete 3, Dama 2 (120 por mão). Mais de 60 vale 1 jogo, 91 ou mais 2 (capote), 120 vale 4 (bandeira). Ganha quem chegar a {TARGET} jogos.</p>
  </>
)

export default function BiscaGame() {
  return (
    <GameShell
      game="bisca"
      title="Bisca"
      help={HELP}
      modes={[
        { key: 'bot', label: 'vs Bots' },
        { key: 'online', label: 'Mesa com amigos' },
      ]}
    >
      {(mode) =>
        mode === 'bot' ? (
          <VsBots />
        ) : (
          <OnlineGame
            game="bisca"
            logic={biscaOnline}
            renderLobbyOptions={(props) => <LobbySeats {...props} />}
            prepareStart={() => ({ seats: lobbyChoice.seats, together: lobbyChoice.together })}
            renderGame={(props) => <OnlineBoard {...props} />}
          />
        )
      }
    </GameShell>
  )
}
