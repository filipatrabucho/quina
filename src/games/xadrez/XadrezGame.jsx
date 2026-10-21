import { useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import BotLevelPicker from '../../components/BotLevelPicker.jsx'
import Scoreboard from '../../components/Scoreboard.jsx'
import ChessBoard, { MoveList } from './ChessBoard.jsx'
import { recordResultOnce } from '../../lib/social.js'
import { gameStatus, replay, xadrezOnline, CLOCKS, newClock, clockLeft, clockAfterMove } from './xadrezLogic.js'

const COLOR_NAME = { w: 'brancas', b: 'pretas' }

// O bot corre num Web Worker para não bloquear o ecrã enquanto pensa.
function useChessBot() {
  const workerRef = useRef(null)
  const pending = useRef(new Map())
  useEffect(() => {
    const worker = new Worker(new URL('./chessBot.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const resolve = pending.current.get(e.data.id)
      pending.current.delete(e.data.id)
      resolve?.(e.data.move)
    }
    workerRef.current = worker
    return () => worker.terminate()
  }, [])
  return (fen, level) =>
    new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2)
      pending.current.set(id, resolve)
      workerRef.current.postMessage({ id, fen, level })
    })
}

function fmtClock(ms) {
  const s = Math.max(0, ms) / 1000
  if (s < 10) return s.toFixed(1)
  const t = Math.ceil(s)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

// Relógio de um jogador (fica vermelho nos últimos 20 segundos).
function ChessClock({ ms, running, label, testid }) {
  if (ms == null) return null
  return (
    <div className={`chess-clock${running ? ' chess-clock--run' : ''}${ms < 20000 ? ' chess-clock--low' : ''}`} data-testid={testid}>
      <span>{label}</span>
      <b>{fmtClock(ms)}</b>
    </div>
  )
}

function ClockPicker({ value, onChange }) {
  return (
    <div className="chess-color-pick" role="group" aria-label="Relógio">
      <span className="modal-note">Relógio:</span>
      {CLOCKS.map((c) => (
        <button key={c.key} type="button" className={`mode-btn mode-btn--small${value === c.key ? ' mode-btn--active' : ''}`} onClick={() => onChange(c.key)} data-testid={`clock-${c.key}`}>
          {c.label}
        </button>
      ))}
    </div>
  )
}

function useTicker(on) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!on) return undefined
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [on])
  return now
}

function describeResult(status, myColor) {
  if (!status.over) return null
  if (!status.winner) return `Empate (${status.reason}).`
  return status.winner === myColor ? `Ganhaste por ${status.reason}!` : `Perdeste por ${status.reason}.`
}

