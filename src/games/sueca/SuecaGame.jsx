import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import Card from '../../components/Card.jsx'
import { gameBreak } from '../../lib/ads.js'
import { recordResultOnce } from '../../lib/social.js'
import { SUIT_SYMBOL, SUIT_NAME } from '../../lib/cards.js'
import { BOT_NAMES, TARGET, TURN_MS, SUECA_RANKS, startGame, applyAction, tick, legalCards, trickWinner, handPoints, teamOf, suecaOnline } from './suecaLogic.js'

// Lugares à volta da mesa, a partir de mim: eu em baixo, o seguinte à
// direita, o parceiro em cima e o outro adversário à esquerda.
const SPOTS = ['bottom', 'right', 'top', 'left']
const SUIT_ORDER = { s: 0, h: 1, c: 2, d: 3 }
const KIND_US = { jogo: 'Ganhámos 1 jogo', capote: 'Capote! Ganhámos 2 jogos', bandeira: 'Bandeira! Ganhámos 4 jogos' }
const KIND_THEM = { jogo: 'Eles ganharam 1 jogo', capote: 'Capote! Eles ganharam 2 jogos', bandeira: 'Bandeira! Eles ganharam 4 jogos' }
const botPerson = (id) => ({ name: BOT_NAMES[Number(id.slice(3))] || 'Bot', seed: id })
const sortHand = (cards) => [...cards].sort((a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || SUECA_RANKS.indexOf(b.rank) - SUECA_RANKS.indexOf(a.rank))

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
  const dealer = game.dealer === id
  const showTrump = dealer && game.hands[id]?.some((c) => c.id === game.trump.card.id)
  const partner = !me && teamOf(game, id) === teamOf(game, meId)
  return (
    <div className={`sk-seat sk-seat--${spot}${turn ? ' sk-seat--turn' : ''}`} data-testid={me ? 'sk-seat-me' : 'sk-seat'}>
      {!me && (
        <div className="sk-backs" aria-label={`${n} cartas`}>
          {Array.from({ length: Math.min(n, 10) }, (_, i) => <span key={i} className="sk-back" />)}
        </div>
      )}
      <div className="sk-plate">
        <Avatar src={person?.avatar} seed={person?.seed || id} name={person?.name} size={28} />
        <span className="sk-plate__info">
          <b>{me ? 'Tu' : person?.name || 'Jogador'}</b>
          <small>{me ? 'a tua equipa' : partner ? 'parceiro' : 'adversário'}</small>
        </span>
        {dealer && <span className="sk-dealer" title="Baralhou">B</span>}
      </div>
      {left > 0 && <span className="pk-timer" style={{ '--t': left / TURN_MS }} />}
      {showTrump && (
        <span className="sk-trump-card" title="Carta de trunfo (ainda na mão de quem baralhou)">
          <Card card={game.trump.card} small />
        </span>
      )}
    </div>
  )
}

