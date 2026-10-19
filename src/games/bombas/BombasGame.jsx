import { useCallback, useEffect, useRef, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import { gameBreak } from '../../lib/ads.js'
import { recordResultOnce } from '../../lib/social.js'
import { W, H, COLORS, MAX, BOT_NAMES, idx, stepMs, startGame, nextRound, advance, applyInput, bombasOnline } from './bombasLogic.js'

const POWER_LABEL = { b: '+1 bomba', r: '+ alcance', s: '+ velocidade' }
const KEYS = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' }

// Teclado (setas/WASD + Espaço) e comando no ecrã. Guarda as teclas
// carregadas para que, ao largar uma, continue na direção da outra.
function useControls(onDir, onBomb, active) {
  const held = useRef([])
  const update = useCallback(() => onDir(held.current[held.current.length - 1] || null), [onDir])
  const press = useCallback((dir) => {
    held.current = [...held.current.filter((d) => d !== dir), dir]
    update()
  }, [update])
  const release = useCallback((dir) => {
    held.current = held.current.filter((d) => d !== dir)
    update()
  }, [update])

  useEffect(() => {
    if (!active) return undefined
    const down = (e) => {
      if (e.target.closest?.('input, textarea')) return
      const dir = KEYS[e.key]
      if (dir) {
        e.preventDefault()
        if (!e.repeat) press(dir)
      } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'x' || e.key === 'X') {
        e.preventDefault()
        if (!e.repeat) onBomb()
      }
    }
    const up = (e) => {
      const dir = KEYS[e.key]
      if (dir) release(dir)
    }
    const blur = () => {
      held.current = []
      update()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [active, press, release, onBomb, update])

  return { press, release }
}

function Pad({ press, release, onBomb }) {
  const btn = (dir, label) => (
    <button
      type="button"
      className={`bomb-pad__btn bomb-pad__btn--${dir}`}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        press(dir)
      }}
      onPointerUp={() => release(dir)}
      onPointerCancel={() => release(dir)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 6l7 10H5z" /></svg>
    </button>
  )
  return (
    <div className="bomb-pad" data-testid="bomb-pad">
      <div className="bomb-pad__dirs">
        {btn('u', 'Cima')}
        {btn('l', 'Esquerda')}
        {btn('r', 'Direita')}
        {btn('d', 'Baixo')}
      </div>
      <button
        type="button"
        className="bomb-pad__bomb"
        onPointerDown={(e) => {
          e.preventDefault()
          onBomb()
        }}
        aria-label="Pôr bomba"
      >
        💣
      </button>
    </div>
  )
}

function Arena({ game, meId, now }) {
  const cells = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = game.grid[idx(x, y)]
      const pw = game.powers[idx(x, y)]
      cells.push(
        <div key={`${x}-${y}`} className={`bomb-cell${c === '#' ? ' bomb-cell--wall' : c === '+' ? ' bomb-cell--crate' : (x + y) % 2 ? ' bomb-cell--b' : ''}`}>
          {pw && <span className={`bomb-power bomb-power--${pw}`} title={POWER_LABEL[pw]}>{pw === 'b' ? '💣' : pw === 'r' ? '🔥' : '👟'}</span>}
        </div>
      )
    }
  }
  const pos = (x, y) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` })
  return (
    <div className="bomb-arena" data-testid="bomb-arena" style={{ aspectRatio: `${W} / ${H}` }}>
      <div className="bomb-grid" style={{ gridTemplateColumns: `repeat(${W}, 1fr)` }}>{cells}</div>
      {game.flames.map((f) => (
        <span key={`f${f.x}-${f.y}`} className="bomb-flame" style={pos(f.x, f.y)} />
      ))}
      {game.bombs.map((b) => {
        const left = Math.max(0, b.at - now)
        return (
          <span key={`b${b.id}`} className={`bomb-bomb${left < 800 ? ' bomb-bomb--soon' : ''}`} style={pos(b.x, b.y)} data-testid="bomb">
            <i />
          </span>
        )
      })}
      {game.order.map((id) => {
        const p = game.players[id]
        return (
          <span
            key={id}
            className={`bomb-player${p.alive ? '' : ' bomb-player--dead'}${id === meId ? ' bomb-player--me' : ''}`}
            style={{ ...pos(p.x, p.y), '--pc': COLORS[p.color], transitionDuration: `${stepMs(p)}ms` }}
            data-testid={`bomber-${id === meId ? 'me' : id}`}
          >
            <i className="bomb-player__body" />
          </span>
        )
      })}
    </div>
  )
}

function Hud({ game, meId, people, now }) {
  const secs = Math.max(0, Math.ceil((game.endsAt - now) / 1000))
  return (
    <div className="bomb-hud">
      {game.order.map((id) => {
        const p = game.players[id]
        const who = people(id)
        return (
          <div key={id} className={`bomb-hud__p${p.alive ? '' : ' bomb-hud__p--out'}`} style={{ '--pc': COLORS[p.color] }}>
            <Avatar src={who?.avatar} seed={who?.seed || id} name={who?.name} size={26} />
            <span className="bomb-hud__name">{id === meId ? 'Tu' : who?.name || 'Jogador'}</span>
            <b>{game.score[id] || 0}</b>
          </div>
        )
      })}
      <span className={`bomb-hud__time${now >= game.suddenAt ? ' bomb-hud__time--sudden' : ''}`} data-testid="bomb-time">
        {now >= game.suddenAt && <small>Morte súbita </small>}
        {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
      </span>
    </div>
  )
}

function MyStats({ p }) {
  if (!p) return null
  return (
    <div className="bomb-stats" data-testid="bomb-stats">
      <span title="Bombas ao mesmo tempo">💣 {p.bombs}{p.bombs >= MAX.bombs ? ' máx.' : ''}</span>
      <span title="Alcance da explosão">🔥 {p.range}</span>
      <span title="Velocidade">👟 {p.speed + 1}</span>
    </div>
  )
}

function useNow(active) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return undefined
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [active])
  return now
}

function Board({ game, meId, people, onAction, now, children }) {
  const me = game.players[meId]
  const playing = !!me && !game.over
  const onDir = useCallback((dir) => onAction({ type: 'dir', dir }), [onAction])
  const onBomb = useCallback(() => onAction({ type: 'bomb' }), [onAction])
  const { press, release } = useControls(onDir, onBomb, playing && me.alive)
  const name = (id) => (id === meId ? 'Tu' : people(id)?.name || 'Jogador')

  return (
    <div className="bomb-game">
      <Hud game={game} meId={meId} people={people} now={now} />
      <div className="bomb-stage">
        <Arena game={game} meId={meId} now={now} />
        {game.over && (
          <div className="bomb-over" data-testid="bomb-over">
            <h3>
              {game.winner === 'draw'
                ? 'Empate!'
                : game.winner === meId
                  ? 'Ganhaste a ronda!'
                  : `${name(game.winner)} ganhou a ronda`}
            </h3>
            {children}
          </div>
        )}
      </div>
      {me && (
        <div className="bomb-foot">
          <MyStats p={me} />
          <p className="game-status">
            {!me.alive && !game.over ? (
              'Foste apanhado! Vê o resto da ronda.'
            ) : (
              <>
                <span className="bomb-hint--keys">Setas ou WASD para andar, Espaço para pôr bomba.</span>
                <span className="bomb-hint--touch">Usa o comando para andar e o 💣 para pôr bomba.</span>
              </>
            )}
          </p>
        </div>
      )}
      {playing && me.alive && <Pad press={press} release={release} onBomb={onBomb} />}
    </div>
  )
}

// ---------- Contra bots (tudo no browser) ----------
function VsBots() {
  const [bots, setBots] = useState(3)
  const [game, setGame] = useState(null)
  const gameRef = useRef(null)
  gameRef.current = game
  const now = useNow(!!game)

  useEffect(() => {
    if (!game || game.over) return undefined
    const t = setInterval(() => setGame((g) => (g && !g.over ? advance(g, Date.now()) : g)), 100)
    return () => clearInterval(t)
  }, [game?.round, game?.over]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (game?.over) recordResultOnce(`bombas-bot-${game.startedAt}`, 'bombas', game.winner === 'tu')
  }, [game?.over]) // eslint-disable-line react-hooks/exhaustive-deps

  const onAction = useCallback((action) => setGame((g) => (g ? applyInput(g, 'tu', action, Date.now()) : g)), [])
  const people = (id) => (id === 'tu' ? { name: 'Tu' } : { name: BOT_NAMES[Number(id.slice(3))], seed: id })

  if (!game) {
    return (
      <div className="game-panel">
        <p className="game-status">Contra quantos bots queres jogar?</p>
        <div className="bot-levels">
          {[1, 2, 3].map((n) => (
            <button key={n} className={`mode-btn${bots === n ? ' mode-btn--active' : ''}`} onClick={() => setBots(n)}>
              {n}
            </button>
          ))}
        </div>
        <button
          className="share-btn"
          data-testid="bomb-start"
          onClick={() => {
            const ids = ['tu', ...Array.from({ length: bots }, (_, i) => `bot${i}`)]
            setGame(startGame(ids, ids.slice(1)))
          }}
        >
          Começar
        </button>
      </div>
    )
  }

  return (
    <div className="game-panel game-panel--wide">
      <Board game={game} meId="tu" people={people} onAction={onAction} now={now}>
        <div className="game-actions">
          <button className="share-btn" data-testid="bomb-next" onClick={() => gameBreak('bombas', () => setGame((g) => nextRound(g)))}>
            Próxima ronda
          </button>
          <button className="mode-btn" onClick={() => setGame(null)}>Mudar nº de bots</button>
        </div>
      </Board>
    </div>
  )
}

// ---------- Online ----------
function OnlineBoard({ state, game, me, dispatch, serverNow }) {
  const people = (id) => state.players.find((p) => p.id === id) || (id.startsWith('bot') ? { name: BOT_NAMES[Number(id.slice(3))], seed: id } : null)
  const seated = !!game.players[me.id]
  const tick = useNow(true)
  const now = tick + (serverNow() - Date.now())
  useEffect(() => {
    if (game.over && seated) recordResultOnce(`bombas-${state.code}-${game.startedAt}`, 'bombas', game.winner === me.id)
  }, [game.over, game.startedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="game-panel game-panel--wide">
      <Board game={game} meId={me.id} people={people} onAction={dispatch} now={now}>
        {seated && (
          <div className="game-actions">
            <button className="share-btn" data-testid="bomb-next" onClick={() => dispatch({ type: 'rematch' })}>Próxima ronda</button>
          </div>
        )}
      </Board>
    </div>
  )
}

// Nº de bots escolhido no lobby (lido ao carregar em "Começar jogo").
const lobbyChoice = { bots: 0 }

function LobbyBots({ state, amHost }) {
  const [bots, setBots] = useState(0)
  const max = Math.max(0, 4 - state.players.length)
  useEffect(() => {
    if (bots > max) setBots(max)
  }, [bots, max])
  lobbyChoice.bots = Math.min(bots, max)
  if (!amHost) return null
  return (
    <div className="bomb-lobby-bots">
      <p className="modal-note">Adicionar bots (a sala fica com até 4):</p>
      <div className="bot-levels">
        {Array.from({ length: max + 1 }, (_, n) => (
          <button key={n} type="button" className={`mode-btn${Math.min(bots, max) === n ? ' mode-btn--active' : ''}`} onClick={() => setBots(n)} data-testid={`lobby-bots-${n}`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

const HELP = (
  <>
    <p>Anda pela arena com as <strong>setas</strong> (ou WASD) e põe bombas com <strong>Espaço</strong>. No telemóvel usa os botões no ecrã.</p>
    <p>As bombas explodem passado pouco tempo, em cruz. A explosão parte as caixas de madeira e elimina quem apanhar, incluindo tu!</p>
    <p>Dentro de algumas caixas há prémios: 💣 mais uma bomba de cada vez, 🔥 explosões mais compridas e 👟 mais velocidade.</p>
    <p>Ganha a ronda quem ficar sozinho na arena. Aos 2 minutos começa a <strong>morte súbita</strong>: caem blocos de pedra em espiral e a arena vai fechando.</p>
  </>
)

export default function BombasGame() {
  return (
    <GameShell
      game="bombas"
      title="Bombas & Companhia"
      help={HELP}
      modes={[
        { key: 'bot', label: 'vs Bots' },
        { key: 'online', label: 'Multiplayer' },
      ]}
    >
      {(mode) =>
        mode === 'bot' ? (
          <VsBots />
        ) : (
          <OnlineGame
            game="bombas"
            logic={bombasOnline}
            renderLobbyOptions={(props) => <LobbyBots {...props} />}
            prepareStart={() => ({ bots: lobbyChoice.bots })}
            renderGame={(props) => <OnlineBoard {...props} />}
          />
        )
      }
    </GameShell>
  )
}