function VsBot() {
  const [level, setLevel] = useState('medio')
  const [humanColor, setHumanColor] = useState('w')
  const [moves, setMoves] = useState([])
  const [resigned, setResigned] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [clockKey, setClockKey] = useState('sem')
  const [clock, setClock] = useState(null)
  const [flagged, setFlagged] = useState(null) // cor de quem ficou sem tempo
  const askBot = useChessBot()
  const chess = replay(moves)
  const fen = chess.fen()
  const turn = chess.turn()
  const status = resigned
    ? { over: true, winner: humanColor === 'w' ? 'b' : 'w', reason: 'desistência' }
    : flagged
      ? { over: true, winner: flagged === 'w' ? 'b' : 'w', reason: 'tempo' }
      : gameStatus(chess)
  const now = useTicker(!!clock && !status.over && clock.turnStart != null)
  const left = clock ? clockLeft(clock, status.over ? null : turn, now) : null

  // Acabou o tempo de quem tem a vez.
  useEffect(() => {
    if (left && !status.over && left[turn] <= 0) setFlagged(turn)
  }, [now]) // eslint-disable-line react-hooks/exhaustive-deps

  // Junta um lance (de quem for) e atualiza o relógio.
  const addMove = (san, color) => {
    setMoves((m) => [...m, san])
    setClock((c) => clockAfterMove(c, color, Date.now()))
  }
  const botTurn = !status.over && chess.turn() !== humanColor
  const history = chess.history({ verbose: true })
  const last = history.at(-1)

  useEffect(() => {
    if (status.over && moves.length > 0) {
      recordResultOnce(`xadrez-bot-${Date.now()}`, 'xadrez', status.winner === humanColor, level)
    }
  }, [status.over]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!botTurn) return undefined
    let cancelled = false
    setThinking(true)
    const started = Date.now()
    askBot(fen, level).then((move) => {
      const wait = Math.max(0, 200 - (Date.now() - started))
      setTimeout(() => {
        if (cancelled || !move) return
        const c = replay(moves)
        if (c.fen() !== fen) return
        addMove(c.move(move).san, c.turn() === 'w' ? 'b' : 'w')
        setThinking(false)
      }, wait)
    })
    return () => {
      cancelled = true
    }
  }, [fen, botTurn, level]) // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = (mv) => {
    const c = replay(moves)
    try {
      const done = c.move(mv)
      addMove(done.san, done.color)
    } catch {
      // lance inválido, ignora
    }
  }

  const newGame = (color, key = clockKey) => {
    setHumanColor(color)
    setMoves([])
    setResigned(false)
    setFlagged(null)
    setThinking(false)
    setClock(newClock(key))
  }
  const botColor = humanColor === 'w' ? 'b' : 'w'

  return (
    <div className="game-panel game-panel--wide">
      <BotLevelPicker value={level} onChange={setLevel} />
      <div className="chess-color-pick">
        <span className="modal-note">Jogar com:</span>
        <button className={`mode-btn mode-btn--small${humanColor === 'w' ? ' mode-btn--active' : ''}`} onClick={() => newGame('w')}>
          Brancas
        </button>
        <button className={`mode-btn mode-btn--small${humanColor === 'b' ? ' mode-btn--active' : ''}`} onClick={() => newGame('b')}>
          Pretas
        </button>
      </div>
      <ClockPicker
        value={clockKey}
        onChange={(k) => {
          setClockKey(k)
          newGame(humanColor, k)
        }}
      />
      {left && <ChessClock ms={left[botColor]} running={!status.over && turn === botColor && clock.turnStart != null} label="Bot" testid="clock-bot" />}
      <ChessBoard
        fen={fen}
        orientation={humanColor}
        canMove={!status.over && !botTurn}
        onMove={onMove}
        lastMove={last ? { from: last.from, to: last.to } : null}
      />
      {left && <ChessClock ms={left[humanColor]} running={!status.over && turn === humanColor && clock.turnStart != null} label="Tu" testid="clock-me" />}
      <p className="game-status" data-testid="chess-status">
        {status.over
          ? describeResult(status, humanColor)
          : botTurn
            ? thinking
              ? 'O bot está a pensar…'
              : 'Vez do bot…'
            : `É a tua vez (${COLOR_NAME[humanColor]})${status.check ? '. Estás em xeque!' : '.'}`}
      </p>
      <div className="game-actions">
        {status.over ? (
          <button className="share-btn" onClick={() => newGame(humanColor === 'w' ? 'b' : 'w')}>Nova partida</button>
        ) : (
          <>
            <button className="mode-btn" onClick={() => setMoves((m) => m.slice(0, Math.max(0, m.length - (botTurn ? 1 : 2))))} disabled={moves.length < 2 || thinking || !!clock}>
              ↶ Anular
            </button>
            <button className="mode-btn" onClick={() => setResigned(true)} disabled={moves.length === 0}>
              Desistir
            </button>
          </>
        )}
      </div>
      <MoveList moves={moves} />
    </div>
  )
}

