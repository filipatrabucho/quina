import { useEffect, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import Card from '../../components/Card.jsx'
import { gameBreak } from '../../lib/ads.js'
import { recordResultOnce } from '../../lib/social.js'
import { MIN_BET, MAX_BET, START_CHIPS, handValue, isBlackjack, startGame, applyAction, canDouble, canSplit, blackjackOnline } from './blackjackLogic.js'

const CHIPS = [10, 25, 50, 100, 500]
const OUTCOME = { ganhou: 'Ganhou', perdeu: 'Perdeu', empate: 'Empate', rebentou: 'Rebentou', blackjack: 'Blackjack!' }

function Chip({ value, onClick, disabled }) {
  return (
    <button type="button" className={`bj-chip bj-chip--${value}`} onClick={onClick} disabled={disabled} aria-label={`Apostar mais ${value}`} data-testid={`bj-chip-${value}`}>
      {value}
    </button>
  )
}

function Hand({ hand, active, result, label }) {
  const v = handValue(hand.cards)
  return (
    <div className={`bj-hand${active ? ' bj-hand--active' : ''}`}>
      <div className="bj-cards">
        {hand.cards.map((c, i) => (
          <span key={c.id + '-' + i} className="card-deal" style={{ animationDelay: `${i * 0.05}s` }}><Card card={c} /></span>
        ))}
      </div>
      <div className="bj-hand__info">
        {label && <span className="bj-hand__label">{label}</span>}
        <b className={v.total > 21 ? 'bj-bust' : ''}>{isBlackjack(hand) ? 'Blackjack' : `${v.soft && v.total < 21 ? `${v.total - 10}/` : ''}${v.total}`}</b>
        <span className="bj-hand__bet">{hand.bet} fichas{hand.doubled ? ' (dobrou)' : ''}</span>
        {result && <span className={`bj-out bj-out--${result.outcome}`}>{OUTCOME[result.outcome]}</span>}
      </div>
    </div>
  )
}

function Table({ game, meId, people, onAction, now }) {
  const [bet, setBet] = useState(0)
  const me = game.order.includes(meId)
  const chips = game.chips[meId] ?? 0
  const myHands = game.hands[meId] || []
  const myTurn = game.turn?.id === meId
  const showHole = game.phase === 'done'
  const dealerVal = showHole ? handValue(game.dealer).total : game.dealer[0] ? handValue([game.dealer[0]]).total : 0
  const name = (id) => (id === meId ? 'Tu' : people(id)?.name || 'Jogador')
  const others = game.order.filter((id) => id !== meId)
  const myResult = game.results?.[meId]
  const secs = game.deadline ? Math.max(0, Math.ceil((game.deadline - now) / 1000)) : null

  useEffect(() => {
    if (game.phase === 'bet') setBet(Math.min(game.lastBet?.[meId] || 0, chips, MAX_BET))
  }, [game.phase, game.round]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bj-table" data-testid="bj-table">
      <div className="bj-dealer">
        <span className="bj-seat-label">Banca {game.dealer.length > 0 && <b data-testid="bj-dealer-value">{dealerVal}</b>}</span>
        <div className="bj-cards">
          {game.dealer.map((c, i) => (
            <span key={c.id + '-' + i} className="card-deal" style={{ animationDelay: `${i * 0.08}s` }}>
              <Card card={c} hidden={i === 1 && !showHole} />
            </span>
          ))}
        </div>
        {game.reshuffled && game.phase !== 'bet' && <span className="bj-note">Cartas novas: o sapato foi baralhado.</span>}
      </div>

      {others.length > 0 && (
        <div className="bj-others">
          {others.map((id) => {
            const p = people(id)
            const hs = game.hands[id] || []
            const r = game.results?.[id]
            return (
              <div key={id} className={`bj-other${game.turn?.id === id ? ' bj-other--turn' : ''}`}>
                <Avatar src={p?.avatar} seed={p?.seed || id} name={p?.name} size={28} />
                <span className="bj-other__name">{name(id)}</span>
                <span className="bj-other__chips">{game.chips[id]} 🪙</span>
                {hs.map((h, i) => (
                  <span key={i} className="bj-other__hand">
                    {h.cards.map((c, k) => <Card key={c.id + '-' + k} card={c} small />)}
                    <b>{handValue(h.cards).total}</b>
                    {r && <em className={`bj-out bj-out--${r.outcomes[i].outcome}`}>{OUTCOME[r.outcomes[i].outcome]}</em>}
                  </span>
                ))}
                {game.phase === 'bet' && <small>{game.bets[id] > 0 ? `apostou ${game.bets[id]}` : game.bets[id] === 0 ? 'fica de fora' : 'a apostar…'}</small>}
              </div>
            )
          })}
        </div>
      )}

      <div className="bj-me">
        {myHands.map((h, i) => (
          <Hand
            key={i}
            hand={h}
            active={myTurn && game.turn.h === i}
            result={myResult?.outcomes[i]}
            label={myHands.length > 1 ? `Mão ${i + 1}` : null}
          />
        ))}
        {me && <p className="bj-chips-count" data-testid="bj-chips">As tuas fichas: <b>{chips}</b></p>}
      </div>

      {me && game.phase === 'bet' && (
        <div className="bj-bet" data-testid="bj-bet">
          {game.bets[meId] != null ? (
            <p className="game-status">Apostaste {game.bets[meId]}. À espera dos outros jogadores{secs != null ? ` (${secs} s)` : ''}…</p>
          ) : chips < MIN_BET ? (
            <>
              <p className="game-status">Ficaste sem fichas.</p>
              <button className="share-btn" onClick={() => onAction({ type: 'rebuy' })} data-testid="bj-rebuy">Recomeçar com {START_CHIPS} fichas</button>
            </>
          ) : (
            <>
              <p className="game-status">Quanto queres apostar? <b className="bj-bet__amount" data-testid="bj-bet-amount">{bet}</b></p>
              <div className="bj-chip-row">
                {CHIPS.map((v) => (
                  <Chip key={v} value={v} disabled={bet + v > Math.min(chips, MAX_BET)} onClick={() => setBet((b) => b + v)} />
                ))}
              </div>
              <div className="game-actions">
                <button className="mode-btn" onClick={() => setBet(0)} disabled={!bet}>Limpar</button>
                <button className="share-btn" disabled={bet < MIN_BET} onClick={() => onAction({ type: 'bet', amount: bet })} data-testid="bj-deal">
                  Distribuir
                </button>
              </div>
              <p className="modal-note">Aposta entre {MIN_BET} e {MAX_BET} fichas{secs != null ? ` · ${secs} s` : ''}.</p>
            </>
          )}
        </div>
      )}

      {game.phase === 'play' && (
        <div className="bj-actions">
          {myTurn ? (
            <>
              <button className="share-btn" onClick={() => onAction({ type: 'hit' })} data-testid="bj-hit">Pedir</button>
              <button className="share-btn bj-stand" onClick={() => onAction({ type: 'stand' })} data-testid="bj-stand">Ficar</button>
              <button className="mode-btn" disabled={!canDouble(game, meId)} onClick={() => onAction({ type: 'double' })} data-testid="bj-double">Dobrar</button>
              <button className="mode-btn" disabled={!canSplit(game, meId)} onClick={() => onAction({ type: 'split' })} data-testid="bj-split">Dividir</button>
              {secs != null && <span className="bj-timer">{secs} s</span>}
            </>
          ) : (
            <p className="game-status">Vez de {name(game.turn?.id)}…{secs != null ? ` (${secs} s)` : ''}</p>
          )}
        </div>
      )}

      {game.phase === 'done' && myResult && (
        <p className={`bj-summary ${myResult.net > 0 ? 'bj-summary--win' : myResult.net < 0 ? 'bj-summary--lose' : ''}`} data-testid="bj-summary">
          {myResult.net > 0 ? `Ganhaste ${myResult.net} fichas!` : myResult.net < 0 ? `Perdeste ${-myResult.net} fichas.` : 'Empate: recuperaste a aposta.'}
          {' '}A banca fez {handValue(game.dealer).total > 21 ? `${handValue(game.dealer).total} e rebentou` : handValue(game.dealer).total}.
        </p>
      )}
    </div>
  )
}

function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  return now
}

