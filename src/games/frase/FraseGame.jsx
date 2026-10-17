import { useEffect, useMemo, useRef, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import { Timer, PlayerLine, Standings, winnersOf, SettingSelect } from '../../components/rooms/PartyBits.jsx'
import { recordResultOnce } from '../../lib/social.js'
import { DEFAULT_SETTINGS, MAX_LEN, fraseOnline } from './fraseLogic.js'

function Prompt({ text, ending }) {
  return (
    <blockquote className="phrase-prompt" data-testid="phrase-prompt">
      {text}
      {ending ? <strong> {ending}</strong> : <span className="phrase-prompt__dots"> …</span>}
    </blockquote>
  )
}

function Writing({ game, me, dispatch }) {
  const saved = game.answers[me.id]
  const [text, setText] = useState(saved?.text || '')
  const [done, setDone] = useState(!!saved?.done)
  const playing = game.playerIds.includes(me.id)
  const first = useRef(true)
  useEffect(() => {
    if (!playing) return undefined
    if (first.current) {
      first.current = false
      return undefined
    }
    const t = setTimeout(() => dispatch({ type: 'submit', text, done }), 350)
    return () => clearTimeout(t)
  }, [text, done]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="phrase-write">
      <Prompt text={game.prompt} />
      {playing ? (
        <>
          <textarea
            className="phrase-input"
            value={text}
            maxLength={MAX_LEN}
            disabled={done}
            rows={3}
            autoFocus
            placeholder="Continua a frase…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (text.trim()) setDone(true)
              }
            }}
            data-testid="phrase-input"
          />
          <div className="phrase-actions">
            <span className="modal-note">{text.length}/{MAX_LEN}</span>
            {done ? (
              <button className="mode-btn" onClick={() => setDone(false)}>Editar</button>
            ) : (
              <button className="share-btn" disabled={!text.trim()} onClick={() => setDone(true)} data-testid="phrase-done">Pronto!</button>
            )}
          </div>
        </>
      ) : (
        <p className="game-status">Estás a ver como espectador.</p>
      )}
    </div>
  )
}

