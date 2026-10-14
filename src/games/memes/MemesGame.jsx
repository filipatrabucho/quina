import { useEffect, useMemo, useRef, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import MemeCanvas from './MemeCanvas.jsx'
import { loadTemplates } from './templates.js'
import { ClockIcon } from '../../components/Icons.jsx'
import { memesOnline, defaultCaptions, MAX_CAPTION, DEFAULT_SETTINGS } from './memesLogic.js'

function useCountdown(deadline, serverNow) {
  const [left, setLeft] = useState(() => (deadline ? Math.max(0, deadline - serverNow()) : 0))
  useEffect(() => {
    if (!deadline) return undefined
    const update = () => setLeft(Math.max(0, deadline - serverNow()))
    update()
    const t = setInterval(update, 250)
    return () => clearInterval(t)
  }, [deadline]) // eslint-disable-line react-hooks/exhaustive-deps
  return Math.ceil(left / 1000)
}

function Timer({ deadline, serverNow }) {
  const s = useCountdown(deadline, serverNow)
  if (!deadline) return null
  return (
    <span className={`meme-timer${s <= 10 ? ' meme-timer--hurry' : ''}`} data-testid="meme-timer">
      <ClockIcon /> {s}s
    </span>
  )
}

function PlayerLine({ players, highlight }) {
  return (
    <div className="meme-players">
      {players.map((p) => (
        <span key={p.id} className={`meme-player${highlight(p.id) ? ' meme-player--done' : ''}`} title={p.name}>
          <Avatar src={p.avatar} seed={p.seed} name={p.name} size={26} />
          {highlight(p.id) && <span className="meme-player__check">✓</span>}
        </span>
      ))}
    </div>
  )
}

function Writing({ state, game, me, dispatch, serverNow }) {
  const template = game.templates[me.id]
  const saved = game.memes[me.id]
  const [captions, setCaptions] = useState(() => saved?.captions || defaultCaptions(template?.boxes ?? 2))
  const [done, setDone] = useState(!!saved?.done)
  const templateId = template?.id
  const shownTemplate = useRef(templateId)

  // Imagem nova (troca de imagem) → caixas novas.
  useEffect(() => {
    if (shownTemplate.current === templateId) return
    shownTemplate.current = templateId
    setCaptions(defaultCaptions(template?.boxes ?? 2))
    setDone(false)
  }, [templateId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Vai guardando no anfitrião (se o tempo acabar, o que escreveste conta).
  useEffect(() => {
    if (done || !template) return undefined
    const t = setTimeout(() => dispatch({ type: 'submit', captions, done: false }), 500)
    return () => clearTimeout(t)
  }, [captions]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!template) return <p className="game-status">Estás a ver como espectador.</p>

  const update = (i, patch) => setCaptions((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const hasText = captions.some((c) => c.text.trim())

  return (
    <div className="meme-writing">
      <MemeCanvas
        template={template}
        captions={captions}
        editable={!done}
        onMoveCaption={(i, x, y) => update(i, { x, y })}
      />
      <p className="modal-note">Arrasta os textos na imagem para os posicionar.</p>
      <div className="meme-inputs">
        {captions.map((c, i) => (
          <div key={i} className="meme-input-row">
            <input
              value={c.text}
              onChange={(e) => update(i, { text: e.target.value.slice(0, MAX_CAPTION) })}
              placeholder={`Texto ${i + 1}`}
              disabled={done}
              aria-label={`Texto ${i + 1}`}
              data-testid={`meme-input-${i}`}
            />
            {captions.length > 1 && !done && (
              <button className="icon-btn icon-btn--small" onClick={() => setCaptions((cs) => cs.filter((_, j) => j !== i))} aria-label="Remover texto">
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {!done && (
        <div className="game-actions">
          {captions.length < 5 && (
            <button className="mode-btn" onClick={() => setCaptions((cs) => [...cs, { text: '', x: 50, y: 50 }])}>
              + Texto
            </button>
          )}
          <button className="mode-btn" onClick={() => dispatch({ type: 'reroll' })} disabled={!!game.rerolled[me.id]}>
            Trocar imagem{game.rerolled[me.id] ? ' (usado)' : ''}
          </button>
        </div>
      )}
      {done ? (
        <>
          <p className="game-status">Pronto! À espera dos outros…</p>
          <button className="link-btn" onClick={() => { setDone(false); dispatch({ type: 'submit', captions, done: false }) }}>
            Editar
          </button>
        </>
      ) : (
        <button
          className="share-btn"
          disabled={!hasText}
          onClick={() => {
            setDone(true)
            dispatch({ type: 'submit', captions, done: true })
          }}
        >
          Pronto!
        </button>
      )}
    </div>
  )
}

function Voting({ state, game, me, dispatch }) {
  const myVote = game.votes[me.id]
  const playing = game.playerIds.includes(me.id)
  return (
    <div className="meme-voting">
      <p className="game-status">{playing ? 'Vota no meme mais engraçado!' : 'A votação está a decorrer.'}</p>
      <div className="meme-grid">
        {game.order.map((id) => {
          const mine = id === me.id
          return (
            <button
              key={id}
              className={`meme-card${myVote === id ? ' meme-card--voted' : ''}${mine ? ' meme-card--mine' : ''}`}
              onClick={() => !mine && playing && dispatch({ type: 'vote', target: id })}
              disabled={mine || !playing}
              data-testid="meme-vote"
            >
              <MemeCanvas template={game.templates[id]} captions={game.memes[id].captions} small />
              <span className="meme-card__label">{mine ? 'O teu meme' : myVote === id ? '✓ O teu voto' : 'Votar'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Results({ state, game, me, amHost, dispatch }) {
  const name = (id) => state.players.find((p) => p.id === id)
  const ranked = [...game.order].sort((a, b) => (game.tally?.[b] || 0) - (game.tally?.[a] || 0))
  return (
    <div className="meme-results">
      <h3>Resultados da ronda {game.round}</h3>
      {ranked.length === 0 && <p className="modal-note">Ninguém fez meme nesta ronda.</p>}
      <div className="meme-grid">
        {ranked.map((id, i) => (
          <div key={id} className={`meme-card meme-card--result${i === 0 && game.tally?.[id] ? ' meme-card--winner' : ''}`}>
            <MemeCanvas template={game.templates[id]} captions={game.memes[id].captions} small />
            <span className="meme-card__label">
              {name(id)?.name}{id === me.id ? ' (tu)' : ''} · {game.tally?.[id] || 0} voto(s) · +{game.roundPoints[id] || 0}
            </span>
          </div>
        ))}
      </div>
      <Standings state={state} game={game} me={me} />
      {amHost && (
        <button className="share-btn" onClick={() => dispatch({ type: 'next' })}>
          {game.round >= game.settings.rounds ? 'Ver resultado final' : 'Próxima ronda'}
        </button>
      )}
    </div>
  )
}

function Standings({ state, game, me }) {
  const rows = [...state.players]
    .filter((p) => game.playerIds.includes(p.id))
    .sort((a, b) => (game.scores[b.id] || 0) - (game.scores[a.id] || 0))
  return (
    <ol className="meme-standings" data-testid="meme-standings">
      {rows.map((p, i) => (
        <li key={p.id} className={p.id === me.id ? 'meme-standings__me' : ''}>
          <span className="meme-standings__pos">{i + 1}.</span>
          <Avatar src={p.avatar} seed={p.seed} name={p.name} size={24} />
          <span className="meme-standings__name">{p.name}</span>
          <span className="meme-standings__pts">{game.scores[p.id] || 0}</span>
        </li>
      ))}
    </ol>
  )
}

function Final({ state, game, me, amHost, dispatch }) {
  const top = Math.max(...game.playerIds.map((id) => game.scores[id] || 0))
  const winners = state.players.filter((p) => game.playerIds.includes(p.id) && (game.scores[p.id] || 0) === top)
  return (
    <div className="meme-results">
      <h3>{winners.map((w) => w.name).join(' e ')} {winners.length > 1 ? 'ganharam' : 'ganhou'}!</h3>
      <Standings state={state} game={game} me={me} />
      {game.hall.length > 0 && (
        <>
          <h4>Os melhores memes</h4>
          <div className="meme-grid">
            {game.hall.map((m, i) => (
              <div key={i} className="meme-card meme-card--result">
                <MemeCanvas template={m.template} captions={m.captions} small />
                <span className="meme-card__label">
                  Ronda {m.round} · {state.players.find((p) => p.id === m.playerId)?.name}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {amHost && (
        <button className="share-btn" onClick={() => dispatch({ type: 'restart' })}>Jogar outra vez</button>
      )}
    </div>
  )
}

function MemesBoard(props) {
  const { state, game, serverNow, amHost, dispatch } = props
  const players = state.players.filter((p) => game.playerIds.includes(p.id))
  const phaseLabel = { writing: 'Escreve o teu meme', voting: 'Votação', results: 'Resultados', final: 'Fim do jogo' }[game.phase]
  return (
    <div className="game-panel game-panel--wide memes">
      <div className="meme-topbar">
        <span className="meme-round">
          {game.phase === 'final' ? phaseLabel : `Ronda ${game.round}/${game.settings.rounds} · ${phaseLabel}`}
        </span>
        <Timer deadline={game.deadline} serverNow={serverNow} />
      </div>
      {game.phase === 'writing' && (
        <PlayerLine players={players} highlight={(id) => game.memes[id]?.done} />
      )}
      {game.phase === 'voting' && <PlayerLine players={players} highlight={(id) => !!game.votes[id]} />}
      {game.phase === 'writing' && <Writing key={`${game.round}`} {...props} />}
      {game.phase === 'voting' && <Voting {...props} />}
      {game.phase === 'results' && <Results {...props} />}
      {game.phase === 'final' && <Final {...props} />}
      {amHost && (game.phase === 'writing' || game.phase === 'voting') && (
        <button className="link-btn" onClick={() => dispatch({ type: 'next' })}>
          Saltar para a {game.phase === 'writing' ? 'votação' : 'contagem'} →
        </button>
      )}
    </div>
  )
}

const HELP = (
  <>
    <p>Em cada ronda, cada jogador recebe uma imagem de meme e tem de escrever as legendas mais engraçadas que conseguir.</p>
    <p>Depois, toda a gente vota no melhor meme (não podes votar no teu). Cada voto vale <strong>100 pontos</strong> e o meme mais votado da ronda ganha <strong>+50</strong>.</p>
    <p>Podes trocar de imagem uma vez por ronda. Ganha quem tiver mais pontos no fim!</p>
    <p className="modal-note">Inspirado no Make It Meme. Imagens do imgflip.</p>
  </>
)

export default function MemesGame() {
  const [settings, setSettings] = useState({ rounds: DEFAULT_SETTINGS.rounds, writeSeconds: DEFAULT_SETTINGS.writeSeconds })

  useEffect(() => {
    loadTemplates() // pré-carrega
  }, [])

  const prepareStart = useMemo(
    () => async () => {
      const all = await loadTemplates()
      const pool = [...all].sort(() => Math.random() - 0.5).slice(0, 40)
      return { templates: pool, settings }
    },
    [settings]
  )

  const lobbyOptions = ({ amHost }) =>
    amHost ? (
      <div className="meme-settings">
        <label>
          Rondas
          <select value={settings.rounds} onChange={(e) => setSettings((s) => ({ ...s, rounds: Number(e.target.value) }))}>
            {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>
          Tempo para escrever
          <select value={settings.writeSeconds} onChange={(e) => setSettings((s) => ({ ...s, writeSeconds: Number(e.target.value) }))}>
            {[45, 60, 90, 120].map((n) => <option key={n} value={n}>{n}s</option>)}
          </select>
        </label>
      </div>
    ) : null

  return (
    <GameShell game="memes" title="Jogo dos Memes" help={HELP} modes={[{ key: 'online', label: 'Multiplayer' }]}>
      {() => (
        <OnlineGame
          game="memes"
          logic={memesOnline}
          renderGame={(props) => <MemesBoard {...props} />}
          renderLobbyOptions={lobbyOptions}
          prepareStart={prepareStart}
        />
      )}
    </GameShell>
  )
}