function OnlineBoard({ state, game, me, dispatch, isOnline, serverNow }) {
  const myColor = me.id === game.white ? 'w' : me.id === game.black ? 'b' : null
  const chess = new Chess(game.fen)
  const running = !!game.clock && !game.result && game.clock.turnStart != null
  const tickNow = useTicker(running)
  const left = game.clock ? clockLeft(game.clock, game.result ? null : chess.turn(), tickNow + (serverNow ? serverNow() - Date.now() : 0)) : null
  const topColor = myColor === 'b' ? 'w' : 'b'
  const bottomColor = topColor === 'w' ? 'b' : 'w'
  const status = gameStatus(chess)
  const player = (id) => state.players.find((p) => p.id === id)
  const result = game.result
  const myTurn = !result && myColor && chess.turn() === myColor
  const opponentId = myColor === 'w' ? game.black : game.white

  useEffect(() => {
    if (result && myColor) recordResultOnce(`xadrez-${state.code}-${game.round}`, 'xadrez', result.winnerId === me.id)
  }, [result, game.round]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="game-panel game-panel--wide">
      <Scoreboard
        sides={[game.white, game.black].map((id, i) => {
          const p = player(id)
          return {
            name: `${p?.name ?? '?'} (${i === 0 ? 'brancas' : 'pretas'})${p && !isOnline(id) ? ' · offline' : ''}`,
            avatar: p?.avatar,
            seed: p?.seed,
            score: game.score[id] ?? 0,
            active: !result && chess.turn() === (i === 0 ? 'w' : 'b'),
          }
        })}
        draws={game.score.empates}
      />
      {left && <ChessClock ms={left[topColor]} running={running && chess.turn() === topColor} label={player(topColor === 'w' ? game.white : game.black)?.name || ''} testid="clock-top" />}
      <ChessBoard
        fen={game.fen}
        orientation={myColor || 'w'}
        canMove={myTurn}
        onMove={(mv) => dispatch({ type: 'move', ...mv })}
        lastMove={game.lastMove}
      />
      {left && <ChessClock ms={left[bottomColor]} running={running && chess.turn() === bottomColor} label={myColor ? 'Tu' : player(bottomColor === 'w' ? game.white : game.black)?.name || ''} testid="clock-bottom" />}
      <p className="game-status" data-testid="chess-status">
        {result
          ? result.winnerId == null
            ? `Empate (${result.reason}).`
            : result.winnerId === me.id
              ? `Ganhaste por ${result.reason}!`
              : `Ganhou ${player(result.winnerId)?.name} por ${result.reason}.`
          : myTurn
            ? `É a tua vez${status.check ? '. Estás em xeque!' : '.'}`
            : `Vez de ${player(chess.turn() === 'w' ? game.white : game.black)?.name}…${status.check ? ' (xeque)' : ''}`}
      </p>
      {myColor && (
        <div className="game-actions">
          {result ? (
            <button className="share-btn" onClick={() => dispatch({ type: 'rematch' })}>Desforra (trocar cores)</button>
          ) : game.drawOffer && game.drawOffer !== me.id ? (
            <>
              <span className="modal-note">{player(opponentId)?.name} propõe empate.</span>
              <button className="mode-btn" onClick={() => dispatch({ type: 'acceptDraw' })}>Aceitar</button>
              <button className="mode-btn" onClick={() => dispatch({ type: 'declineDraw' })}>Recusar</button>
            </>
          ) : (
            <>
              <button className="mode-btn" onClick={() => dispatch({ type: 'offerDraw' })} disabled={game.drawOffer === me.id}>
                {game.drawOffer === me.id ? 'Empate proposto…' : 'Propor empate'}
              </button>
              <button
                className="mode-btn"
                onClick={() => {
                  if (window.confirm('Desistir desta partida?')) dispatch({ type: 'resign' })
                }}
              >
                Desistir
              </button>
            </>
          )}
        </div>
      )}
      <MoveList moves={game.moves} />
    </div>
  )
}

// Relógio escolhido no lobby (lido ao carregar em "Começar jogo").
const lobbyChoice = { clock: '5+0' }
function LobbyClock({ amHost }) {
  const [clock, setClock] = useState(lobbyChoice.clock)
  lobbyChoice.clock = clock
  if (!amHost) return null
  return <ClockPicker value={clock} onChange={setClock} />
}

const HELP = (
  <>
    <p>Xadrez clássico. Toca numa peça tua para ver as casas para onde pode ir e depois toca no destino.</p>
    <p>Roque, en passant e promoção estão incluídos. Ganha quem der xeque-mate.</p>
    <p>Com relógio, cada um tem um tempo para a partida toda (em 3+2 ganhas 2 segundos por lance). O relógio começa depois do 1.º lance das brancas; quem ficar sem tempo perde.</p>
    <p className="modal-note">Online: o anfitrião joga com as brancas; na desforra as cores trocam.</p>
  </>
)

export default function XadrezGame() {
  return (
    <GameShell
      game="xadrez"
      title="Xadrez"
      help={HELP}
      modes={[
        { key: 'bot', label: 'vs Bot' },
        { key: 'online', label: 'Multiplayer' },
      ]}
    >
      {(mode) =>
        mode === 'bot' ? (
          <VsBot />
        ) : (
          <OnlineGame
            game="xadrez"
            logic={xadrezOnline}
            renderLobbyOptions={(props) => <LobbyClock {...props} />}
            prepareStart={() => ({ clock: lobbyChoice.clock })}
            renderGame={(props) => <OnlineBoard {...props} />}
          />
        )
      }
    </GameShell>
  )
}
