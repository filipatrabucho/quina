import { useEffect, useMemo, useRef, useState } from 'react'
import { gameBreak } from '../../lib/ads.js'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import { Timer, Standings, winnersOf, SettingSelect, useCountdown } from '../../components/rooms/PartyBits.jsx'
import { recordResultOnce } from '../../lib/social.js'
import { CATEGORIES, PUZZLES } from './puzzles.js'
import { DEFAULT_SETTINGS, checkGuess, hintFor, pickPuzzles, pointsFor, puzzleOf, emojisOnline } from './emojisLogic.js'

const CATEGORY_OPTIONS = ['tudo', ...Object.keys(CATEGORIES)]
const PLURAL = { tudo: 'Tudo', filme: 'Filmes', serie: 'Séries', jogo: 'Jogos', personagem: 'Personagens' }
const categoryLabel = (c) => PLURAL[c]

function Puzzle({ puzzle, showHint, reveal }) {
  return (
    <div className="emoji-puzzle">
      <span className="emoji-puzzle__cat">{CATEGORIES[puzzle.c]}</span>
      <div className="emoji-puzzle__emojis" data-testid="emoji-puzzle">{puzzle.e}</div>
      {reveal ? (
        <p className="emoji-puzzle__answer" data-testid="emoji-answer">{puzzle.a[0]}{puzzle.a[1] && puzzle.a[1] !== puzzle.a[0] ? <small> ({puzzle.a[1]})</small> : null}</p>
      ) : showHint ? (
        <p className="emoji-puzzle__hint" data-testid="emoji-hint">{hintFor(puzzle.a[0])}</p>
      ) : (
        <p className="emoji-puzzle__hint emoji-puzzle__hint--off">A pista aparece a meio do tempo</p>
      )}
    </div>
  )
}

function GuessBox({ puzzle, onCorrect, disabled }) {
  const [text, setText] = useState('')
  const [feedback, setFeedback] = useState(null)
  const inputRef = useRef(null)
  useEffect(() => {
    setText('')
    setFeedback(null)
    inputRef.current?.focus()
  }, [puzzle])
  const submit = (e) => {
    e.preventDefault()
    if (!text.trim() || disabled) return
    const r = checkGuess(text, puzzle)
    if (r === 'certo') {
      onCorrect(text)
      setText('')
      setFeedback(null)
    } else {
      setFeedback(r === 'quase' ? 'Quase! Estás perto.' : 'Não é isso.')
      setText('')
    }
  }
  return (
    <form className="emoji-guess" onSubmit={submit}>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escreve o nome (PT ou inglês)"
        disabled={disabled}
        autoComplete="off"
        data-testid="emoji-input"
      />
      <button className="share-btn" type="submit" disabled={disabled || !text.trim()} data-testid="emoji-send">Enviar</button>
      {feedback && <p className={`emoji-feedback${feedback.startsWith('Quase') ? ' emoji-feedback--close' : ''}`} data-testid="emoji-feedback">{feedback}</p>}
    </form>
  )
}

