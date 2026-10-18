import { useEffect, useState } from 'react'
import { gameBreak } from '../../lib/ads.js'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import BotLevelPicker from '../../components/BotLevelPicker.jsx'
import Scoreboard from '../../components/Scoreboard.jsx'
import { recordResultOnce } from '../../lib/social.js'
import { winnerOf, nextMark, botMove, galoOnline } from './galoLogic.js'

function Board({ board, onPlay, canPlay, line }) {
  return (
    <div className="galo-board" role="grid" aria-label="Tabuleiro do jogo do galo">
      {board.map((cell, i) => (
        <button
          key={i}
          className={`galo-cell${cell ? ` galo-cell--${cell.toLowerCase()}` : ''}${line?.includes(i) ? ' galo-cell--win' : ''}`}
          onClick={() => onPlay(i)}
          disabled={!canPlay || !!cell}
          aria-label={`Casa ${i + 1}${cell ? `: ${cell}` : ''}`}
          data-testid={`galo-cell-${i}`}
        >
          {cell === 'X' && (
            <svg viewBox="0 0 40 40" className="galo-mark" aria-hidden="true">
              <path d="M10 10 L30 30 M30 10 L10 30" />
            </svg>
          )}
          {cell === 'O' && (
            <svg viewBox="0 0 40 40" className="galo-mark" aria-hidden="true">
              <circle cx="20" cy="20" r="11" />
            </svg>
          )}
        </button>
      ))}
    </div>
  )
}

function VsBot() {
  const [level, setLevel] = useState('medio')
  const [board, setBoard] = useState(Array(9).fill(null))
  const [humanMark, setHumanMark] = useState('X')
  const [score, setScore] = useState({ tu: 0, bot: 0, empates: 0 })
  const botMark = humanMark === 'X' ? 'O' : 'X'
  const result = winnerOf(board)
  const turn = nextMark(board)

  useEffect(() => {
    if (result || turn !== botMark) return undefined
    const t = setTimeout(() => {
      setBoard((b) => {
        if (winnerOf(b) || nextMark(b) !== botMark) return b
        const i = botMove(b, botMark, level)
        const next = [...b]
        next[i] = botMark
        return next
      })
    }, 350)
    return () => clearTimeout(t)
  }, [board, result, turn, botMark, level])

  useEffect(() => {
    if (!result) return
    recordResultOnce(`galo-bot-${Date.now()}`, 'galo', result.mark === humanMark)
    setScore((s) => {
      const key = result.mark === 'empate' ? 'empates' : result.mark === humanMark ? 'tu' : 'bot'
      return { ...s, [key]: s[key] + 1 }
    })
  }, [result?.mark, board]) // eslint-disable-line react-hooks/exhaustive-deps

  const play = (i) => {
    if (result || turn !== humanMark || board[i]) return
    const next = [...board]
    next[i] = humanMark
    setBoard(next)
  }

  const newGame = () => {
    setBoard(Array(9).fill(null))
    setHumanMark((m) => (m === 'X' ? 'O' : 'X')) // alterna quem começa
  }

  return (
    <div className="game-panel">
      <BotLevelPicker value={level} onChange={setLevel} />
      <Scoreboard
        sides={[
          { name: `Tu (${humanMark})`, score: score.tu, active: !result && turn === humanMark },
          { name: `Bot (${botMark})`, score: score.bot, seed: 'bot-galo', active: !result && turn === botMark },
        ]}
        draws={score.empates}
      />
      <Board board={board} onPlay={play} canPlay={!result && turn === humanMark} line={result?.line} />
      <p className="game-status" data-testid="galo-status">
        {result
          ? result.mark === 'empate'
            ? 'Empate!'
            : result.mark === humanMark
              ? 'Ganhaste!'
              : 'O bot ganhou.'
          : turn === humanMark
            ? 'É a tua vez.'
            : 'O bot está a pensar…'}
      </p>
      {result && (
        <button className="share-btn" onClick={() => gameBreak('galo', newGame)}>Jogar outra vez</button>
      )}
    </div>
  )
}

function OnlineBoard({ state, game, me, dispatch, isOnline }) {
  const myMark = game.marks[me.id]
  useEffect(() => {
    if (game.result && myMark) recordResultOnce(`galo-${state.code}-${game.round}`, 'galo', game.result.winnerId === me.id)
  }, [game.result, game.round]) // eslint-disable-line react-hooks/exhaustive-deps
  const turn = nextMark(game.board)
  const byMark = (mark) => state.players.find((p) => game.marks[p.id] === mark)
  const turnPlayer = byMark(turn)
  const result = game.result

  return (
    <div className="game-panel">
      <Scoreboard
        sides={['X', 'O'].map((mark) => {
          const p = byMark(mark)
          return {
            name: `${p?.name ?? '?'} (${mark})${p && !isOnline(p.id) ? ' · offline' : ''}`,
            avatar: p?.avatar,
            seed: p?.seed,
            score: game.score[p?.id] ?? 0,
            active: !result && turn === mark,
          }
        })}
        draws={game.score.empates}
      />
      <Board
        board={game.board}
        onPlay={(i) => dispatch({ type: 'move', index: i })}
        canPlay={!result && myMark === turn}
        line={result?.line}
      />
      <p className="game-status" data-testid="galo-status">
        {result
          ? result.winnerId == null
            ? 'Empate!'
            : result.winnerId === me.id
              ? 'Ganhaste!'
              : `Ganhou ${state.players.find((p) => p.id === result.winnerId)?.name}.`
          : myMark === turn
            ? `É a tua vez (${myMark}).`
            : `Vez de ${turnPlayer?.name}…`}
      </p>
      {result && myMark && (
        <button className="share-btn" onClick={() => dispatch({ type: 'rematch' })}>Desforra</button>
      )}
    </div>
  )
}

const HELP = (
  <>
    <p>Joga à vez com o adversário: um é o <strong>X</strong>, o outro o <strong>O</strong>. O X começa.</p>
    <p>Ganha quem fizer primeiro três em linha, na horizontal, vertical ou diagonal.</p>
    <p className="modal-note">Online: cria uma sala e envia o link a um amigo.</p>
  </>
)

export default function GaloGame() {
  return (
    <GameShell
      game="galo"
      title="Jogo do Galo"
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
          <OnlineGame game="galo" logic={galoOnline} renderGame={(props) => <OnlineBoard {...props} />} />
        )
      }
    </GameShell>
  )
}
