import { useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import BotLevelPicker from '../../components/BotLevelPicker.jsx'
import Scoreboard from '../../components/Scoreboard.jsx'
import ChessBoard, { MoveList } from './ChessBoard.jsx'
import { gameStatus, replay, xadrezOnline } from './xadrezLogic.js'

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

function describeResult(status, myColor) {
  if (!status.over) return null
  if (!status.winner) return `Empate (${status.reason}).`
  return status.winner === myColor ? `Ganhaste por ${status.reason}! 🏆` : `Perdeste por ${status.reason}.`
}

function VsBot() {
  const [level, setLevel] = useState('medio')
  const [humanColor, setHumanColor] = useState('w')
  const [moves, setMoves] = useState([])
  const [resigned, setResigned] = useState(false)
  const [thinking, setThinking] = useState(false)
  const askBot = useChessBot()
  const chess = replay(moves)
  const fen = chess.fen()
  const status = resigned ? { over: true, winner: humanColor === 'w' ? 'b' : 'w', reason: 'desistência' } : gameStatus(chess)
  const botTurn = !status.over && chess.turn() !== humanColor
  const history = chess.history({ verbose: true })
  const last = history.at(-1)

  useEffect(() => {
    if (!botTurn) return undefined
    let cancelled = false
    setThinking(true)
    const started = Date.now()
    askBot(fen, level).then((move) => {
      const wait = Math.max(0, 300 - (Date.now() - started))
      setTimeout(() => {
        if (cancelled || !move) return
        setMoves((m) => {
          const c = replay(m)
          if (c.fen() !== fen) return m
          return [...m, c.move(move).san]
        })
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
      setMoves([...moves, done.san])
    } catch {
      // lance inválido — ignora
    }
  }

  const newGame = (color) => {
    setHumanColor(color)
    setMoves([])
    setResigned(false)
    setThinking(false)
  }

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
      <ChessBoard
        fen={fen}
        orientation={humanColor}
        canMove={!status.over && !botTurn}
        onMove={onMove}
        lastMove={last ? { from: last.from, to: last.to } : null}
      />
      <p className="game-status" data-testid="chess-status">
        {status.over
          ? describeResult(status, humanColor)
          : botTurn
            ? thinking
              ? 'O bot está a pensar…'
              : 'Vez do bot…'
            : `É a tua vez (${COLOR_NAME[humanColor]})${status.check ? ' — estás em xeque!' : '.'}`}
      </p>
      <div className="game-actions">
        {status.over ? (
          <button className="share-btn" onClick={() => newGame(humanColor === 'w' ? 'b' : 'w')}>Nova partida</button>
        ) : (
          <>
            <button className="mode-btn" onClick={() => setMoves((m) => m.slice(0, Math.max(0, m.length - (botTurn ? 1 : 2))))} disabled={moves.length < 2 || thinking}>
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

function OnlineBoard({ state, game, me, dispatch, isOnline }) {
  const myColor = me.id === game.white ? 'w' : me.id === game.black ? 'b' : null
  const chess = new Chess(game.fen)
  const status = gameStatus(chess)
  const player = (id) => state.players.find((p) => p.id === id)
  const result = game.result
  const myTurn = !result && myColor && chess.turn() === myColor
  const opponentId = myColor === 'w' ? game.black : game.white

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
      <ChessBoard
        fen={game.fen}
        orientation={myColor || 'w'}
        canMove={myTurn}
        onMove={(mv) => dispatch({ type: 'move', ...mv })}
        lastMove={game.lastMove}
      />
      <p className="game-status" data-testid="chess-status">
        {result
          ? result.winnerId == null
            ? `Empate (${result.reason}).`
            : result.winnerId === me.id
              ? `Ganhaste por ${result.reason}! 🏆`
              : `Ganhou ${player(result.winnerId)?.name} por ${result.reason}.`
          : myTurn
            ? `É a tua vez${status.check ? ' — estás em xeque!' : '.'}`
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

const HELP = (
  <>
    <p>Xadrez clássico. Toca numa peça tua para ver as casas para onde pode ir e depois toca no destino.</p>
    <p>Roque, en passant e promoção estão incluídos. Ganha quem der xeque-mate.</p>
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
          <OnlineGame game="xadrez" logic={xadrezOnline} renderGame={(props) => <OnlineBoard {...props} />} />
        )
      }
    </GameShell>
  )
}
