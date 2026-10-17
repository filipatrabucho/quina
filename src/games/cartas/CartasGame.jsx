import { useEffect, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import { recordResultOnce } from '../../lib/social.js'
import { COLORS, COLOR_NAMES, canPlay, currentPlayer, startGame, applyMove, botMove, rematch, cartasOnline } from './cartasLogic.js'

const SYMBOL = { saltar: '⊘', inverter: '⇄', '+2': '+2', cor: '', '+4': '+4' }
const LABEL = { saltar: 'Saltar', inverter: 'Inverter', '+2': 'Mais dois', cor: 'Muda a cor', '+4': 'Mais quatro' }

export function Card({ card, onClick, playable, small, back, testid }) {
  if (back) {
    return (
      <button className={`card card--back${small ? ' card--small' : ''}`} onClick={onClick} disabled={!onClick} data-testid={testid} aria-label="Baralho">
        <span className="card__back-logo">Q</span>
      </button>
    )
  }
  const wild = card.color === null
  const sym = SYMBOL[card.value] ?? card.value
  return (
    <button
      className={`card card--${wild ? 'wild' : card.color}${playable ? ' card--playable' : ''}${small ? ' card--small' : ''}`}
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${wild ? '' : COLOR_NAMES[card.color] + ' '}${LABEL[card.value] || card.value}`}
      data-testid={testid}
    >
      <span className="card__corner">{sym || '★'}</span>
      <span className="card__oval">{wild ? <span className="card__wheel" /> : null}<b>{sym}</b></span>
      <span className="card__corner card__corner--br">{sym || '★'}</span>
    </button>
  )
}

function ColorPicker({ onPick, onCancel }) {
  return (
    <div className="card-colorpick" role="dialog" aria-label="Escolhe a cor">
      <p>Escolhe a cor</p>
      <div>
        {COLORS.map((c) => (
          <button key={c} className={`card-colorpick__btn card-colorpick__btn--${c}`} onClick={() => onPick(c)} aria-label={COLOR_NAMES[c]} />
        ))}
      </div>
      <button className="link-btn" onClick={onCancel}>Cancelar</button>
    </div>
  )
}

// Mesa: adversários em cima, baralho e pilha ao centro, a minha mão em baixo.
function Table({ game, meId, people, onMove, isOnline }) {
  const [picking, setPicking] = useState(null) // carta coringa à espera da cor
  const myTurn = !game.winner && currentPlayer(game) === meId
  const top = game.discard[game.discard.length - 1]
  const hand = game.hands[meId] || []
  const others = game.order.filter((id) => id !== meId)
  const name = (id) => (id === meId ? 'Tu' : people(id)?.name || 'Jogador')
  const usable = (c) => myTurn && canPlay(c, top, game.color) && (game.drawnThisTurn == null || c.id === game.drawnThisTurn)
  const last = game.lastAction

  // Lugares à volta da mesa, por ordem de jogo a partir de mim:
  // esquerda (de baixo para cima), topo (da esquerda para a direita), direita.
  const myPos = game.order.indexOf(meId)
  const rotated = myPos >= 0 ? [...game.order.slice(myPos + 1), ...game.order.slice(0, myPos)] : others
  const side = rotated.length >= 5 ? 2 : rotated.length >= 2 ? 1 : 0
  const seats = {
    left: rotated.slice(0, side).reverse(),
    top: rotated.slice(side, rotated.length - side),
    right: rotated.slice(rotated.length - side),
  }
  const renderSeat = (id) => {
    const p = people(id)
    const n = game.hands[id]?.length || 0
    const turn = currentPlayer(game) === id && !game.winner
    return (
      <div key={id} className={`cards-seat${turn ? ' cards-seat--turn' : ''}${game.winner === id ? ' cards-seat--winner' : ''}`} data-testid={`seat-${id}`}>
        {turn && <span className="cards-seat__badge">A jogar</span>}
        <Avatar src={p?.avatar} seed={p?.seed || id} name={p?.name} size={44} />
        <span className="cards-seat__name">{p?.name || 'Jogador'}{isOnline && !isOnline(id) ? ' · offline' : ''}</span>
        <span className="cards-seat__fan" aria-hidden="true">
          {Array.from({ length: Math.min(n, 7) }, (_, k) => <i key={k} style={{ '--k': k - (Math.min(n, 7) - 1) / 2 }} />)}
        </span>
        <span className="cards-opp__count" data-testid={`count-${id}`}>{n} {n === 1 ? 'carta' : 'cartas'}</span>
        {n === 1 && !game.winner && <span className="cards-last">Última!</span>}
      </div>
    )
  }

  const play = (card) => {
    if (!usable(card)) return
    if (card.color === null) setPicking(card)
    else onMove({ type: 'play', cardId: card.id })
  }

  return (
    <div className="cards-table">
      <div className="cards-arena">
        <div className="cards-seats cards-seats--top">{seats.top.map(renderSeat)}</div>
        <div className="cards-seats cards-seats--left">{seats.left.map(renderSeat)}</div>
        <div className="cards-center">
          <div className="cards-pile">
            <Card back onClick={myTurn && game.drawnThisTurn == null ? () => onMove({ type: 'draw' }) : undefined} testid="cards-draw" />
            <span className="cards-pile__label">{game.drawPile.length}</span>
          </div>
          <div className="cards-pile">
            <Card card={top} testid="cards-top" />
            <span className={`cards-color cards-color--${game.color}`}>{COLOR_NAMES[game.color]}</span>
          </div>
          <span className="cards-direction" title="Sentido do jogo">{game.direction === 1 ? '↻' : '↺'}</span>
        </div>

        <div className="cards-seats cards-seats--right">{seats.right.map(renderSeat)}</div>
      </div>

      <p className="game-status" data-testid="cards-status">
        {game.winner
          ? game.winner === meId ? 'Ganhaste! Ficaste sem cartas.' : `${name(game.winner)} ganhou a partida.`
          : myTurn
            ? game.drawnThisTurn != null ? 'Podes jogar a carta que compraste ou passar.' : 'É a tua vez: joga uma carta ou compra do baralho.'
            : `Vez de ${name(currentPlayer(game))}…`}
      </p>
      {last && !game.winner && (
        <p className="naval-log">
          {name(last.by)} {last.type === 'jogou' ? `jogou ${last.card.color ? COLOR_NAMES[last.card.color] + ' ' : ''}${LABEL[last.card.value]?.toLowerCase() || last.card.value}` : last.type === 'comprou' ? 'comprou uma carta' : 'passou'}
        </p>
      )}

      <div className={`cards-hand${myTurn ? ' cards-hand--turn' : ''}`} data-testid="cards-hand">
        {myTurn && <span className="cards-seat__badge cards-hand__badge">A tua vez</span>}
        {hand.map((c) => (
          <Card key={c.id} card={c} playable={usable(c)} onClick={usable(c) ? () => play(c) : undefined} testid={`card-${c.id}`} />
        ))}
      </div>
      {myTurn && game.drawnThisTurn != null && (
        <button className="mode-btn" onClick={() => onMove({ type: 'pass' })} data-testid="cards-pass">Passar</button>
      )}
      {picking && (
        <ColorPicker
          onPick={(color) => {
            onMove({ type: 'play', cardId: picking.id, color })
            setPicking(null)
          }}
          onCancel={() => setPicking(null)}
        />
      )}
    </div>
  )
}

const BOT_NAMES = ['Bot Rita', 'Bot Zé', 'Bot Inês']

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
    const t = setTimeout(() => setGame((g) => (g && !g.winner && currentPlayer(g) === p ? applyMove(g, p, botMove(g, p)) : g)), 900)
    return () => clearTimeout(t)
  }, [game])

  useEffect(() => {
    if (game?.winner) recordResultOnce(`cartas-bot-${Date.now()}`, 'cartas', game.winner === 'tu')
  }, [game?.winner]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!game) {
    return (
      <div className="game-panel">
        <p className="game-status">Contra quantos bots queres jogar?</p>
        <div className="bot-levels">
          {[1, 2, 3].map((n) => (
            <button key={n} className={`mode-btn${bots === n ? ' mode-btn--active' : ''}`} onClick={() => setBots(n)}>
              {n} {n === 1 ? 'bot' : 'bots'}
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
    if (game.winner && seated) recordResultOnce(`cartas-${state.code}-${game.round}`, 'cartas', game.winner === me.id)
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
    <p>Joga uma carta da mesma cor ou com o mesmo número/símbolo da carta da mesa. Se não tiveres nenhuma, compra uma do baralho.</p>
    <p><strong>⊘ Saltar</strong>: o próximo perde a vez. <strong>⇄ Inverter</strong>: muda o sentido. <strong>+2</strong>: o próximo compra 2 e perde a vez.</p>
    <p><strong>Muda a cor</strong> e <strong>+4</strong> servem em qualquer altura e escolhes a cor seguinte. Ganha quem ficar sem cartas primeiro.</p>
  </>
)

export default function CartasGame() {
  return (
    <GameShell
      game="cartas"
      title="Cartas Coloridas"
      help={HELP}
      modes={[
        { key: 'bot', label: 'vs Bots' },
        { key: 'online', label: 'Multiplayer' },
      ]}
    >
      {(mode) => (mode === 'bot' ? <VsBots /> : <OnlineGame game="cartas" logic={cartasOnline} renderGame={(props) => <OnlineBoard {...props} />} />)}
    </GameShell>
  )
}
