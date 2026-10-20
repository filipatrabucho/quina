import { useCallback, useEffect, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import Card from '../../components/Card.jsx'
import { gameBreak } from '../../lib/ads.js'
import { recordResultOnce } from '../../lib/social.js'
import { BOT_NAMES, START_CHIPS, startGame, applyAction, legalActions, tick, pot, blinds, toCall, pokerOnline } from './pokerLogic.js'

// Posições dos lugares à volta da mesa (eu sempre em baixo, ao centro).
const SEATS = {
  2: [[50, 92], [50, 8]],
  3: [[50, 92], [12, 30], [88, 30]],
  4: [[50, 92], [6, 50], [50, 8], [94, 50]],
  5: [[50, 92], [8, 62], [22, 12], [78, 12], [92, 62]],
  6: [[50, 92], [8, 66], [12, 20], [50, 8], [88, 20], [92, 66]],
}
const PHASE_LABEL = { preflop: 'Antes do flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Fim da mão', over: 'Fim do torneio' }

function Seat({ game, id, meId, person, pos, now, timed }) {
  const me = id === meId
  const inHand = !!game.holes[id]
  const folded = game.folded[id]
  const out = game.chips[id] <= 0 && !game.contrib[id]
  const turn = game.toAct === id
  const shown = game.result?.shown?.[id]
  const winner = game.result?.winners?.some((w) => w.ids.includes(id))
  const reveal = me || (game.result?.kind === 'showdown' && shown)
  const allIn = inHand && !folded && game.chips[id] === 0
  const left = turn && game.deadline ? Math.max(0, game.deadline - now) : 0
  return (
    <div
      className={`pk-seat${me ? ' pk-seat--me' : ''}${turn ? ' pk-seat--turn' : ''}${folded ? ' pk-seat--folded' : ''}${out ? ' pk-seat--out' : ''}${winner ? ' pk-seat--win' : ''}`}
      style={{ left: `${pos[0]}%`, top: `${pos[1]}%` }}
      data-testid={me ? 'pk-me' : `pk-seat-${id}`}
    >
      {inHand && (
        <div className="pk-hole">
          {game.holes[id].map((c, i) => (
            <Card key={c.id} card={c} hidden={!reveal} small={!me} highlight={!!shown && shown.cards.includes(c.id)} dim={folded} testid={me ? `pk-hole-${i}` : undefined} />
          ))}
        </div>
      )}
      <div className="pk-plate">
        <Avatar src={person?.avatar} seed={person?.seed || id} name={person?.name} size={30} />
        <span className="pk-plate__info">
          <b>{me ? 'Tu' : person?.name || 'Jogador'}</b>
          <span data-testid={me ? 'pk-my-chips' : undefined}>{out ? 'Eliminado' : `${game.chips[id]} 🪙`}</span>
        </span>
        {game.order[game.dealer] === id && <i className="pk-badge pk-badge--d" title="Dealer">D</i>}
        {game.sb === id && game.phase === 'preflop' && <i className="pk-badge">SB</i>}
        {game.bb === id && game.phase === 'preflop' && <i className="pk-badge">BB</i>}
      </div>
      {turn && game.deadline && (timed || !me) && <span className="pk-timer" style={{ '--t': `${Math.min(1, left / 30000)}` }} />}
      {(folded || allIn || shown || (game.bets[id] || 0) > 0) && (
        <span className="pk-tag">
          {folded ? 'Desistiu' : shown ? shown.name : allIn ? 'All-in' : `${game.bets[id]}`}
        </span>
      )}
    </div>
  )
}

function Controls({ game, meId, onAction }) {
  const o = legalActions(game, meId)
  const [to, setTo] = useState(0)
  useEffect(() => {
    if (o) setTo(o.minRaiseTo)
  }, [game.toAct, game.phase, game.currentBet]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!o) return null
  const potNow = pot(game)
  const quick = [
    ['Mín.', o.minRaiseTo],
    ['½ pote', game.currentBet + Math.round(potNow / 2)],
    ['Pote', game.currentBet + potNow],
    ['All-in', o.maxRaiseTo],
  ].map(([l, v]) => [l, Math.max(o.minRaiseTo, Math.min(o.maxRaiseTo, v))])
  const raiseLabel = game.currentBet === 0 ? 'Apostar' : 'Aumentar para'
  return (
    <div className="pk-controls" data-testid="pk-controls">
      <div className="pk-controls__main">
        <button className="mode-btn" onClick={() => onAction({ type: 'fold' })} data-testid="pk-fold">Desistir</button>
        {o.canCheck ? (
          <button className="share-btn" onClick={() => onAction({ type: 'check' })} data-testid="pk-check">Passar</button>
        ) : (
          <button className="share-btn" onClick={() => onAction({ type: 'call' })} data-testid="pk-call">
            Pagar {o.call}{o.call >= game.chips[meId] ? ' (all-in)' : ''}
          </button>
        )}
        {o.canRaise && (
          <button className="share-btn pk-raise" onClick={() => onAction({ type: 'raise', to })} data-testid="pk-raise">
            {to >= o.maxRaiseTo ? 'All-in' : raiseLabel} {to}
          </button>
        )}
      </div>
      {o.canRaise && o.maxRaiseTo > o.minRaiseTo && (
        <div className="pk-controls__raise">
          <input type="range" min={o.minRaiseTo} max={o.maxRaiseTo} step={Math.max(1, blinds(game)[0])} value={to} onChange={(e) => setTo(Number(e.target.value))} aria-label="Quanto aumentar" data-testid="pk-slider" />
          <div className="pk-quick">
            {quick.map(([l, v]) => (
              <button key={l} type="button" className="home-cat" onClick={() => setTo(v)}>{l}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Table({ game, meId, people, onAction, now, children, timed = true }) {
  const n = game.order.length
  const meIdx = Math.max(0, game.order.indexOf(meId))
  const rotated = [...game.order.slice(meIdx), ...game.order.slice(0, meIdx)]
  const pos = SEATS[n] || SEATS[6]
  const fmt = (msg) => msg.replace(/@([\w-]+)/g, (_, id) => (id === meId ? 'Tu' : people(id)?.name || 'Jogador'))
  const myTurn = game.toAct === meId
  const [sb, bb] = blinds(game)
  return (
    <div className="pk-wrap">
      <div className="pk-info">
        <span>{PHASE_LABEL[game.phase] || ''}</span>
        <span>Mão {game.handNo}</span>
        <span>Blinds {sb}/{bb}</span>
      </div>
      <div className="pk-table" data-testid="pk-table">
        <div className="pk-felt">
          <div className="pk-center">
            <div className="pk-board" data-testid="pk-board">
              {Array.from({ length: 5 }, (_, i) => {
                const c = game.board[i]
                const hl = c && game.result?.kind === 'showdown' && Object.values(game.result.shown).some((s) => s.cards.includes(c.id)) && game.result.winners.some((w) => w.ids.some((id) => game.result.shown[id]?.cards.includes(c.id)))
                return c ? <span key={c.id} className="card-deal"><Card card={c} highlight={hl} /></span> : <span key={`e${i}`} className="pk-slot" />
              })}
            </div>
            {/* no fim da mão o resultado ocupa o lugar do pote (não fica por baixo das minhas cartas) */}
            {!game.result && <div className="pk-pot" data-testid="pk-pot">Pote: <b>{pot(game)}</b></div>}
            {game.result && (
              <div className="pk-result" data-testid="pk-result">
                {game.result.winners.map((w, i) => (
                  <span key={i}>{w.ids.map((id) => (id === meId ? 'Tu' : people(id)?.name || 'Jogador')).join(' e ')} {w.ids.length > 1 ? 'dividem' : w.ids[0] === meId ? 'ganhas' : 'ganha'} {w.amount}{w.hand ? ` · ${w.hand}` : ''}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        {rotated.map((id, i) => (
          <Seat key={id} game={game} id={id} meId={meId} person={people(id)} pos={pos[i]} now={now} timed={timed} />
        ))}
      </div>

      {myTurn ? (
        <Controls game={game} meId={meId} onAction={onAction} />
      ) : (
        game.toAct && <p className="game-status" data-testid="pk-status">Vez de {game.toAct === meId ? 'ti' : people(game.toAct)?.name || 'Jogador'}{toCall(game, game.toAct) ? ` (para pagar ${toCall(game, game.toAct)})` : ''}…</p>
      )}
      {children}
      <ol className="pk-log">
        {game.log.slice(-5).reverse().map((l, i) => <li key={game.log.length - i}>{fmt(l)}</li>)}
      </ol>
    </div>
  )
}

function useNow(active = true) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return undefined
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [active])
  return now
}

function VsBots() {
  const [bots, setBots] = useState(3)
  const [game, setGame] = useState(null)
  const [error, setError] = useState('')
  const now = useNow(!!game)
  const people = (id) => (id === 'tu' ? { name: 'Tu' } : { name: BOT_NAMES[Number(id.slice(3))], seed: id })

  // Os bots jogam e as mãos avançam sozinhas (como faria o anfitrião).
  useEffect(() => {
    if (!game || game.phase === 'over') return undefined
    const t = setInterval(() => setGame((g) => (g && g.phase !== 'over' ? (g.toAct === 'tu' ? g : tick(g, Date.now())) : g)), 300)
    return () => clearInterval(t)
  }, [game?.phase === 'over', !!game]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (game?.phase === 'over') recordResultOnce(`poker-bots-${Date.now()}`, 'poker', game.winner === 'tu')
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
        <p className="game-status">Contra quantos bots queres jogar?</p>
        <div className="bot-levels">
          {[1, 2, 3, 4, 5].map((k) => (
            <button key={k} className={`mode-btn${bots === k ? ' mode-btn--active' : ''}`} onClick={() => setBots(k)}>{k}</button>
          ))}
        </div>
        <p className="modal-note">Todos começam com {START_CHIPS} fichas. Ganha quem ficar com tudo.</p>
        <button
          className="share-btn"
          data-testid="pk-start"
          onClick={() => {
            const ids = ['tu', ...Array.from({ length: bots }, (_, i) => `bot${i}`)]
            setGame(startGame(ids, ids.slice(1)))
          }}
        >
          Começar torneio
        </button>
      </div>
    )
  }
  const meOut = game.chips.tu <= 0 && game.phase !== 'over' && !game.contrib.tu
  return (
    <div className="game-panel game-panel--wide">
      <Table game={game} meId="tu" people={people} onAction={onAction} now={now} timed={false}>
        {game.phase === 'showdown' && (
          <button className="mode-btn" onClick={() => setGame((g) => applyAction(g, 'tu', { type: 'next' }))} data-testid="pk-next">Próxima mão</button>
        )}
        {meOut && <p className="game-status">Ficaste sem fichas. <button className="link-btn" onClick={() => setGame(null)}>Novo torneio</button></p>}
        {game.phase === 'over' && (
          <div className="pk-over" data-testid="pk-over">
            <h3>{game.winner === 'tu' ? 'Ganhaste o torneio!' : `${people(game.winner).name} ganhou o torneio`}</h3>
            <div className="game-actions">
              <button className="share-btn" onClick={() => gameBreak('poker', () => setGame(applyAction(game, 'tu', { type: 'rematch' })))}>Novo torneio</button>
              <button className="mode-btn" onClick={() => setGame(null)}>Mudar nº de bots</button>
            </div>
          </div>
        )}
      </Table>
      {error && <p className="duel-error">{error}</p>}
    </div>
  )
}

function OnlineBoard({ state, game, me, dispatch, serverNow }) {
  const people = (id) => state.players.find((p) => p.id === id) || (id.startsWith('bot') ? { name: BOT_NAMES[Number(id.slice(3))], seed: id } : null)
  const t = useNow()
  const now = t + (serverNow() - Date.now())
  const seated = game.order.includes(me.id)
  useEffect(() => {
    if (game.phase === 'over' && seated) recordResultOnce(`poker-${state.code}-${game.handNo}`, 'poker', game.winner === me.id)
  }, [game.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="game-panel game-panel--wide">
      <Table game={game} meId={me.id} people={people} onAction={dispatch} now={now}>
        {game.phase === 'over' && (
          <div className="pk-over" data-testid="pk-over">
            <h3>{game.winner === me.id ? 'Ganhaste o torneio!' : `${people(game.winner)?.name || 'Jogador'} ganhou o torneio`}</h3>
            {seated && <button className="share-btn" onClick={() => dispatch({ type: 'rematch' })}>Novo torneio</button>}
          </div>
        )}
      </Table>
    </div>
  )
}

// Nº de bots escolhido no lobby (lido ao carregar em "Começar jogo").
const lobbyChoice = { bots: 0 }
function LobbyBots({ state, amHost }) {
  const [bots, setBots] = useState(0)
  const max = Math.max(0, 6 - state.players.length)
  const shown = Math.min(bots, max)
  lobbyChoice.bots = shown
  if (!amHost) return null
  return (
    <div className="bomb-lobby-bots">
      <p className="modal-note">Adicionar bots (a mesa fica com até 6):</p>
      <div className="bot-levels">
        {Array.from({ length: max + 1 }, (_, k) => (
          <button key={k} type="button" className={`mode-btn${shown === k ? ' mode-btn--active' : ''}`} onClick={() => setBots(k)} data-testid={`lobby-bots-${k}`}>{k}</button>
        ))}
      </div>
    </div>
  )
}

const HELP = (
  <>
    <p>Texas Hold'em em torneio: todos começam com {START_CHIPS} fichas (a fingir) e ganha quem ficar com tudo. As blinds sobem de 6 em 6 mãos.</p>
    <p>Cada jogador recebe 2 cartas só suas. Depois aparecem 5 cartas na mesa, para todos: 3 no flop, 1 no turn e 1 no river. Há apostas antes do flop e depois de cada uma destas fases.</p>
    <p>Na tua vez podes <strong>Desistir</strong>, <strong>Passar</strong> (se não houver aposta), <strong>Pagar</strong> a aposta ou <strong>Aumentar</strong>. No fim ganha a melhor mão de 5 cartas.</p>
    <p>Ordem das mãos, da mais forte para a mais fraca: sequência de cor, póquer, full house, cor, sequência, trio, dois pares, par e carta alta.</p>
  </>
)

export default function PokerGame() {
  return (
    <GameShell
      game="poker"
      title="Poker"
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
            game="poker"
            logic={pokerOnline}
            renderLobbyOptions={(props) => <LobbyBots {...props} />}
            prepareStart={() => ({ bots: lobbyChoice.bots })}
            renderGame={(props) => <OnlineBoard {...props} />}
          />
        )
      }
    </GameShell>
  )
}
