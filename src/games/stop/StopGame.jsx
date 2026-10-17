import { useEffect, useMemo, useRef, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import { ClockIcon } from '../../components/Icons.jsx'
import { recordResultOnce } from '../../lib/social.js'
import { CATEGORIES, DEFAULT_SETTINGS, stopOnline, startsWithLetter } from './stopLogic.js'

function useSecondsLeft(deadline, serverNow) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (!deadline) return undefined
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - serverNow()) / 1000)))
    tick()
    const t = setInterval(tick, 250)
    return () => clearInterval(t)
  }, [deadline]) // eslint-disable-line react-hooks/exhaustive-deps
  return left
}

function Standings({ state, game, me }) {
  const rows = state.players
    .filter((p) => game.playerIds.includes(p.id))
    .sort((a, b) => (game.scores[b.id] || 0) - (game.scores[a.id] || 0))
  return (
    <ol className="meme-standings" data-testid="stop-standings">
      {rows.map((p, i) => (
        <li key={p.id} className={p.id === me.id ? 'meme-standings__me' : ''}>
          <span className="meme-standings__pos">{i + 1}.</span>
          <Avatar src={p.avatar} seed={p.seed} name={p.name} size={24} />
          <span className="meme-standings__name">{p.name}</span>
          {game.roundPoints && <span className="stop-plus">+{game.roundPoints[p.id] || 0}</span>}
          <span className="meme-standings__pts">{game.scores[p.id] || 0}</span>
        </li>
      ))}
    </ol>
  )
}

function Writing({ game, me, dispatch, serverNow, state }) {
  const [answers, setAnswers] = useState(() => game.answers[me.id] || {})
  const answersRef = useRef(answers)
  answersRef.current = answers
  const left = useSecondsLeft(game.deadline, serverNow)
  const filled = CATEGORIES.filter((_, i) => (answers[i] || '').trim()).length
  const playing = game.playerIds.includes(me.id)

  // Vai guardando no anfitrião.
  useEffect(() => {
    if (!playing) return undefined
    const t = setTimeout(() => dispatch({ type: 'answers', answers }), 400)
    return () => clearTimeout(t)
  }, [answers]) // eslint-disable-line react-hooks/exhaustive-deps

  // Quando alguém carrega em STOP, envia logo o que tiver escrito.
  useEffect(() => () => playing && dispatch({ type: 'answers', answers: answersRef.current }), []) // eslint-disable-line react-hooks/exhaustive-deps

  const progress = (id) => CATEGORIES.filter((_, i) => (game.answers[id]?.[i] || '').trim()).length

  return (
    <div className="stop-writing">
      <div className="stop-letter-row">
        <div className="stop-letter" data-testid="stop-letter">{game.letter}</div>
        <div className="stop-letter-info">
          <span>Ronda {game.round}/{game.settings.rounds}</span>
          <span className={`meme-timer${left <= 10 ? ' meme-timer--hurry' : ''}`}><ClockIcon /> {left}s</span>
        </div>
      </div>
      <div className="stop-progress">
        {state.players.filter((p) => game.playerIds.includes(p.id)).map((p) => (
          <span key={p.id} className="stop-progress__item" title={p.name}>
            <Avatar src={p.avatar} seed={p.seed} name={p.name} size={22} />
            {p.id === me.id ? filled : progress(p.id)}/{CATEGORIES.length}
          </span>
        ))}
      </div>
      {playing ? (
        <>
          <div className="stop-fields">
            {CATEGORIES.map((cat, i) => {
              const v = answers[i] || ''
              const wrong = v.trim() && !startsWithLetter(v, game.letter)
              return (
                <label key={cat} className={`stop-field${wrong ? ' stop-field--wrong' : ''}`}>
                  <span>{cat}</span>
                  <input
                    value={v}
                    onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value.slice(0, 40) }))}
                    placeholder={`${game.letter}…`}
                    autoComplete="off"
                    data-testid={`stop-input-${i}`}
                  />
                </label>
              )
            })}
          </div>
          <button
            className="stop-button"
            disabled={filled < CATEGORIES.length}
            onClick={() => dispatch({ type: 'stop', answers })}
            data-testid="stop-button"
          >
            STOP!
          </button>
          {filled < CATEGORIES.length && <p className="modal-note">Preenche as {CATEGORIES.length} categorias para poderes carregar em STOP.</p>}
        </>
      ) : (
        <p className="game-status">Estás a ver como espectador.</p>
      )}
    </div>
  )
}

