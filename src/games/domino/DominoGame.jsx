import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import { gameBreak } from '../../lib/ads.js'
import Tile from './Tile.jsx'
import { recordResultOnce } from '../../lib/social.js'
import { BOT_NAMES, TARGET, TURN_MS, startGame, applyAction, tick, sidesFor, canPlay, ends, handPips, sideOf, teams, dominoOnline } from './dominoLogic.js'

const botPerson = (id) => ({ name: BOT_NAMES[Number(id.slice(3))] || 'Bot', seed: id })
function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  return now
}

function Player({ game, id, meId, person, now }) {
  const me = id === meId
  const turn = game.turn === id
  const n = game.hands[id]?.length || 0
  const left = turn && game.deadline && !me ? Math.max(0, game.deadline - now) : 0
  const partner = teams(game) && !me && sideOf(game, id) === sideOf(game, meId)
  return (
    <div className={`dm-player${turn ? ' dm-player--turn' : ''}${partner ? ' dm-player--partner' : ''}`} data-testid={me ? 'dm-player-me' : 'dm-player'}>
      <Avatar src={person?.avatar} seed={person?.seed || id} name={person?.name} size={30} />
      <span className="dm-player__info">
        <b>{me ? 'Tu' : person?.name || 'Jogador'}</b>
        <small>{n} {n === 1 ? 'pedra' : 'pedras'}{teams(game) && !me && <span className="dm-role">{partner ? ' · parceiro' : ' · adversário'}</span>}</small>
      </span>
      {!me && (
        <span className="dm-backs" aria-hidden="true">
          {Array.from({ length: Math.min(n, 7) }, (_, i) => <i key={i} />)}
        </span>
      )}
      {left > 0 && <span className="pk-timer" style={{ '--t': left / TURN_MS }} />}
    </div>
  )
}

