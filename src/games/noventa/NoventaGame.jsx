import { useEffect, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import { recordResultOnce } from '../../lib/social.js'
import { LIMIT, LIVES, SUIT_SYMBOL, alive, cardOptions, currentPlayer, startGame, applyMove, botMove, rematch, noventaOnline } from './noventaLogic.js'

const EFFECT = { A: '+1 ou +11', '4': 'Inverte', '9': '+0', '10': '−10 ou +10', J: '+10', Q: '+10', K: '= 99' }

export function PlayingCard({ card, onClick, playable, dead, testid }) {
  const red = card.suit === 'h' || card.suit === 'd'
  return (
    <button
      className={`pcard${red ? ' pcard--red' : ''}${playable ? ' pcard--playable' : ''}${dead ? ' pcard--dead' : ''}`}
      onClick={onClick}
      disabled={!onClick}
      data-testid={testid}
      aria-label={`${card.rank} de ${SUIT_SYMBOL[card.suit]}`}
    >
      <span className="pcard__corner">{card.rank}<br />{SUIT_SYMBOL[card.suit]}</span>
      <span className="pcard__suit">{SUIT_SYMBOL[card.suit]}</span>
      {EFFECT[card.rank] && <span className="pcard__effect">{EFFECT[card.rank]}</span>}
      <span className="pcard__corner pcard__corner--br">{card.rank}<br />{SUIT_SYMBOL[card.suit]}</span>
    </button>
  )
}

function Lives({ n }) {
  return (
    <span className="ninety-lives" aria-label={`${n} vidas`}>
      {Array.from({ length: LIVES }, (_, k) => <i key={k} className={k < n ? 'on' : ''} />)}
    </span>
  )
}

function Table({ game, meId, people, onMove, isOnline }) {
  const [choosing, setChoosing] = useState(null)
  const myTurn = !game.winner && currentPlayer(game) === meId
  const hand = game.hands[meId] || []
  const name = (id) => (id === meId ? 'Tu' : people(id)?.name || 'Jogador')
  const top = game.discard[game.discard.length - 1]
  const last = game.lastAction
  const lost = game.lostLife

  const myPos = game.order.indexOf(meId)
  const others = game.order.filter((id) => id !== meId)
  const rotated = myPos >= 0 ? [...game.order.slice(myPos + 1), ...game.order.slice(0, myPos)] : others
  const side = rotated.length >= 5 ? 2 : rotated.length >= 2 ? 1 : 0
  const seats = {
    left: rotated.slice(0, side).reverse(),
    top: rotated.slice(side, rotated.length - side),
    right: rotated.slice(rotated.length - side),
  }
  const renderSeat = (id) => {
    const p = people(id)
    const out = !alive(game, id)
    const turn = currentPlayer(game) === id && !game.winner
    return (
      <div key={id} className={`cards-seat${turn ? ' cards-seat--turn' : ''}${game.winner === id ? ' cards-seat--winner' : ''}${out ? ' cards-seat--out' : ''}`} data-testid={`seat-${id}`}>
        {turn && <span className="cards-seat__badge">A jogar</span>}
        <Avatar src={p?.avatar} seed={p?.seed || id} name={p?.name} size={44} />
        <span className="cards-seat__name">{p?.name || 'Jogador'}{isOnline && !isOnline(id) ? ' · offline' : ''}</span>
        {out ? <span className="cards-opp__count">Eliminado</span> : <Lives n={game.lives[id]} />}
      </div>
    )
  }

  const play = (card) => {
    const opts = cardOptions(card, game.total)
    if (!myTurn || !opts.length) return
    if (opts.length > 1) setChoosing({ card, opts })
    else onMove({ type: 'play', cardId: card.id, mode: opts[0].mode })
  }
  const danger = game.total >= 90 ? ' ninety-total--danger' : game.total >= 75 ? ' ninety-total--warm' : ''

  return (
    <div className="cards-table ninety">
      <div className="cards-arena">
        <div className="cards-seats cards-seats--top">{seats.top.map(renderSeat)}</div>
        <div className="cards-seats cards-seats--left">{seats.left.map(renderSeat)}</div>
        <div className="cards-center ninety-center">
          <div className={`ninety-total${danger}`} data-testid="ninety-total">
            <b>{game.total}</b>
            <span>de {LIMIT}</span>
          </div>
          <div className="ninety-discard">
            {top ? <PlayingCard card={top} testid="ninety-top" /> : <span className="ninety-empty">Mão nova</span>}
          </div>
          <span className="cards-direction" title="Sentido do jogo">{game.direction === 1 ? '↻' : '↺'}</span>
        </div>
        <div className="cards-seats cards-seats--right">{seats.right.map(renderSeat)}</div>
      </div>

      {lost && lost.hand === game.hand - 1 && !game.winner && (
        <p className="ninety-alert" data-testid="ninety-alert">
          {lost.id === meId ? 'Não conseguias jogar' : `${name(lost.id)} não conseguia jogar`} com {lost.total} na mesa e {lost.id === meId ? 'perdeste' : 'perdeu'} uma vida. Mão nova!
        </p>
      )}
      <p className="game-status" data-testid="ninety-status">
        {game.winner
          ? game.winner === meId ? 'Ganhaste! Foste o último a ficar com vidas.' : `${name(game.winner)} ganhou a partida.`
          : !alive(game, meId) && myPos >= 0
            ? 'Ficaste sem vidas. Vê o resto da partida.'
            : myTurn
              ? `É a tua vez. Joga uma carta sem passar dos ${LIMIT}.`
              : `Vez de ${name(currentPlayer(game))}…`}
      </p>
      {last && !game.winner && game.discard.length > 0 && (
        <p className="naval-log">{name(last.by)} jogou {last.card.rank}{SUIT_SYMBOL[last.card.suit]} ({last.label}) e o total ficou em {last.total}</p>
      )}

      {myPos >= 0 && alive(game, meId) && (
        <div className={`cards-hand${myTurn ? ' cards-hand--turn' : ''}`} data-testid="ninety-hand">
          {myTurn && <span className="cards-seat__badge cards-hand__badge">A tua vez</span>}
          {hand.map((c) => {
            const ok = cardOptions(c, game.total).length > 0
            return <PlayingCard key={c.id} card={c} playable={myTurn && ok} dead={myTurn && !ok} onClick={myTurn && ok ? () => play(c) : undefined} testid={`pcard-${c.id}`} />
          })}
        </div>
      )}
      <div className="cards-life-row">
        <span>As tuas vidas:</span> <Lives n={game.lives[meId] || 0} />
      </div>

      {choosing && (
        <div className="card-colorpick" role="dialog" aria-label="Como queres jogar">
          <p>{choosing.card.rank}{SUIT_SYMBOL[choosing.card.suit]}: como queres jogar?</p>
          <div>
            {choosing.opts.map((o) => (
              <button
                key={o.mode}
                className="mode-btn"
                data-testid={`ninety-opt-${o.mode}`}
                onClick={() => {
                  onMove({ type: 'play', cardId: choosing.card.id, mode: o.mode })
                  setChoosing(null)
                }}
              >
                {o.label} <small>({o.total})</small>
              </button>
            ))}
          </div>
          <button className="link-btn" onClick={() => setChoosing(null)}>Cancelar</button>
        </div>
      )}
    </div>
  )
}

const BOT_NAMES = ['Bot Rita', 'Bot Zé', 'Bot Inês', 'Bot Rui', 'Bot Ana']

function VsBots() {
  const [bots, setBots] = useState(2)
  const [game, setGame] = useState(null)
  const [error, setError] = useState('')
  const ids = ['tu', ...BOT_NAMES.slice(0, bots).map((_, i) => `bot${i}`)]
  const people = (id) => (id === 'tu' ? { name: 'Tu' } : { name: BOT_NAMES[Number(id.slice(3))], seed: id })

  useEffect(() => {
    if (!game || game.winner) return undefined
    const p = currentPlayer(game)
    if (p === 'tu') return undefined
    const t = setTimeout(() => setGame((g) => (g && !g.winner && currentPlayer(g) === p ? applyMove(g, p, botMove(g, p)) : g)), 1000)
    return () => clearTimeout(t)
  }, [game])

  useEffect(() => {
    if (game?.winner) recordResultOnce(`noventa-bot-${Date.now()}`, 'noventa', game.winner === 'tu')
  }, [game?.winner]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!game) {
    return (
      <div className="game-panel">
        <p className="game-status">Contra quantos bots queres jogar?</p>
        <div className="bot-levels">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={`mode-btn${bots === n ? ' mode-btn--active' : ''}`} onClick={() => setBots(n)}>
              {n}
            </button>
          ))}
        </div>
        <button className="share-btn" onClick={() => setGame(startGame(ids))}>Começar</button>
      </div>
    )
  }

  return (
    <div className="game-panel game-panel--wide">
      <Table
        game={game}
        meId="tu"
        people={people}
        onMove={(move) => {
          setError('')
          try {
            setGame(applyMove(game, 'tu', move))
          } catch (e) {
            setError(e.message)
          }
        }}
      />
      {error && <p className="duel-error">{error}</p>}
      {game.winner && (
        <div className="game-actions">
          <button className="share-btn" onClick={() => setGame(rematch(game))}>Jogar outra vez</button>
          <button className="mode-btn" onClick={() => setGame(null)}>Mudar nº de bots</button>
        </div>
      )}
    </div>
  )
}

