import { useCallback, useEffect, useRef, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import Card from '../../components/Card.jsx'
import { gameBreak } from '../../lib/ads.js'
import { recordResultOnce, getMyWallet, getWallets, saveMyWallet } from '../../lib/social.js'
import {
  MIN_BET,
  MAX_BET,
  MAX_SEATS,
  START_CHIPS,
  TURN_MS,
  BOT_NAMES,
  handValue,
  isBlackjack,
  startGame,
  applyAction,
  tick,
  canDouble,
  canSplit,
  blackjackOnline,
} from './blackjackLogic.js'

const CHIPS = [10, 25, 50, 100, 500]
const OUTCOME = { ganhou: 'Ganhou', perdeu: 'Perdeu', empate: 'Empate', rebentou: 'Rebentou', blackjack: 'Blackjack!' }
const botPerson = (id) => ({ name: BOT_NAMES[Number(id.slice(3))] || 'Bot', seed: id })

// Lugares à volta da mesa (em %): eu sempre em baixo, ao centro; os outros
// nas pontas. [x, y] no PC e [x, y] no telemóvel.
const SLOTS = {
  L: [[25, 60], [17, 60]],
  FL: [[9, 30], [17, 27]],
  FR: [[91, 30], [83, 27]],
  R: [[75, 60], [83, 60]],
}
const LAYOUT = { 0: [], 1: ['R'], 2: ['L', 'R'], 3: ['L', 'FL', 'R'], 4: ['L', 'FL', 'FR', 'R'] }

function Chip({ value, onClick, disabled }) {
  return (
    <button type="button" className={`bj-chip bj-chip--${value}`} onClick={onClick} disabled={disabled} aria-label={`Apostar mais ${value}`} data-testid={`bj-chip-${value}`}>
      {value}
    </button>
  )
}

function Hand({ hand, active, result, label, small }) {
  const v = handValue(hand.cards)
  return (
    <div className={`bj-hand${active ? ' bj-hand--active' : ''}`}>
      <div className="bj-cards">
        {hand.cards.map((c, i) => (
          <span key={c.id + '-' + i} className="card-deal" style={{ animationDelay: `${i * 0.05}s` }}><Card card={c} small={small} /></span>
        ))}
      </div>
      <div className="bj-hand__info">
        {label && <span className="bj-hand__label">{label}</span>}
        <b className={v.total > 21 ? 'bj-bust' : ''}>{isBlackjack(hand) ? 'BJ' : `${v.soft && v.total < 21 ? `${v.total - 10}/` : ''}${v.total}`}</b>
        <span className="bj-hand__bet">{hand.bet}{hand.doubled ? ' ×2' : ''}</span>
        {result && <span className={`bj-out bj-out--${result.outcome}`}>{OUTCOME[result.outcome]}</span>}
      </div>
    </div>
  )
}

function Seat({ game, id, meId, person, slot, now }) {
  const me = id === meId
  const hs = game.hands[id] || []
  const r = game.results?.[id]
  const turn = game.turn?.id === id
  const left = turn && game.deadline && !me ? Math.max(0, game.deadline - now) : 0
  let tag = null
  if (game.phase === 'bet') tag = game.bets[id] > 0 ? `Aposta ${game.bets[id]}` : game.bets[id] === 0 ? 'Fica de fora' : 'A apostar…'
  else if (!hs.length) tag = 'Fica de fora'
  else if (r) tag = r.net > 0 ? `+${r.net}` : r.net < 0 ? `${r.net}` : '±0'
  const style = slot ? { '--x': `${slot[0][0]}%`, '--y': `${slot[0][1]}%`, '--mx': `${slot[1][0]}%`, '--my': `${slot[1][1]}%` } : undefined
  return (
    <div
      className={`bj-seat${me ? ' bj-seat--me' : ''}${turn ? ' bj-seat--turn' : ''}${r && r.net > 0 ? ' bj-seat--win' : ''}${r && r.net < 0 ? ' bj-seat--lose' : ''}`}
      style={style}
      data-testid={me ? 'bj-seat-me' : 'bj-seat'}
    >
      <div className={me ? 'bj-me' : 'bj-seat__hands'}>
        {hs.map((h, i) => (
          <Hand
            key={i}
            hand={h}
            small={!me}
            active={turn && game.turn.h === i && hs.length > 1}
            result={r?.outcomes[i]}
            label={me && hs.length > 1 ? `Mão ${i + 1}` : null}
          />
        ))}
      </div>
      <div className="bj-plate">
        <Avatar src={person?.avatar} seed={person?.seed || id} name={person?.name} size={me ? 30 : 26} />
        <span className="bj-plate__info">
          <b>{me ? 'Tu' : person?.name || 'Jogador'}</b>
          <span data-testid={me ? 'bj-chips' : undefined}>{game.chips[id]} fichas</span>
        </span>
      </div>
      {left > 0 && <span className="pk-timer" style={{ '--t': left / TURN_MS }} />}
      {tag && <span className={`bj-tag${r ? (r.net > 0 ? ' bj-tag--win' : r.net < 0 ? ' bj-tag--lose' : '') : ''}`}>{tag}</span>}
    </div>
  )
}

function Table({ game, meId, people, now }) {
  const showHole = game.phase === 'done'
  const dealerVal = showHole ? handValue(game.dealer).total : game.dealer[0] ? handValue([game.dealer[0]]).total : 0
  // Os outros pela ordem da mesa, a começar depois de mim.
  const at = Math.max(0, game.order.indexOf(meId))
  const rotated = [...game.order.slice(at), ...game.order.slice(0, at)]
  const seated = rotated[0] === meId
  const others = seated ? rotated.slice(1) : rotated
  const slots = LAYOUT[Math.min(others.length, 4)]
  return (
    <div className="bj-table" data-testid="bj-table">
      <div className="bj-felt">
        <span className="bj-felt__rules">Blackjack paga 3 para 2 · a banca fica no 17</span>
      </div>
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
      {others.slice(0, 4).map((id, i) => (
        <Seat key={id} game={game} id={id} meId={meId} person={people(id)} slot={SLOTS[slots[i]]} now={now} />
      ))}
      {seated && <Seat game={game} id={meId} meId={meId} person={people(meId)} now={now} />}
    </div>
  )
}

// Apostas, jogadas e resultado (por baixo da mesa).
function Controls({ game, meId, people, onAction, now, children }) {
  const [bet, setBet] = useState(0)
  const me = game.order.includes(meId)
  const chips = game.chips[meId] ?? 0
  const myTurn = game.turn?.id === meId
  const myResult = game.results?.[meId]
  const secs = game.deadline ? Math.max(0, Math.ceil((game.deadline - now) / 1000)) : null
  const name = (id) => (id === meId ? 'Tu' : people(id)?.name || 'Jogador')

  useEffect(() => {
    if (game.phase === 'bet') setBet(Math.min(game.lastBet?.[meId] || 0, chips, MAX_BET))
  }, [game.phase, game.round]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bj-controls">
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
            <p className="game-status">Vez de {name(game.turn?.id)}…</p>
          )}
        </div>
      )}

      {game.phase === 'done' && myResult && (
        <p className={`bj-summary ${myResult.net > 0 ? 'bj-summary--win' : myResult.net < 0 ? 'bj-summary--lose' : ''}`} data-testid="bj-summary">
          {myResult.net > 0 ? `Ganhaste ${myResult.net} fichas!` : myResult.net < 0 ? `Perdeste ${-myResult.net} fichas.` : 'Empate: recuperaste a aposta.'}
          {' '}A banca fez {handValue(game.dealer).total > 21 ? `${handValue(game.dealer).total} e rebentou` : handValue(game.dealer).total}.
        </p>
      )}
      {children}
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