function Table({ game, meId, people, onAction, now, children }) {
  const [picked, setPicked] = useState(null) // pedra escolhida que encaixa dos dois lados
  const n = game.order.length
  const at = Math.max(0, game.order.indexOf(meId))
  const seated = game.order.includes(meId)
  const rot = game.order.map((_, k) => game.order[(at + k) % n])
  const others = seated ? rot.slice(1) : rot
  const myTurn = game.phase === 'play' && game.turn === meId
  const hand = game.hands[meId] || []
  const e = ends(game)
  const name = (id) => (id === meId ? 'Tu' : people(id)?.name || 'Jogador')
  const fmt = (msg) => msg.replace(/@([\w-]+)/g, (_, id) => name(id))
  const secs = myTurn && game.deadline ? Math.max(0, Math.ceil((game.deadline - now) / 1000)) : null
  const stuck = myTurn && !canPlay(game, meId)
  const mySide = seated ? sideOf(game, meId) : 0
  const sideName = (s) => (teams(game) ? (s === mySide ? 'Nós' : 'Eles') : name(game.order[s]))

  useEffect(() => setPicked(null), [game.turn, game.seq])

  const choose = (t) => {
    const sides = sidesFor(game, t)
    if (!myTurn || !sides.length) return
    // Encaixa dos dois lados com resultados diferentes: pergunta onde.
    if (sides.length === 2 && e && e[0] !== e[1]) setPicked(t.id)
    else onAction({ type: 'play', tile: t.id, side: sides[0] })
  }

  return (
    <div className="dm-wrap">
      <div className="dm-scores" data-testid="dm-scores">
        {game.scores.map((s, i) => (
          <span key={i} className={`dm-score${i === mySide && seated ? ' dm-score--me' : ''}`}>
            <small>{sideName(i)}</small>
            <b>{s}</b>
          </span>
        ))}
        <span className="dm-score dm-score--target"><small>a</small><b>{game.target}</b></span>
      </div>
      <div className="dm-players">
        {others.map((id) => <Player key={id} game={game} id={id} meId={meId} person={people(id)} now={now} />)}
      </div>

      <div className="dm-board" data-testid="dm-board">
        {game.chain.length === 0 ? (
          <p className="dm-board__empty">{game.turn ? `${name(game.turn)} começa${game.mustPlay ? ` com o duplo ${game.mustPlay.split('-')[0]}` : ''}.` : ''}</p>
        ) : (
          <div className="dm-chain" data-testid="dm-chain">
            {picked && (
              <button type="button" className="dm-end dm-end--pick" onClick={() => onAction({ type: 'play', tile: picked, side: 'L' })} data-testid="dm-left">◀ aqui</button>
            )}
            {game.chain.map((c, i) => (
              <Tile key={c.id} l={c.l} r={c.r} vertical={c.l === c.r} className={i === 0 || i === game.chain.length - 1 ? 'dm-tile--end' : ''} />
            ))}
            {picked && (
              <button type="button" className="dm-end dm-end--pick" onClick={() => onAction({ type: 'play', tile: picked, side: 'R' })} data-testid="dm-right">aqui ▶</button>
            )}
          </div>
        )}
        {e && <p className="dm-ends">Pontas: <b>{e[0]}</b> e <b>{e[1]}</b>{game.boneyard.length > 0 && <> · monte: <b data-testid="dm-boneyard">{game.boneyard.length}</b></>}</p>}
      </div>

      {seated && (
        <>
          <div className={`dm-hand${myTurn ? ' dm-hand--turn' : ''}`} data-testid="dm-hand">
            {hand.map((t) => {
              const ok = myTurn && sidesFor(game, t).length > 0
              return (
                <button key={t.id} type="button" className={`dm-pick${ok ? ' dm-pick--ok' : ''}${picked === t.id ? ' dm-pick--on' : ''}`} disabled={!ok} onClick={() => choose(t)} data-testid="dm-tile" data-ok={ok ? '1' : '0'}>
                  <Tile l={t.a} r={t.b} vertical />
                </button>
              )
            })}
          </div>
          <div className="dm-actions">
            {stuck && game.boneyard.length > 0 && <button type="button" className="share-btn" onClick={() => onAction({ type: 'draw' })} data-testid="dm-draw">Comprar pedra</button>}
            {stuck && !game.boneyard.length && <button type="button" className="share-btn" onClick={() => onAction({ type: 'pass' })} data-testid="dm-pass">Passar</button>}
            {picked && <button type="button" className="link-btn" onClick={() => setPicked(null)}>Cancelar</button>}
          </div>
          <p className="game-status sk-status" data-testid="dm-status">
            {game.phase === 'play' &&
              (myTurn
                ? stuck
                  ? game.boneyard.length ? 'Não tens pedras que encaixem: compra do monte.' : 'Não tens pedras que encaixem: passa a vez.'
                  : picked
                    ? 'Encaixa dos dois lados: escolhe a ponta.'
                    : `A tua vez${secs != null ? ` (${secs} s)` : ''}: toca numa pedra que encaixe.`
                : `Vez de ${name(game.turn)}…`)}
          </p>
          <p className="modal-note">Pontos na tua mão: {handPips(hand)}</p>
        </>
      )}

      {(game.phase === 'end' || game.phase === 'over') && game.result && (
        <div className={`sk-end${game.result.side === mySide ? ' sk-end--win' : game.result.side != null ? ' sk-end--lose' : ''}`} data-testid="dm-end">
          <b>
            {game.result.side == null
              ? 'Jogo fechado e empatado: ninguém marca'
              : game.result.how === 'domino'
                ? `${name(game.result.winnerId)} ${game.result.winnerId === meId ? 'fizeste' : 'fez'} dominó! +${game.result.points} para ${sideName(game.result.side)}`
                : `Jogo fechado: ${sideName(game.result.side)} com menos pontos. +${game.result.points}`}
          </b>
          <span>Pontos que ficaram nas mãos: {game.result.pips.map((p, i) => `${sideName(i)} ${p}`).join(', ')}.</span>
        </div>
      )}
      {children}
      {game.log.length > 0 && (
        <ul className="sk-log">
          {game.log.slice(0, 4).map((m, i) => <li key={i}>{fmt(m)}</li>)}
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
    const t = setInterval(() => setGame((g) => (g ? tick(g, Date.now()) : g)), 200)
    return () => clearInterval(t)
  }, [!!game]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (game?.phase === 'over') recordResultOnce(`domino-bot-${Date.now()}`, 'domino', game.winner === sideOf(game, 'tu'))
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
        <p className="game-status">Com quantos jogadores?</p>
        <div className="bot-levels">
          {[2, 3, 4].map((k) => (
            <button key={k} className={`mode-btn${seats === k ? ' mode-btn--active' : ''}`} onClick={() => setSeats(k)} data-testid={`dm-seats-${k}`}>{k === 4 ? '4 (equipas)' : k}</button>
          ))}
        </div>
        <p className="modal-note">
          {seats === 4 ? 'Tu e um bot contra dois bots, sem monte: quem não pode jogar passa.' : `Tu contra ${seats - 1} ${seats === 2 ? 'bot' : 'bots'}, com monte para comprar.`} Ganha quem chegar primeiro a {TARGET} pontos.
        </p>
        <button className="share-btn" data-testid="dm-start" onClick={() => setGame(newBotGame(seats))}>Começar partida</button>
      </div>
    )
  }
  const won = game.phase === 'over' && game.winner === sideOf(game, 'tu')
  return (
    <div className="game-panel game-panel--wide">
      <Table game={game} meId="tu" people={people} onAction={onAction} now={now}>
        {game.phase === 'end' && <button className="mode-btn" onClick={() => onAction({ type: 'next' })} data-testid="dm-next">Próxima mão</button>}
        {game.phase === 'over' && (
          <div className="pk-over" data-testid="dm-over">
            <h3>{won ? 'Ganhaste a partida!' : 'Perdeste a partida.'}</h3>
            <div className="game-actions">
              <button className="share-btn" onClick={() => gameBreak('domino', () => onAction({ type: 'rematch' }))}>Nova partida</button>
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
    if (game.phase === 'over' && seated) recordResultOnce(`domino-${state.code}-${game.handNo}-${game.scores.join('.')}`, 'domino', game.winner === sideOf(game, me.id))
  }, [game.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="game-panel game-panel--wide">
      <Table game={game} meId={me.id} people={people} onAction={dispatch} now={now}>
        {game.phase === 'end' && seated && <button className="mode-btn" onClick={() => dispatch({ type: 'next' })} data-testid="dm-next">Próxima mão</button>}
        {game.phase === 'over' && (
          <div className="pk-over" data-testid="dm-over">
            <h3>{seated ? (game.winner === sideOf(game, me.id) ? 'Ganhaste a partida!' : 'Perdeste a partida.') : 'Fim da partida'}</h3>
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
  const n = state.players.length
  const shown = Math.max(n, seats)
  lobbyChoice.seats = shown
  return (
    <div className="bomb-lobby-bots">
      <p className="modal-note">
        Mesa de {shown}{shown === 4 ? ' (equipas de 2)' : ''}{shown > n ? `: ${shown - n === 1 ? 'o lugar que falta fica' : `os ${shown - n} lugares que faltam ficam`} com bots` : ''}.
      </p>
      {amHost && n < 4 && (
        <div className="bot-levels">
          {[2, 3, 4].filter((k) => k >= n).map((k) => (
            <button key={k} type="button" className={`mode-btn${shown === k ? ' mode-btn--active' : ''}`} onClick={() => setSeats(k)} data-testid={`dm-lobby-${k}`}>{k}</button>
          ))}
        </div>
      )}
    </div>
  )
}

const HELP = (
  <>
    <p>Joga-se com as 28 pedras do duplo seis. A 2 ou 3 jogadores cada um recebe 7 pedras e o resto fica no monte; a 4 joga-se em equipas (o parceiro é quem está à tua frente na ordem) e não há monte.</p>
    <p>Na tua vez, encosta uma pedra a uma das pontas: o número tem de ser igual. Se nenhuma encaixar, <strong>compras</strong> do monte até poderes jogar; sem monte, <strong>passas</strong>.</p>
    <p>Na 1.ª mão começa quem tem o duplo mais alto. A mão acaba quando alguém fica sem pedras (<strong>dominó</strong>) ou quando ninguém pode jogar (<strong>jogo fechado</strong>, ganha quem tem menos pontos na mão).</p>
    <p>Quem ganha a mão soma os pontos das pedras que ficaram aos adversários. Ganha a partida quem chegar primeiro a {TARGET} pontos.</p>
  </>
)

export default function DominoGame() {
  return (
    <GameShell
      game="domino"
      title="Dominó"
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
            game="domino"
            logic={dominoOnline}
            renderLobbyOptions={(props) => <LobbySeats {...props} />}
            prepareStart={() => ({ seats: lobbyChoice.seats, together: lobbyChoice.together })}
            renderGame={(props) => <OnlineBoard {...props} />}
          />
        )
      }
    </GameShell>
  )
}
