import { useEffect, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import BotLevelPicker from '../../components/BotLevelPicker.jsx'
import Scoreboard from '../../components/Scoreboard.jsx'
import { ROWS, COLS, emptyBoard, play, winnerOf, botMove, quatroOnline } from './quatroLogic.js'

const Disc = ({ player }) => <span className={`quatro-disc quatro-disc--p${player}`} />

function Board({ board, onDrop, canPlay, winCells, lastMove }) {
  const [hover, setHover] = useState(null)
  return (
    <div className="quatro-board" onMouseLeave={() => setHover(null)}>
      {Array.from({ length: COLS }, (_, c) => (
        <button
          key={c}
          className={`quatro-col${hover === c && canPlay ? ' quatro-col--hover' : ''}`}
          onClick={() => onDrop(c)}
          onMouseEnter={() => setHover(c)}
          disabled={!canPlay || board[c] !== 0}
          aria-label={`Coluna ${c + 1}`}
          data-testid={`quatro-col-${c}`}
        >
          {Array.from({ length: ROWS }, (_, r) => {
            const i = r * COLS + c
            return (
              <span
                key={r}
                className={`quatro-slot${winCells?.includes(i) ? ' quatro-slot--win' : ''}${lastMove === i ? ' quatro-slot--last' : ''}`}
              >
                {board[i] ? <Disc player={board[i]} /> : null}
              </span>
            )
          })}
        </button>
      ))}
    </div>
  )
}

function VsBot() {
  const [level, setLevel] = useState('medio')
  const [board, setBoard] = useState(emptyBoard)
  const [human, setHuman] = useState(1) // 1 começa sempre
  const [lastMove, setLastMove] = useState(null)
  const [score, setScore] = useState({ tu: 0, bot: 0, empates: 0 })
  const bot = human === 1 ? 2 : 1
  const result = winnerOf(board)
  const filled = board.filter(Boolean).length
  const turn = filled % 2 === 0 ? 1 : 2

  useEffect(() => {
    if (result || turn !== bot) return undefined
    const t = setTimeout(() => {
      const col = botMove(board, bot, level)
      if (col == null) return
      const next = play(board, col, bot)
      setLastMove(next.findIndex((v, i) => v !== board[i]))
      setBoard(next)
    }, 400)
    return () => clearTimeout(t)
  }, [board, result, turn, bot, level])

  useEffect(() => {
    if (!result) return
    const key = result.player === 0 ? 'empates' : result.player === human ? 'tu' : 'bot'
    setScore((s) => ({ ...s, [key]: s[key] + 1 }))
  }, [result?.player, board]) // eslint-disable-line react-hooks/exhaustive-deps

  const drop = (col) => {
    if (result || turn !== human) return
    const next = play(board, col, human)
    if (!next) return
    setLastMove(next.findIndex((v, i) => v !== board[i]))
    setBoard(next)
  }

  const newGame = () => {
    setBoard(emptyBoard())
    setLastMove(null)
    setHuman((h) => (h === 1 ? 2 : 1))
  }

  return (
    <div className="game-panel">
      <BotLevelPicker value={level} onChange={setLevel} />
      <Scoreboard
        sides={[
          { name: 'Tu', score: score.tu, active: !result && turn === human, badge: <Disc player={human} /> },
          { name: 'Bot', seed: 'bot-quatro', score: score.bot, active: !result && turn === bot, badge: <Disc player={bot} /> },
        ]}
        draws={score.empates}
      />
      <Board board={board} onDrop={drop} canPlay={!result && turn === human} winCells={result?.cells} lastMove={lastMove} />
      <p className="game-status" data-testid="quatro-status">
        {result
          ? result.player === 0
            ? 'Empate!'
            : result.player === human
              ? 'Ganhaste!'
              : 'O bot ganhou.'
          : turn === human
            ? 'É a tua vez.'
            : 'O bot está a pensar…'}
      </p>
      {result && <button className="share-btn" onClick={newGame}>Jogar outra vez</button>}
    </div>
  )
}

function OnlineBoard({ state, game, me, dispatch, isOnline }) {
  const mySeat = game.order.indexOf(me.id)
  const result = game.result
  const player = (id) => state.players.find((p) => p.id === id)
  const turnPlayer = player(game.order[game.turn])

  return (
    <div className="game-panel">
      <Scoreboard
        sides={game.order.map((id, seat) => {
          const p = player(id)
          return {
            name: `${p?.name ?? '?'}${p && !isOnline(p.id) ? ' · offline' : ''}`,
            avatar: p?.avatar,
            seed: p?.seed,
            score: game.score[id] ?? 0,
            active: !result && game.turn === seat,
            badge: <Disc player={seat + 1} />,
          }
        })}
        draws={game.score.empates}
      />
      <Board
        board={game.board}
        onDrop={(col) => dispatch({ type: 'drop', col })}
        canPlay={!result && mySeat === game.turn}
        winCells={result?.cells}
        lastMove={game.lastMove}
      />
      <p className="game-status" data-testid="quatro-status">
        {result
          ? result.winnerId == null
            ? 'Empate!'
            : result.winnerId === me.id
              ? 'Ganhaste!'
              : `Ganhou ${player(result.winnerId)?.name}.`
          : mySeat === game.turn
            ? 'É a tua vez.'
            : `Vez de ${turnPlayer?.name}…`}
      </p>
      {result && mySeat >= 0 && (
        <button className="share-btn" onClick={() => dispatch({ type: 'rematch' })}>Desforra</button>
      )}
    </div>
  )
}

const HELP = (
  <>
    <p>Escolhe uma coluna para deixar cair a tua peça — ela cai até ao fundo.</p>
    <p>Ganha quem juntar primeiro <strong>4 peças seguidas</strong>: na horizontal, vertical ou diagonal.</p>
    <p className="modal-note">Na desforra, quem começa troca.</p>
  </>
)

export default function QuatroGame() {
  return (
    <GameShell
      game="quatro"
      title="4 em Linha"
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
          <OnlineGame game="quatro" logic={quatroOnline} renderGame={(props) => <OnlineBoard {...props} />} />
        )
      }
    </GameShell>
  )
}