// ---- Solo: 10 enigmas, 30 segundos cada.
const SOLO_SECONDS = 30
function Solo() {
  const [category, setCategory] = useState('tudo')
  const [run, setRun] = useState(null) // { ids, i, score, results, deadline, phase }
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!run || run.phase === 'fim') return undefined
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [run])

  const puzzle = run && run.phase !== 'fim' ? PUZZLES[run.ids[run.i]] : null
  const left = run ? Math.max(0, run.deadline - now) : 0

  const finishPuzzle = (gotIt) =>
    setRun((r) => {
      if (!r || r.phase !== 'jogar') return r
      const pts = gotIt ? pointsFor(r.deadline - Date.now(), SOLO_SECONDS * 1000, false) - (r.hinted ? 25 : 0) : 0
      return { ...r, phase: 'ver', score: r.score + pts, results: [...r.results, { id: r.ids[r.i], pts }], until: Date.now() + 2200 }
    })

  useEffect(() => {
    if (!run) return
    if (run.phase === 'jogar' && left <= 0) finishPuzzle(false)
    if (run.phase === 'ver' && now >= run.until) {
      setRun((r) => (r.i + 1 >= r.ids.length ? { ...r, phase: 'fim' } : { ...r, i: r.i + 1, phase: 'jogar', hinted: false, deadline: Date.now() + SOLO_SECONDS * 1000 }))
    }
  }, [now]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (run?.phase === 'fim') recordResultOnce(`emojis-solo-${Date.now()}`, 'emojis', run.results.filter((r) => r.pts > 0).length >= 7, String(run.score))
  }, [run?.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!run) {
    return (
      <div className="game-panel">
        <p className="game-status">Descobre o filme, série, jogo ou personagem escondido nos emojis. São 10 enigmas de {SOLO_SECONDS} segundos.</p>
        <div className="bot-levels">
          {CATEGORY_OPTIONS.map((c) => (
            <button key={c} className={`mode-btn${category === c ? ' mode-btn--active' : ''}`} onClick={() => setCategory(c)}>{categoryLabel(c)}</button>
          ))}
        </div>
        <button className="share-btn" onClick={() => setRun({ ids: pickPuzzles(10, category), i: 0, score: 0, results: [], phase: 'jogar', hinted: false, deadline: Date.now() + SOLO_SECONDS * 1000 })} data-testid="emoji-start">
          Começar
        </button>
      </div>
    )
  }

  if (run.phase === 'fim') {
    const right = run.results.filter((r) => r.pts > 0).length
    return (
      <div className="game-panel game-panel--wide emoji">
        <h3 className="stop-final" data-testid="emoji-final">{run.score} pontos · {right}/{run.ids.length} certos</h3>
        <ul className="emoji-recap">
          {run.results.map((r) => (
            <li key={r.id} className={r.pts ? 'ok' : ''}>
              <span>{PUZZLES[r.id].e}</span> {PUZZLES[r.id].a[0]} <b>{r.pts ? `+${r.pts}` : '0'}</b>
            </li>
          ))}
        </ul>
        <button className="share-btn" onClick={() => gameBreak('emojis', () => setRun(null))}>Jogar outra vez</button>
      </div>
    )
  }

  const halfway = left <= (SOLO_SECONDS * 1000) / 2
  const last = run.phase === 'ver' ? run.results[run.results.length - 1] : null
  return (
    <div className="game-panel game-panel--wide emoji">
      <div className="meme-topbar">
        <span className="meme-round">Enigma {run.i + 1}/{run.ids.length} · {run.score} pts</span>
        <span className={`meme-timer${left <= 10000 ? ' meme-timer--hurry' : ''}`}>{Math.ceil(left / 1000)}s</span>
      </div>
      <Puzzle puzzle={puzzle} showHint={halfway || run.hinted} reveal={run.phase === 'ver'} />
      {run.phase === 'ver' ? (
        <p className={`game-status ${last.pts ? 'emoji-ok' : ''}`}>{last.pts ? `Certo! +${last.pts}` : 'Não foi desta.'}</p>
      ) : (
        <>
          <GuessBox puzzle={puzzle} onCorrect={() => finishPuzzle(true)} />
          <div className="game-actions">
            {!halfway && !run.hinted && <button className="mode-btn" onClick={() => setRun((r) => ({ ...r, hinted: true }))}>Pista (−25)</button>}
            <button className="link-btn" onClick={() => finishPuzzle(false)}>Passar</button>
          </div>
        </>
      )}
    </div>
  )
}

// ---- Multiplayer
function Round({ state, game, me, dispatch, serverNow }) {
  const puzzle = puzzleOf(game)
  const left = useCountdown(game.deadline, serverNow)
  const reveal = game.phase === 'revelar'
  const playing = game.playerIds.includes(me.id)
  const solvedMe = !!game.solved[me.id]
  const players = state.players.filter((p) => game.playerIds.includes(p.id))
  return (
    <>
      <Puzzle puzzle={puzzle} showHint={left <= game.settings.seconds / 2} reveal={reveal} />
      {!reveal && playing && !solvedMe && <GuessBox puzzle={puzzle} onCorrect={(text) => dispatch({ type: 'guess', text })} />}
      {!reveal && solvedMe && <p className="game-status emoji-ok" data-testid="emoji-solved">Acertaste! +{game.solved[me.id].points}. Espera pelos outros…</p>}
      <div className="emoji-solvers">
        {players.map((p) => {
          const s = game.solved[p.id]
          return (
            <span key={p.id} className={`emoji-solver${s ? ' emoji-solver--ok' : ''}`}>
              <Avatar src={p.avatar} seed={p.seed} name={p.name} size={24} />
              {p.id === me.id ? 'Tu' : p.name}
              {s ? <b>+{s.points}</b> : <small>{game.tries[p.id] ? `${game.tries[p.id]} tent.` : ''}</small>}
            </span>
          )
        })}
      </div>
      <Standings state={state} game={game} me={me} />
    </>
  )
}