function Solo() {
  const [game, setGame] = useState(() => {
    const g = startGame(['tu'])
    return { ...g, deadline: null }
  })
  const [error, setError] = useState('')
  const now = useNow()
  useEffect(() => {
    const r = game.results?.tu
    if (game.phase === 'done' && r) recordResultOnce(`blackjack-solo-${Date.now()}`, 'blackjack', r.net > 0)
  }, [game.phase, game.round]) // eslint-disable-line react-hooks/exhaustive-deps
  const onAction = (a) => {
    setError('')
    try {
      const next = applyAction(game, 'tu', a)
      setGame({ ...next, deadline: null })
    } catch (e) {
      setError(e.message)
    }
  }
  return (
    <div className="game-panel game-panel--wide">
      <Table game={game} meId="tu" people={() => ({ name: 'Tu' })} onAction={onAction} now={now} />
      {error && <p className="duel-error">{error}</p>}
      {game.phase === 'done' && (
        <div className="game-actions">
          <button className="share-btn" data-testid="bj-next" onClick={() => gameBreak('blackjack', () => onAction({ type: 'next' }))}>Próxima mão</button>
        </div>
      )}
    </div>
  )
}

function OnlineBoard({ state, game, me, dispatch, serverNow }) {
  const people = (id) => state.players.find((p) => p.id === id)
  const tickNow = useNow()
  const now = tickNow + (serverNow() - Date.now())
  const seated = game.order.includes(me.id)
  useEffect(() => {
    const r = game.results?.[me.id]
    if (game.phase === 'done' && r) recordResultOnce(`blackjack-${state.code}-${game.round}`, 'blackjack', r.net > 0)
  }, [game.phase, game.round]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="game-panel game-panel--wide">
      <Table game={game} meId={me.id} people={people} onAction={dispatch} now={now} />
      {game.phase === 'done' && seated && (
        <div className="game-actions">
          <button className="share-btn" data-testid="bj-next" onClick={() => dispatch({ type: 'next' })}>Próxima mão</button>
        </div>
      )}
    </div>
  )
}