function Voting({ game, me, dispatch }) {
  const myVote = game.votes[me.id]
  const playing = game.playerIds.includes(me.id)
  return (
    <div className="phrase-vote">
      <Prompt text={game.prompt} />
      <p className="game-status">{playing ? 'Qual é a melhor continuação?' : 'A votação está a decorrer.'}</p>
      <div className="phrase-list">
        {game.order.map((id) => {
          const mine = id === me.id
          return (
            <button
              key={id}
              className={`phrase-card${myVote === id ? ' phrase-card--voted' : ''}${mine ? ' phrase-card--mine' : ''}`}
              disabled={mine || !playing}
              onClick={() => dispatch({ type: 'vote', target: id })}
              data-testid="phrase-vote"
            >
              <span className="phrase-card__text">… {game.answers[id].text}</span>
              <span className="phrase-card__label">{mine ? 'A tua' : myVote === id ? '✓ O teu voto' : 'Votar'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Results({ state, game, me }) {
  const name = (id) => state.players.find((p) => p.id === id)?.name
  const ranked = [...game.order].sort((a, b) => (game.tally[b] || 0) - (game.tally[a] || 0))
  return (
    <div className="phrase-vote">
      <Prompt text={game.prompt} />
      {ranked.length === 0 && <p className="modal-note">Ninguém escreveu nada nesta ronda.</p>}
      <div className="phrase-list">
        {ranked.map((id, i) => (
          <div key={id} className={`phrase-card phrase-card--result${i === 0 && game.tally[id] ? ' phrase-card--winner' : ''}`}>
            <span className="phrase-card__text">… {game.answers[id].text}</span>
            <span className="phrase-card__label">
              {name(id)}{id === me.id ? ' (tu)' : ''} · {game.tally[id] || 0} voto(s) · +{game.roundPoints[id] || 0}
            </span>
          </div>
        ))}
      </div>
      <Standings state={state} game={game} me={me} plus={game.roundPoints} />
    </div>
  )
}

function Final({ state, game, me, amHost, dispatch }) {
  const { top, winners } = winnersOf(state, game)
  useEffect(() => {
    if (game.playerIds.includes(me.id)) {
      recordResultOnce(`frase-${state.code}-${game.playerIds.map((id) => game.scores[id] || 0).join('.')}-${game.hall.length}-${game.prompt.length}`, 'frase', top > 0 && (game.scores[me.id] || 0) === top)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="phrase-vote">
      <h3 className="stop-final">{winners.map((w) => w.name).join(' e ')} {winners.length > 1 ? 'ganharam' : 'ganhou'}!</h3>
      <Standings state={state} game={game} me={me} />
      {game.hall.length > 0 && (
        <>
          <h4>As melhores frases</h4>
          <div className="phrase-list">
            {game.hall.map((h, i) => (
              <div key={i} className="phrase-card phrase-card--result">
                <span className="phrase-card__text">{h.prompt} <strong>{h.text}</strong></span>
                <span className="phrase-card__label">Ronda {h.round} · {state.players.find((p) => p.id === h.playerId)?.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {amHost && <button className="share-btn" onClick={() => dispatch({ type: 'restart' })}>Jogar outra vez</button>}
    </div>
  )
}

function Board(props) {
  const { state, game, serverNow, amHost, dispatch } = props
  const players = state.players.filter((p) => game.playerIds.includes(p.id))
  const label = { escrever: 'Continua a frase', votar: 'Votação', resultados: 'Resultados', final: 'Fim do jogo' }[game.phase]
  return (
    <div className="game-panel game-panel--wide phrase">
      <div className="meme-topbar">
        <span className="meme-round">{game.phase === 'final' ? label : `Ronda ${game.round}/${game.settings.rounds} · ${label}`}</span>
        <Timer deadline={game.deadline} serverNow={serverNow} />
      </div>
      {game.phase === 'escrever' && <PlayerLine players={players} highlight={(id) => game.answers[id]?.done} />}
      {game.phase === 'votar' && <PlayerLine players={players} highlight={(id) => !!game.votes[id]} />}
      {game.phase === 'escrever' && <Writing key={game.round} {...props} />}
      {game.phase === 'votar' && <Voting {...props} />}
      {game.phase === 'resultados' && <Results {...props} />}
      {game.phase === 'final' && <Final {...props} />}
      {amHost && game.phase !== 'final' && (
        <button className="link-btn" onClick={() => dispatch({ type: 'next' })}>
          {game.phase === 'escrever' ? 'Saltar para a votação' : game.phase === 'votar' ? 'Ver resultados' : game.round >= game.settings.rounds ? 'Resultado final' : 'Próxima ronda'} →
        </button>
      )}
    </div>
  )
}

const HELP = (
  <>
    <p>Em cada ronda aparece o início de uma frase. Todos têm o mesmo tempo para escrever a continuação mais engraçada.</p>
    <p>Depois votam na melhor (não podes votar na tua). Cada voto vale <strong>100 pontos</strong> e a frase mais votada da ronda ganha <strong>+50</strong>.</p>
  </>
)

export default function FraseGame() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const prepareStart = useMemo(() => async () => ({ settings }), [settings])
  const lobbyOptions = ({ amHost }) =>
    amHost ? (
      <div className="meme-settings">
        <SettingSelect label="Rondas" value={settings.rounds} options={[3, 5, 8, 10]} onChange={(v) => setSettings((s) => ({ ...s, rounds: v }))} />
        <SettingSelect label="Tempo para escrever" value={settings.seconds} options={[30, 45, 60, 90]} format={(v) => `${v}s`} onChange={(v) => setSettings((s) => ({ ...s, seconds: v }))} />
      </div>
    ) : null
  return (
    <GameShell game="frase" title="Continua a Frase" help={HELP} modes={[{ key: 'online', label: 'Multiplayer' }]}>
      {() => <OnlineGame game="frase" logic={fraseOnline} renderGame={(props) => <Board {...props} />} renderLobbyOptions={lobbyOptions} prepareStart={prepareStart} />}
    </GameShell>
  )
}