function Table({ game, meId, people, onAction, now, children }) {
  const at = Math.max(0, game.order.indexOf(meId))
  const seated = game.order.includes(meId)
  const rot = [0, 1, 2, 3].map((k) => game.order[(at + k) % 4])
  const spotOf = (id) => SPOTS[rot.indexOf(id)]
  const myTeam = seated ? teamOf(game, meId) : 0
  const pts = handPoints(game)
  const myTurn = game.phase === 'play' && game.turn === meId
  const legal = new Set(myTurn ? legalCards(game, meId).map((c) => c.id) : [])
  const hand = sortHand(game.hands[meId] || [])
  const shownTrick = game.phase === 'trick' || game.trick.length ? game.trick : []
  const winIdx = game.phase === 'trick' ? trickWinner(game.trick, game.trump.suit) : -1
  const name = (id) => (id === meId ? 'Tu' : people(id)?.name || 'Jogador')
  const fmt = (msg) => msg.replace(/@([\w-]+)/g, (_, id) => name(id))
  const secs = myTurn && game.deadline ? Math.max(0, Math.ceil((game.deadline - now) / 1000)) : null
  const us = myTeam
  const them = 1 - myTeam

  return (
    <div className="sk-wrap">
      <div className="sk-score" data-testid="sk-score">
        <span className="sk-score__team sk-score__team--us"><small>Nós</small><b>{game.games[us]}</b></span>
        <span className="sk-score__mid">
          jogos (a {TARGET})
          <span className="sk-trump" data-testid="sk-trump">Trunfo: <b className={game.trump.suit === 'h' || game.trump.suit === 'd' ? 'sk-red' : ''}>{SUIT_SYMBOL[game.trump.suit]} {SUIT_NAME[game.trump.suit]}</b></span>
        </span>
        <span className="sk-score__team"><small>Eles</small><b>{game.games[them]}</b></span>
      </div>
      <div className="sk-table" data-testid="sk-table">
        <div className="sk-felt">
          <div className="sk-trick" data-testid="sk-trick">
            {shownTrick.map((t, i) => (
              <span key={t.card.id} className={`sk-trick__card sk-trick__card--${spotOf(t.id)}${i === winIdx ? ' sk-trick__card--win' : ''}`}>
                <Card card={t.card} />
              </span>
            ))}
          </div>
          <div className="sk-points">
            <span>Nós <b>{pts[us]}</b></span>
            <span>Eles <b>{pts[them]}</b></span>
          </div>
        </div>
        {rot.map((id) => (
          <Seat key={id} game={game} id={id} meId={meId} person={people(id)} spot={spotOf(id)} now={now} />
        ))}
      </div>

      {seated && (
        <div className={`sk-hand${myTurn ? ' sk-hand--turn' : ''}`} data-testid="sk-hand">
          {hand.map((c) => {
            const ok = legal.has(c.id)
            return (
              <button
                key={c.id}
                type="button"
                className={`sk-card${ok ? ' sk-card--legal' : ''}`}
                disabled={!ok}
                onClick={() => onAction({ type: 'play', card: c.id })}
                data-testid="sk-card"
                data-legal={ok ? '1' : '0'}
              >
                <Card card={c} dim={myTurn && !ok} />
              </button>
            )
          })}
        </div>
      )}
      <p className="game-status sk-status" data-testid="sk-status">
        {game.phase === 'play' && (myTurn ? `A tua vez${secs != null ? ` (${secs} s)` : ''}: escolhe uma carta${game.trick.length ? ' (tens de assistir ao naipe que saiu)' : ''}.` : `Vez de ${name(game.turn)}…`)}
        {game.phase === 'trick' && `${name(game.trick[winIdx].id)} ganha a vaza.`}
      </p>

      {(game.phase === 'end' || game.phase === 'over') && game.result && (
        <div className={`sk-end${game.result.team === us ? ' sk-end--win' : game.result.team === them ? ' sk-end--lose' : ''}`} data-testid="sk-end">
          <b>{game.result.team == null ? 'Empate a 60: ninguém ganha jogos' : (game.result.team === us ? KIND_US : KIND_THEM)[game.result.kind]}</b>
          <span>Pontos desta mão: nós {game.result.points[us]}, eles {game.result.points[them]}.</span>
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

const newBotGame = () => startGame(['tu', 'bot0', 'bot1', 'bot2'], ['bot0', 'bot1', 'bot2'], Date.now(), Math.random, { timed: false })

function VsBots() {
  // "Jogar já" (página inicial) abre logo uma partida.
  const [params] = useSearchParams()
  const [game, setGame] = useState(() => (params.get('jogar') ? newBotGame() : null))
  const [error, setError] = useState('')
  const now = useNow()
  const people = (id) => (id === 'tu' ? { name: 'Tu' } : botPerson(id))

  useEffect(() => {
    if (!game) return undefined
    const t = setInterval(() => setGame((g) => (g ? tick(g, Date.now()) : g)), 250)
    return () => clearInterval(t)
  }, [!!game]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (game?.phase === 'over') recordResultOnce(`sueca-bot-${Date.now()}`, 'sueca', game.winner === teamOf(game, 'tu'))
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
        <p className="game-status">Jogas com um bot como parceiro contra dois bots.</p>
        <p className="modal-note">Ganha a primeira equipa a fazer {TARGET} jogos.</p>
        <button
          className="share-btn"
          data-testid="sk-start"
          onClick={() => setGame(newBotGame())}
        >
          Começar partida
        </button>
      </div>
    )
  }
  const won = game.phase === 'over' && game.winner === teamOf(game, 'tu')
  return (
    <div className="game-panel game-panel--wide">
      <Table game={game} meId="tu" people={people} onAction={onAction} now={now}>
        {game.phase === 'end' && (
          <button className="mode-btn" onClick={() => onAction({ type: 'next' })} data-testid="sk-next">Próxima mão</button>
        )}
        {game.phase === 'over' && (
          <div className="pk-over" data-testid="sk-over">
            <h3>{won ? 'Ganhámos a partida!' : 'Perdemos a partida.'}</h3>
            <div className="game-actions">
              <button className="share-btn" onClick={() => gameBreak('sueca', () => onAction({ type: 'rematch' }))}>Nova partida</button>
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
    if (game.phase === 'over' && seated) recordResultOnce(`sueca-${state.code}-${game.handNo}-${game.games.join('.')}`, 'sueca', game.winner === teamOf(game, me.id))
  }, [game.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="game-panel game-panel--wide">
      <Table game={game} meId={me.id} people={people} onAction={dispatch} now={now}>
        {game.phase === 'end' && seated && (
          <button className="mode-btn" onClick={() => dispatch({ type: 'next' })} data-testid="sk-next">Próxima mão</button>
        )}
        {game.phase === 'over' && (
          <div className="pk-over" data-testid="sk-over">
            <h3>{seated ? (game.winner === teamOf(game, me.id) ? 'Ganhámos a partida!' : 'Perdemos a partida.') : 'Fim da partida'}</h3>
            {seated && <button className="share-btn" onClick={() => dispatch({ type: 'rematch' })}>Nova partida</button>}
          </div>
        )}
      </Table>
    </div>
  )
}

// Escolha do lobby (lida ao carregar em "Começar jogo").
const lobbyChoice = { together: true }
function LobbyTeams({ state, amHost }) {
  const [together, setTogether] = useState(true)
  lobbyChoice.together = together
  const n = state.players.length
  return (
    <div className="bomb-lobby-bots">
      <p className="modal-note">
        A Sueca joga-se a 4: {n >= 4 ? 'mesa completa.' : `os lugares que faltam (${4 - n}) ficam com bots.`}
      </p>
      {amHost && n === 2 && (
        <div className="bot-levels">
          <button type="button" className={`mode-btn${together ? ' mode-btn--active' : ''}`} onClick={() => setTogether(true)} data-testid="sk-together">Mesma equipa</button>
          <button type="button" className={`mode-btn${!together ? ' mode-btn--active' : ''}`} onClick={() => setTogether(false)} data-testid="sk-apart">Um contra o outro</button>
        </div>
      )}
    </div>
  )
}

const HELP = (
  <>
    <p>A Sueca joga-se a 4, em 2 equipas: o teu parceiro é quem está à tua frente. Usa-se um baralho de 40 cartas (sem 8, 9 e 10) e cada um recebe 10.</p>
    <p>A última carta de quem baralha é o <strong>trunfo</strong>. Na tua vez jogas uma carta; se tiveres do naipe que saiu, tens de <strong>assistir</strong>. Se não tiveres, podes cortar com trunfo ou largar outra carta.</p>
    <p>Ganha a vaza o trunfo mais alto ou, sem trunfos, a carta mais alta do naipe que saiu. Força das cartas: Ás, 7, Rei, Valete, Dama, 6, 5, 4, 3, 2.</p>
    <p>Pontos: Ás 11, 7 10, Rei 4, Valete 3, Dama 2. Há 120 pontos por mão: mais de 60 vale 1 jogo, 91 ou mais vale 2 (capote) e as 120 valem 4 (bandeira). Ganha a primeira equipa a {TARGET} jogos.</p>
  </>
)

export default function SuecaGame() {
  return (
    <GameShell
      game="sueca"
      title="Sueca"
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
            game="sueca"
            logic={suecaOnline}
            renderLobbyOptions={(props) => <LobbyTeams {...props} />}
            prepareStart={() => ({ together: lobbyChoice.together })}
            renderGame={(props) => <OnlineBoard {...props} />}
          />
        )
      }
    </GameShell>
  )
}