function Final({ state, game, me, amHost, dispatch }) {
  const { top, winners } = winnersOf(state, game)
  useEffect(() => {
    if (game.playerIds.includes(me.id)) {
      recordResultOnce(`emojis-${state.code}-${game.puzzles.join('.')}`, 'emojis', top > 0 && (game.scores[me.id] || 0) === top)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="stop-review">
      <h3 className="stop-final">{winners.map((w) => w.name).join(' e ')} {winners.length > 1 ? 'ganharam' : 'ganhou'}!</h3>
      <Standings state={state} game={game} me={me} />
      <ul className="emoji-recap">
        {game.puzzles.map((id) => (
          <li key={id}><span>{PUZZLES[id].e}</span> {PUZZLES[id].a[0]}</li>
        ))}
      </ul>
      {amHost && <button className="share-btn" onClick={() => dispatch({ type: 'restart' })}>Jogar outra vez</button>}
    </div>
  )
}

function Board(props) {
  const { game, serverNow, amHost, dispatch } = props
  return (
    <div className="game-panel game-panel--wide emoji">
      <div className="meme-topbar">
        <span className="meme-round">{game.phase === 'final' ? 'Fim do jogo' : `Enigma ${game.round}/${game.puzzles.length}`}</span>
        <Timer deadline={game.phase === 'adivinhar' ? game.deadline : null} serverNow={serverNow} />
      </div>
      {game.phase === 'final' ? <Final {...props} /> : <Round {...props} />}
      {amHost && game.phase !== 'final' && (
        <button className="link-btn" onClick={() => dispatch({ type: 'next' })}>{game.phase === 'adivinhar' ? 'Revelar' : 'Seguinte'} →</button>
      )}
    </div>
  )
}

const HELP = (
  <>
    <p>Cada enigma esconde um filme, série, jogo ou personagem em emojis. Escreve o nome em português ou em inglês; pequenas gralhas contam.</p>
    <p>Quanto mais depressa acertares, mais pontos ganhas (até 150), e o primeiro a acertar leva +25. A meio do tempo aparece a primeira letra de cada palavra.</p>
  </>
)

export default function EmojisGame() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const prepareStart = useMemo(() => async () => ({ settings }), [settings])
  const lobbyOptions = ({ amHost }) =>
    amHost ? (
      <div className="meme-settings">
        <SettingSelect label="Enigmas" value={settings.rounds} options={[5, 10, 15, 20]} onChange={(v) => setSettings((s) => ({ ...s, rounds: v }))} />
        <SettingSelect label="Tempo" value={settings.seconds} options={[20, 30, 45, 60]} format={(v) => `${v}s`} onChange={(v) => setSettings((s) => ({ ...s, seconds: v }))} />
        <SettingSelect label="Tema" value={settings.category} options={CATEGORY_OPTIONS} format={categoryLabel} onChange={(v) => setSettings((s) => ({ ...s, category: v }))} />
      </div>
    ) : null
  return (
    <GameShell
      game="emojis"
      title="Emoji Battle"
      help={HELP}
      modes={[
        { key: 'online', label: 'Multiplayer' },
        { key: 'solo', label: 'Solo' },
      ]}
    >
      {(mode) =>
        mode === 'solo' ? <Solo /> : <OnlineGame game="emojis" logic={emojisOnline} renderGame={(props) => <Board {...props} />} renderLobbyOptions={lobbyOptions} prepareStart={prepareStart} />
      }
    </GameShell>
  )
}