function Review({ state, game, me, amHost, dispatch }) {
  const players = state.players.filter((p) => game.playerIds.includes(p.id))
  const stopper = state.players.find((p) => p.id === game.stoppedBy)
  const scored = game.phase === 'resultados'
  return (
    <div className="stop-review">
      <p className="game-status">
        {scored ? `Pontos da ronda ${game.round}` : stopper ? `${stopper.id === me.id ? 'Carregaste' : `${stopper.name} carregou`} em STOP!` : 'Acabou o tempo!'}
        {' '}Letra <strong>{game.letter}</strong>
      </p>
      {!scored && <p className="modal-note">Confere as respostas dos outros e contesta as que não valem.</p>}
      <div className="stop-table-wrap">
        <table className="stop-table" data-testid="stop-table">
          <thead>
            <tr>
              <th />
              {players.map((p) => (
                <th key={p.id}>{p.id === me.id ? 'Tu' : p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((cat, c) => (
              <tr key={cat}>
                <th>{cat}</th>
                {players.map((p) => {
                  const ans = game.answers[p.id]?.[c] || ''
                  const votes = game.contests[`${p.id}:${c}`] || []
                  const mineVote = votes.includes(me.id)
                  const pts = game.roundDetail?.[p.id]?.[c]
                  const bad = !ans.trim() || !startsWithLetter(ans, game.letter)
                  return (
                    <td key={p.id} className={bad ? 'stop-cell--bad' : ''}>
                      <span className="stop-answer">{ans.trim() || '·'}</span>
                      {scored ? (
                        <span className={`stop-pts stop-pts--${pts || 0}`}>{pts ? `+${pts}` : '0'}</span>
                      ) : (
                        !bad && p.id !== me.id && game.playerIds.includes(me.id) && (
                          <button
                            className={`stop-contest${mineVote ? ' stop-contest--on' : ''}`}
                            onClick={() => dispatch({ type: 'contest', target: p.id, cat: c })}
                            title="Contestar esta resposta"
                          >
                            {mineVote ? 'Contestada' : 'Contestar'}{votes.length ? ` (${votes.length})` : ''}
                          </button>
                        )
                      )}
                      {!scored && p.id === me.id && votes.length > 0 && <span className="stop-votes">contestada ({votes.length})</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Standings state={state} game={game} me={me} />
      {amHost ? (
        <button className="share-btn" onClick={() => dispatch({ type: 'next' })}>
          {!scored ? 'Ver pontos' : game.round >= game.settings.rounds ? 'Resultado final' : 'Próxima ronda'}
        </button>
      ) : (
        <p className="modal-note">À espera do anfitrião…</p>
      )}
    </div>
  )
}

function Final({ state, game, me, amHost, dispatch }) {
  const top = Math.max(...game.playerIds.map((id) => game.scores[id] || 0))
  const winners = state.players.filter((p) => game.playerIds.includes(p.id) && (game.scores[p.id] || 0) === top)
  useEffect(() => {
    if (game.playerIds.includes(me.id)) {
      recordResultOnce(`stop-${state.code}-${game.playerIds.map((id) => game.scores[id] || 0).join('.')}-${game.usedLetters.join('')}`, 'stop', top > 0 && (game.scores[me.id] || 0) === top)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="stop-review">
      <h3 className="stop-final">{winners.map((w) => w.name).join(' e ')} {winners.length > 1 ? 'ganharam' : 'ganhou'}!</h3>
      <Standings state={state} game={game} me={me} />
      {amHost && <button className="share-btn" onClick={() => dispatch({ type: 'restart' })}>Jogar outra vez</button>}
    </div>
  )
}

function StopBoard(props) {
  const { game } = props
  return (
    <div className="game-panel game-panel--wide stop">
      {game.phase === 'escrever' && <Writing key={game.round} {...props} />}
      {(game.phase === 'rever' || game.phase === 'resultados') && <Review {...props} />}
      {game.phase === 'final' && <Final {...props} />}
    </div>
  )
}

const HELP = (
  <>
    <p>Em cada ronda sai uma letra. Escreve uma palavra começada por essa letra em cada categoria: Nome, País ou cidade, Animal, Objeto, Comida e Profissão.</p>
    <p>Quem preencher tudo primeiro carrega em <strong>STOP!</strong> e a ronda acaba para todos. Depois podem contestar as respostas que não valem.</p>
    <p>Pontos: 20 se fores o único com resposta na categoria, 10 se a tua resposta for diferente das outras e 5 se for repetida.</p>
  </>
)

export default function StopGame() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const prepareStart = useMemo(() => async () => ({ settings }), [settings])
  const lobbyOptions = ({ amHost }) =>
    amHost ? (
      <div className="meme-settings">
        <label>
          Rondas
          <select value={settings.rounds} onChange={(e) => setSettings((s) => ({ ...s, rounds: Number(e.target.value) }))}>
            {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>
          Tempo por ronda
          <select value={settings.seconds} onChange={(e) => setSettings((s) => ({ ...s, seconds: Number(e.target.value) }))}>
            {[60, 90, 120, 180].map((n) => <option key={n} value={n}>{n}s</option>)}
          </select>
        </label>
      </div>
    ) : null
  return (
    <GameShell game="stop" title="Stop" help={HELP} modes={[{ key: 'online', label: 'Multiplayer' }]}>
      {() => (
        <OnlineGame game="stop" logic={stopOnline} renderGame={(props) => <StopBoard {...props} />} renderLobbyOptions={lobbyOptions} prepareStart={prepareStart} />
      )}
    </GameShell>
  )
}