// Guarda as minhas fichas na conta sempre que mudam (ganhos, perdas, apostas).
function useSaveWallet(chips, enabled) {
  const last = useRef(null)
  useEffect(() => {
    if (!enabled || !Number.isFinite(chips) || chips === last.current) return
    last.current = chips
    saveMyWallet('blackjack', chips).catch(() => {})
  }, [chips, enabled])
}

function Solo() {
  const [bots, setBots] = useState(2)
  const [wallet, setWallet] = useState(undefined) // undefined = a carregar
  const [game, setGame] = useState(null)
  const [error, setError] = useState('')
  const now = useNow()
  const people = (id) => (id === 'tu' ? { name: 'Tu' } : botPerson(id))

  useEffect(() => {
    getMyWallet('blackjack').then(
      (c) => setWallet(c ?? START_CHIPS),
      () => setWallet(START_CHIPS),
    )
  }, [])
  useSaveWallet(game?.chips.tu, !!game)

  // Os bots jogam sozinhos (com uma pequena pausa entre jogadas).
  useEffect(() => {
    if (!game) return undefined
    const t = setInterval(() => setGame((g) => (g ? tick(g, Date.now()) : g)), 300)
    return () => clearInterval(t)
  }, [!!game]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const r = game?.results?.tu
    if (game?.phase === 'done' && r) recordResultOnce(`blackjack-solo-${Date.now()}`, 'blackjack', r.net > 0)
  }, [game?.phase, game?.round]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <p className="game-status">
          {wallet === undefined ? 'A carregar as tuas fichas…' : <>As tuas fichas: <b data-testid="bj-wallet">{wallet}</b></>}
        </p>
        <p className="modal-note">O que ganhas ou perdes fica guardado na tua conta para a próxima vez.</p>
        <p className="game-status">Quantos bots na mesa contigo?</p>
        <div className="bot-levels">
          {[0, 1, 2, 3, 4].map((k) => (
            <button key={k} className={`mode-btn${bots === k ? ' mode-btn--active' : ''}`} onClick={() => setBots(k)} data-testid={`bj-bots-${k}`}>{k}</button>
          ))}
        </div>
        <button
          className="share-btn"
          data-testid="bj-start"
          disabled={wallet === undefined}
          onClick={() => {
            const ids = ['tu', ...Array.from({ length: bots }, (_, i) => `bot${i}`)]
            setGame(startGame(ids, Date.now(), Math.random, { chips: { tu: wallet }, bots: ids.slice(1), timed: false }))
          }}
        >
          Sentar à mesa
        </button>
      </div>
    )
  }
  return (
    <div className="game-panel game-panel--wide">
      <Table game={game} meId="tu" people={people} now={now} />
      <Controls game={game} meId="tu" people={people} onAction={onAction} now={now}>
        {game.phase === 'done' && (
          <div className="game-actions">
            <button className="share-btn" data-testid="bj-next" onClick={() => gameBreak('blackjack', () => onAction({ type: 'next' }))}>Próxima mão</button>
            <button
              className="mode-btn"
              onClick={() => {
                setWallet(game.chips.tu)
                setGame(null)
              }}
            >
              Mudar de mesa
            </button>
          </div>
        )}
      </Controls>
      {error && <p className="duel-error">{error}</p>}
    </div>
  )
}