const HELP = (
  <>
    <p>O objetivo é ficar mais perto de 21 do que a banca, sem passar. As figuras valem 10 e o Ás vale 11 ou 1.</p>
    <p><strong>Pedir</strong> dá-te mais uma carta. <strong>Ficar</strong> passa a vez. <strong>Dobrar</strong> duplica a aposta e recebes só mais uma carta. Com um par podes <strong>Dividir</strong> em duas mãos.</p>
    <p>A banca pede até ter 17 ou mais. Ganhar paga o mesmo que apostaste e um <strong>Blackjack</strong> (Ás + 10 nas duas primeiras cartas) paga 3 para 2.</p>
    <p>As fichas são a fingir: não há dinheiro envolvido. Se ficares sem fichas, recomeças com {START_CHIPS}.</p>
  </>
)

export default function BlackjackGame() {
  return (
    <GameShell
      game="blackjack"
      title="Blackjack"
      help={HELP}
      modes={[
        { key: 'solo', label: 'Sozinho' },
        { key: 'online', label: 'Mesa com amigos' },
      ]}
    >
      {(mode) => (mode === 'solo' ? <Solo /> : <OnlineGame game="blackjack" logic={blackjackOnline} renderGame={(props) => <OnlineBoard {...props} />} />)}
    </GameShell>
  )
}