function OnlineBoard({ state, game, me, dispatch, isOnline }) {
  const people = (id) => state.players.find((p) => p.id === id)
  const seated = game.order.includes(me.id)
  useEffect(() => {
    if (game.winner && seated) recordResultOnce(`noventa-${state.code}-${game.round}`, 'noventa', game.winner === me.id)
  }, [game.winner, game.round]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="game-panel game-panel--wide">
      <div className="cards-score">
        {game.order.map((id) => (
          <span key={id}>{id === me.id ? 'Tu' : people(id)?.name}: <strong>{game.score[id] || 0}</strong></span>
        ))}
      </div>
      <Table game={game} meId={me.id} people={people} onMove={dispatch} isOnline={isOnline} />
      {game.winner && seated && <button className="share-btn" onClick={() => dispatch({ type: 'rematch' })}>Jogar outra vez</button>}
    </div>
  )
}

const HELP = (
  <>
    <p>Cada carta que jogas soma ao total da mesa. Depois de jogares compras outra, ficas sempre com 3.</p>
    <p>Cartas especiais: <strong>A</strong> vale 1 ou 11, <strong>4</strong> inverte o sentido e vale 0, <strong>9</strong> vale 0, <strong>10</strong> tira ou soma 10, <strong>J</strong> e <strong>Q</strong> valem 10 e o <strong>K</strong> põe o total logo em 99.</p>
    <p>Se na tua vez nenhuma carta der para jogar sem passar dos 99, perdes uma das 3 vidas e começa uma mão nova. Ganha o último com vidas.</p>
  </>
)

export default function NoventaGame() {
  return (
    <GameShell
      game="noventa"
      title="99"
      help={HELP}
      modes={[
        { key: 'bot', label: 'vs Bots' },
        { key: 'online', label: 'Multiplayer' },
      ]}
    >
      {(mode) => (mode === 'bot' ? <VsBots /> : <OnlineGame game="noventa" logic={noventaOnline} renderGame={(props) => <OnlineBoard {...props} />} />)}
    </GameShell>
  )
}
