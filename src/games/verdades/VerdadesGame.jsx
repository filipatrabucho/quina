import { useEffect, useMemo, useRef, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import { Timer, PlayerLine, Standings, winnersOf, SettingSelect } from '../../components/rooms/PartyBits.jsx'
import { recordResultOnce } from '../../lib/social.js'
import { DEFAULT_SETTINGS, MAX_LEN, verdadesOnline, subjectOf, lieShown } from './verdadesLogic.js'

function Writing({ game, me, dispatch }) {
  const saved = game.entries[me.id]
  const [statements, setStatements] = useState(() => saved?.statements || ['', '', ''])
  const [lie, setLie] = useState(saved?.lie ?? null)
  const [done, setDone] = useState(!!saved?.done)
  const playing = game.playerIds.includes(me.id)
  const ready = statements.every((s) => s.trim()) && lie !== null
  const first = useRef(true)

  useEffect(() => {
    if (!playing) return undefined
    if (first.current) {
      first.current = false
      return undefined
    }
    const t = setTimeout(() => dispatch({ type: 'submit', entry: { statements, lie, done } }), 350)
    return () => clearTimeout(t)
  }, [statements, lie, done]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!playing) return <p className="game-status">Estás a ver como espectador.</p>
  return (
    <div className="truths-write">
      <p className="game-status">Escreve duas verdades e uma mentira sobre ti. Depois marca qual é a mentira.</p>
      {statements.map((s, i) => (
        <div key={i} className={`truths-field${lie === i ? ' truths-field--lie' : ''}`}>
          <input
            value={s}
            maxLength={MAX_LEN}
            disabled={done}
            placeholder={['Ex.: Já fui ao Japão', 'Ex.: Tenho medo de pombos', 'Ex.: Sei tocar piano'][i]}
            onChange={(e) => setStatements((list) => list.map((x, k) => (k === i ? e.target.value : x)))}
            data-testid={`truth-input-${i}`}
          />
          <button className={`truths-liebtn${lie === i ? ' on' : ''}`} disabled={done} onClick={() => setLie(i)} data-testid={`truth-lie-${i}`}>
            {lie === i ? 'Mentira' : 'É mentira?'}
          </button>
        </div>
      ))}
      {done ? (
        <button className="mode-btn" onClick={() => setDone(false)}>Editar</button>
      ) : (
        <button className="share-btn" disabled={!ready} onClick={() => setDone(true)} data-testid="truth-done">Pronto!</button>
      )}
      {!ready && <p className="modal-note">Preenche as três frases e escolhe a mentira.</p>}
    </div>
  )
}

function Guessing({ state, game, me, dispatch }) {
  const subject = subjectOf(game)
  const person = state.players.find((p) => p.id === subject)
  const entry = game.entries[subject]
  const reveal = game.phase === 'revelar'
  const lie = lieShown(game)
  const myVote = game.votes[me.id]
  const canVote = !reveal && subject !== me.id && game.playerIds.includes(me.id)
  const voters = (i) => Object.entries(game.votes).filter(([, v]) => v === i).map(([id]) => state.players.find((p) => p.id === id)).filter(Boolean)
  return (
    <div className="truths-guess">
      <div className="truths-subject">
        <Avatar src={person?.avatar} seed={person?.seed} name={person?.name} size={44} />
        <p className="game-status">
          {reveal ? `A mentira de ${subject === me.id ? 'ti' : person?.name} era…` : subject === me.id ? 'São as tuas frases! Vê se os enganas.' : `Qual é a mentira de ${person?.name}?`}
        </p>
      </div>
      <div className="truths-options">
        {game.perm.map((orig, i) => (
          <button
            key={i}
            className={`truths-option${myVote === i ? ' truths-option--voted' : ''}${reveal ? (i === lie ? ' truths-option--lie' : ' truths-option--true') : ''}`}
            disabled={!canVote}
            onClick={() => dispatch({ type: 'vote', index: i })}
            data-testid={`truth-option-${i}`}
          >
            <span className="truths-option__text">{entry.statements[orig]}</span>
            {reveal && <span className="truths-option__tag">{i === lie ? 'Mentira' : 'Verdade'}</span>}
            {reveal && voters(i).length > 0 && (
              <span className="truths-option__voters">
                {voters(i).map((p) => <Avatar key={p.id} src={p.avatar} seed={p.seed} name={p.name} size={20} />)}
              </span>
            )}
          </button>
        ))}
      </div>
      {reveal && <Standings state={state} game={game} me={me} plus={game.roundPoints} />}
    </div>
  )
}

function Final({ state, game, me, amHost, dispatch }) {
  const { top, winners } = winnersOf(state, game)
  useEffect(() => {
    if (game.playerIds.includes(me.id)) {
      recordResultOnce(`verdades-${state.code}-${game.playerIds.map((id) => game.scores[id] || 0).join('.')}-${game.queue.join('')}`, 'verdades', top > 0 && (game.scores[me.id] || 0) === top)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="stop-review">
      <h3 className="stop-final">{game.queue.length === 0 ? 'Ninguém escreveu frases.' : `${winners.map((w) => w.name).join(' e ')} ${winners.length > 1 ? 'ganharam' : 'ganhou'}!`}</h3>
      <Standings state={state} game={game} me={me} />
      {amHost && <button className="share-btn" onClick={() => dispatch({ type: 'restart' })}>Jogar outra vez</button>}
    </div>
  )
}

function Board(props) {
  const { state, game, serverNow, amHost, dispatch } = props
  const players = state.players.filter((p) => game.playerIds.includes(p.id))
  const label = {
    escrever: 'Escreve as tuas frases',
    adivinhar: `Jogador ${game.current + 1} de ${game.queue.length}`,
    revelar: `Jogador ${game.current + 1} de ${game.queue.length}`,
    final: 'Fim do jogo',
  }[game.phase]
  return (
    <div className="game-panel game-panel--wide truths">
      <div className="meme-topbar">
        <span className="meme-round">{label}</span>
        <Timer deadline={game.deadline} serverNow={serverNow} />
      </div>
      {game.phase === 'escrever' && <PlayerLine players={players} highlight={(id) => game.entries[id]?.done} />}
      {game.phase === 'adivinhar' && <PlayerLine players={players.filter((p) => p.id !== subjectOf(game))} highlight={(id) => game.votes[id] !== undefined} />}
      {game.phase === 'escrever' && <Writing {...props} />}
      {(game.phase === 'adivinhar' || game.phase === 'revelar') && <Guessing key={game.current} {...props} />}
      {game.phase === 'final' && <Final {...props} />}
      {amHost && game.phase !== 'final' && (
        <button className="link-btn" onClick={() => dispatch({ type: 'next' })}>
          {game.phase === 'revelar' ? 'Seguinte' : game.phase === 'escrever' ? 'Começar a adivinhar' : 'Revelar já'} →
        </button>
      )}
    </div>
  )
}

const HELP = (
  <>
    <p>Cada jogador escreve três frases sobre si: duas verdadeiras e uma mentira.</p>
    <p>Depois, à vez, todos tentam descobrir qual é a mentira de cada um. Acertar dá <strong>100 pontos</strong>; por cada pessoa que enganas ganhas <strong>50</strong>.</p>
  </>
)

export default function VerdadesGame() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const prepareStart = useMemo(() => async () => ({ settings }), [settings])
  const lobbyOptions = ({ amHost }) =>
    amHost ? (
      <div className="meme-settings">
        <SettingSelect label="Tempo para escrever" value={settings.writeSeconds} options={[60, 90, 120, 180]} format={(v) => `${v}s`} onChange={(v) => setSettings((s) => ({ ...s, writeSeconds: v }))} />
        <SettingSelect label="Tempo para adivinhar" value={settings.guessSeconds} options={[15, 20, 30, 45]} format={(v) => `${v}s`} onChange={(v) => setSettings((s) => ({ ...s, guessSeconds: v }))} />
      </div>
    ) : null
  return (
    <GameShell game="verdades" title="2 Verdades 1 Mentira" help={HELP} modes={[{ key: 'online', label: 'Multiplayer' }]}>
      {() => <OnlineGame game="verdades" logic={verdadesOnline} renderGame={(props) => <Board {...props} />} renderLobbyOptions={lobbyOptions} prepareStart={prepareStart} />}
    </GameShell>
  )
}