function OnlineBoard({ state, game, me, dispatch, serverNow }) {
  const people = (id) => state.players.find((p) => p.id === id) || (id.startsWith('bot') ? botPerson(id) : null)
  const tickNow = useNow()
  const now = tickNow + (serverNow() - Date.now())
  const seated = game.order.includes(me.id)
  useSaveWallet(game.chips[me.id], seated)
  useEffect(() => {
    const r = game.results?.[me.id]
    if (game.phase === 'done' && r) recordResultOnce(`blackjack-${state.code}-${game.round}`, 'blackjack', r.net > 0)
  }, [game.phase, game.round]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="game-panel game-panel--wide">
      <Table game={game} meId={me.id} people={people} now={now} />
      <Controls game={game} meId={me.id} people={people} onAction={dispatch} now={now}>
        {game.phase === 'done' && seated && (
          <div className="game-actions">
            <button className="share-btn" data-testid="bj-next" onClick={() => dispatch({ type: 'next' })}>Próxima mão</button>
          </div>
        )}
      </Controls>
    </div>
  )
}

// Escolhas do lobby (lidas ao carregar em "Começar jogo").
const lobbyChoice = { bots: 0, ids: [] }
function LobbyBots({ state, amHost }) {
  const [bots, setBots] = useState(0)
  const max = Math.max(0, MAX_SEATS - state.players.length)
  const shown = Math.min(bots, max)
  lobbyChoice.bots = shown
  lobbyChoice.ids = state.players.map((p) => p.id)
  if (!amHost) return null
  return (
    <div className="bomb-lobby-bots">
      <p className="modal-note">Adicionar bots (a mesa fica com até {MAX_SEATS}):</p>
      <div className="bot-levels">
        {Array.from({ length: max + 1 }, (_, k) => (
          <button key={k} type="button" className={`mode-btn${shown === k ? ' mode-btn--active' : ''}`} onClick={() => setBots(k)} data-testid={`lobby-bots-${k}`}>{k}</button>
        ))}
      </div>
    </div>
  )
}

async function prepareOnlineStart() {
  let chips = {}
  try {
    chips = await getWallets('blackjack', lobbyChoice.ids)
  } catch {
    // sem carteiras: todos começam com as fichas iniciais
  }
  return { bots: lobbyChoice.bots, chips }
}

const HELP = (
  <>
    <p>O objetivo é ficar mais perto de 21 do que a banca, sem passar. As figuras valem 10 e o Ás vale 11 ou 1.</p>
    <p><strong>Pedir</strong> dá-te mais uma carta. <strong>Ficar</strong> passa a vez. <strong>Dobrar</strong> duplica a aposta e recebes só mais uma carta. Com um par podes <strong>Dividir</strong> em duas mãos.</p>
    <p>A banca pede até ter 17 ou mais. Ganhar paga o mesmo que apostaste e um <strong>Blackjack</strong> (Ás + 10 nas duas primeiras cartas) paga 3 para 2.</p>
    <p>As fichas são a fingir e ficam guardadas na tua conta: o que ganhas ou perdes conta para a próxima vez. Se ficares sem fichas, recomeças com {START_CHIPS}.</p>
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
      {(mode) =>
        mode === 'solo' ? (
          <Solo />
        ) : (
          <OnlineGame
            game="blackjack"
            logic={blackjackOnline}
            renderLobbyOptions={(props) => <LobbyBots {...props} />}
            prepareStart={prepareOnlineStart}
            renderGame={(props) => <OnlineBoard {...props} />}
          />
        )
      }
    </GameShell>
  )
}
