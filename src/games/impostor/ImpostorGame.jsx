import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import { gameBreak } from '../../lib/ads.js'
import Astro from './Astro.jsx'
import { recordResultOnce } from '../../lib/social.js'
import {
  W, H, ROOMS, CORRIDORS, STATIONS, BUTTON, COLORS, BOT_NAMES, VISION,
  dist, roomAt, visionOf, taskProgress, actionsFor, startGame, applyAction, tick, impostorOnline,
} from './impostorLogic.js'

const KEYS = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' }
const STATION = Object.fromEntries(STATIONS.map((s) => [s.id, s]))
const secs = (ms) => Math.max(0, Math.ceil(ms / 1000))

function useNow(active, every = 200) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return undefined
    const t = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(t)
  }, [active, every])
  return now
}

function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(360)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const measure = () => setW(el.clientWidth || 360)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// ---------- Controlos ----------
function useControls(onDir, active) {
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
    if (active) return undefined
    if (held.current.length) {
      held.current = []
      onDir(null)
    }
    return undefined
  }, [active, onDir])
  useEffect(() => {
    if (!active) return undefined
    const down = (e) => {
      if (e.target.closest?.('input, textarea')) return
      const dir = KEYS[e.key]
      if (dir) {
        e.preventDefault()
        if (!e.repeat) press(dir)
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
  }, [active, press, release, update])
  return { press, release }
}

function Pad({ press, release }) {
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
      data-testid={`imp-pad-${dir}`}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 6l7 10H5z" /></svg>
    </button>
  )
  return (
    <div className="bomb-pad__dirs imp-pad">
      {btn('u', 'Cima')}
      {btn('l', 'Esquerda')}
      {btn('r', 'Direita')}
      {btn('d', 'Baixo')}
    </div>
  )
}

// Botões do que dá para fazer aqui (com atalhos de teclado).
function Actions({ can, me, onUse, onKill, onReport, onEmergency }) {
  const list = []
  if (can.report) list.push({ key: 'report', label: 'Reportar', icon: '📢', run: onReport, kb: 'R', cls: 'imp-act--report' })
  if (me.role === 'impostor' && me.alive) {
    list.push({ key: 'kill', label: can.killIn ? `Matar (${secs(can.killIn)})` : 'Matar', icon: '🔪', run: onKill, kb: 'Q', cls: 'imp-act--kill', off: !can.kill })
  }
  if (can.task) list.push({ key: 'task', label: 'Usar', icon: '🔧', run: onUse, kb: 'E', cls: 'imp-act--use' })
  if (can.emergency) list.push({ key: 'emergency', label: 'Reunião', icon: '🚨', run: onEmergency, kb: 'E', cls: 'imp-act--report' })

  useEffect(() => {
    const down = (e) => {
      if (e.repeat || e.target.closest?.('input, textarea')) return
      const k = e.key.toUpperCase()
      const a = list.find((x) => !x.off && (x.kb === k || (k === ' ' && x.key !== 'kill')))
      if (a) {
        e.preventDefault()
        a.run()
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  })

  return (
    <div className="imp-acts">
      {list.map((a) => (
        <button key={a.key} type="button" className={`imp-act ${a.cls}`} disabled={a.off} onClick={a.run} data-testid={`imp-${a.key}`}>
          <span aria-hidden="true">{a.icon}</span>
          {a.label}
          <kbd>{a.kb}</kbd>
        </button>
      ))}
      {!list.length && <span className="imp-acts__none">Anda até uma tarefa (ícone amarelo) para a fazer.</span>}
    </div>
  )
}

// ---------- Mini-tarefas ----------
const shuffled = (n) => {
  const a = Array.from({ length: n }, (_, i) => i + 1)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function OrderTask({ onDone }) {
  const [nums] = useState(() => shuffled(6))
  const [next, setNext] = useState(1)
  const [bad, setBad] = useState(0)
  useEffect(() => {
    if (next > 6) onDone()
  }, [next, onDone])
  return (
    <>
      <p className="modal-note">Carrega nos números por ordem, do 1 ao 6.</p>
      <div className={`imp-task-grid${bad ? ' sol-cols--shake' : ''}`} key={bad}>
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            className={`imp-task-num${n < next ? ' imp-task-num--on' : ''}`}
            onClick={() => (n === next ? setNext(n + 1) : n >= next && (setNext(1), setBad((b) => b + 1)))}
            data-testid={`imp-num-${n}`}
          >
            {n}
          </button>
        ))}
      </div>
    </>
  )
}

function SwitchTask({ onDone }) {
  const [on, setOn] = useState(() => {
    const a = Array.from({ length: 5 }, () => Math.random() < 0.4)
    if (a.every(Boolean)) a[0] = false
    return a
  })
  useEffect(() => {
    if (on.every(Boolean)) onDone()
  }, [on, onDone])
  return (
    <>
      <p className="modal-note">Liga todos os interruptores.</p>
      <div className="imp-switches">
        {on.map((v, i) => (
          <button key={i} type="button" className={`imp-switch${v ? ' imp-switch--on' : ''}`} onClick={() => setOn((a) => a.map((x, k) => (k === i ? !x : x)))} data-testid={`imp-switch-${i}`}>
            <i />
          </button>
        ))}
      </div>
    </>
  )
}

function HoldTask({ onDone }) {
  const [p, setP] = useState(0)
  const timer = useRef(null)
  const stop = () => clearInterval(timer.current)
  const start = () => {
    stop()
    timer.current = setInterval(() => setP((x) => Math.min(100, x + 4)), 80)
  }
  useEffect(() => stop, [])
  useEffect(() => {
    if (p >= 100) {
      stop()
      onDone()
    }
  }, [p, onDone])
  return (
    <>
      <p className="modal-note">Mantém o botão carregado até a barra encher.</p>
      <div className="imp-hold-bar"><i style={{ width: `${p}%` }} /></div>
      <button
        type="button"
        className="share-btn imp-hold-btn"
        onPointerDown={(e) => {
          e.preventDefault()
          start()
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
        data-testid="imp-hold"
      >
        Segurar
      </button>
    </>
  )
}

const TASK_KIND = { lixo: HoldTask, fogao: SwitchTask, filtro: HoldTask, fios: OrderTask, antena: SwitchTask, exame: HoldTask, papeis: OrderTask, caixas: OrderTask, motor: SwitchTask, energia: SwitchTask, rota: OrderTask, amostra: HoldTask }

function TaskModal({ id, onDone, onClose }) {
  const Kind = TASK_KIND[id] || OrderTask
  return (
    <div className="imp-task" data-testid="imp-taskbox">
      <div className="imp-task__box">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        <h3>{STATION[id]?.name}</h3>
        <Kind onDone={onDone} />
      </div>
    </div>
  )
}

// ---------- Mapa ----------
function MapSvg({ c, me }) {
  const mine = me && me.role === 'crew' ? new Set(me.tasks.filter((t) => !me.done.includes(t))) : new Set()
  const fake = me && me.role === 'impostor' ? new Set(me.tasks) : new Set()
  return (
    <svg width={W * c} height={H * c} className="imp-map" aria-hidden="true">
      <rect width={W * c} height={H * c} fill="#0B0E1C" />
      {CORRIDORS.map(([x, y, w, h], i) => (
        <rect key={`c${i}`} x={x * c} y={y * c} width={w * c} height={h * c} fill="#3A4160" />
      ))}
      {ROOMS.map((r) => (
        <g key={r.name}>
          <rect x={r.x * c} y={r.y * c} width={r.w * c} height={r.h * c} rx={c * 0.3} fill="#4C5578" stroke="#252B45" strokeWidth={c * 0.18} />
          <text x={(r.x + r.w / 2) * c} y={(r.y + 0.75) * c} fontSize={c * 0.42} textAnchor="middle" fill="#C9D1F0" fillOpacity="0.75" fontWeight="700">{r.name}</text>
        </g>
      ))}
      {STATIONS.map((s) => (
        <g key={s.id} transform={`translate(${s.x * c} ${s.y * c})`}>
          <rect x={c * 0.12} y={c * 0.12} width={c * 0.76} height={c * 0.76} rx={c * 0.15} fill={mine.has(s.id) ? '#FFC93C' : fake.has(s.id) ? '#B88A2A' : '#2A3050'} stroke="#14141C" strokeWidth="1.5" />
          <text x={c / 2} y={c * 0.66} fontSize={c * 0.42} textAnchor="middle">🔧</text>
        </g>
      ))}
      <g transform={`translate(${BUTTON.x * c} ${BUTTON.y * c})`}>
        <circle cx={c / 2} cy={c / 2} r={c * 0.42} fill="#7A1F2B" />
        <circle cx={c / 2} cy={c / 2} r={c * 0.3} fill="#E5243B" stroke="#14141C" strokeWidth="1.5" />
      </g>
    </svg>
  )
}

function World({ game, meId, people, full }) {
  const [ref, vw] = useWidth()
  const me = game.players[meId]
  const ghostView = full || !me || !me.alive
  const c = full ? vw / W : Math.max(24, Math.min(44, Math.floor(vw / 13)))
  const vh = full ? H * c : Math.round(Math.min(c * 10, typeof window !== 'undefined' ? window.innerHeight * 0.55 : 400))
  const tx = full ? 0 : vw / 2 - (me.x + 0.5) * c
  const ty = full ? 0 : vh / 2 - (me.y + 0.5) * c
  const vision = me ? visionOf(game, meId) : VISION.crew
  const sees = (o) => ghostView || dist(me, o) <= vision + 0.5
  const pos = (x, y) => ({ left: x * c, top: y * c, width: c, height: c })

  return (
    <div className="imp-view" ref={ref} style={{ height: vh }} data-testid="imp-view">
      <div className="imp-world" style={{ width: W * c, height: H * c, transform: `translate(${tx}px, ${ty}px)` }}>
        <MapSvg c={c} me={me} />
        {game.bodies.filter(sees).map((b) => (
          <span key={`b${b.id}`} className="imp-ent imp-ent--body" style={pos(b.x, b.y)} data-testid="imp-body">
            <Astro color={COLORS[game.players[b.id].color]} dead size={c} />
          </span>
        ))}
        {game.order.map((id) => {
          const p = game.players[id]
          const isMe = id === meId
          if (!isMe && (!sees(p) || (!p.alive && !ghostView))) return null
          const imp = me?.role === 'impostor' && p.role === 'impostor'
          return (
            <span key={id} className={`imp-ent${isMe ? ' imp-ent--me' : ''}`} style={pos(p.x, p.y)} data-testid={isMe ? 'imp-me' : undefined}>
              <span className={`imp-ent__name${imp ? ' imp-ent__name--imp' : ''}`}>{isMe ? 'Tu' : people(id)?.name}</span>
              <Astro color={COLORS[p.color]} ghost={!p.alive} size={c} />
            </span>
          )
        })}
      </div>
      {!ghostView && (
        <div
          className="imp-fog"
          style={{ background: `radial-gradient(circle at ${(me.x + 0.5) * c + tx}px ${(me.y + 0.5) * c + ty}px, transparent ${vision * c * 0.85}px, rgba(5, 7, 16, 0.94) ${vision * c + c}px)` }}
        />
      )}
      <span className="imp-room" data-testid="imp-room">{me ? roomAt(me.x, me.y) : 'Nave'}</span>
    </div>
  )
}

// ---------- Ecrãs por cima ----------
function nameWith(people, meId) {
  return (id) => (id === meId ? 'Tu' : people(id)?.name || 'Jogador')
}
const fmtLog = (msg, name) => msg.replace(/@(\w[\w-]*)/g, (_, id) => name(id))

function RoleScreen({ game, meId, people }) {
  const me = game.players[meId]
  const name = nameWith(people, meId)
  if (!me) return <div className="imp-over"><h3>A partida vai começar…</h3></div>
  const partners = game.order.filter((id) => id !== meId && game.players[id].role === 'impostor')
  return (
    <div className={`imp-over imp-over--${me.role}`} data-testid="imp-role">
      <Astro color={COLORS[me.color]} size={80} />
      <p className="imp-over__kicker">Tu és</p>
      <h3>{me.role === 'impostor' ? 'IMPOSTOR' : 'TRIPULANTE'}</h3>
      <p>
        {me.role === 'impostor'
          ? partners.length ? `O outro impostor é ${partners.map(name).join(', ')}.` : 'Elimina a tripulação sem seres apanhado.'
          : `Faz as tuas tarefas e descobre ${game.order.filter((id) => game.players[id].role === 'impostor').length > 1 ? 'os 2 impostores' : 'o impostor'}.`}
      </p>
    </div>
  )
}

function Meeting({ game, meId, people, now, onVote }) {
  const name = nameWith(people, meId)
  const m = game.meeting
  const me = game.players[meId]
  const myVote = m.votes[meId]
  const body = m.body && game.bodies.find((b) => b.id === m.body)
  // O que os bots dizem: quem reportou e quem viu alguém a matar.
  const claims = []
  if (game.players[m.by]?.bot) claims.push([m.by, body ? `Encontrei o corpo de ${name(m.body)} em ${roomAt(body.x, body.y)}.` : 'Chamei a reunião, alguém anda estranho.'])
  for (const id of game.order) {
    const p = game.players[id]
    if (p.bot && p.alive && p.bot.suspect && game.players[p.bot.suspect]?.alive) claims.push([id, p.bot.suspect === meId ? 'Eu vi-te a matar! Foste tu!' : `Eu vi ${name(p.bot.suspect)} a matar! Votem já!`])
  }
  return (
    <div className="imp-over imp-over--flow imp-meeting" data-testid="imp-meeting">
      <p className="imp-over__kicker">{body ? '📢 Corpo encontrado' : '🚨 Reunião de emergência'}</p>
      <h3>Quem é o impostor?</h3>
      <p className="imp-meeting__time">Faltam <b data-testid="imp-meet-time">{secs(game.phaseEnds - now)}</b> s · falem na chamada e votem</p>
      {claims.length > 0 && (
        <ul className="imp-claims">
          {claims.map(([id, text]) => (
            <li key={id}><b style={{ color: COLORS[game.players[id].color] }}>{name(id)}:</b> {text}</li>
          ))}
        </ul>
      )}
      <div className="imp-votes">
        {game.order.map((id) => {
          const p = game.players[id]
          const voted = !!m.votes[id]
          return (
            <button
              key={id}
              type="button"
              className={`imp-vote${!p.alive ? ' imp-vote--dead' : ''}${myVote === id ? ' imp-vote--mine' : ''}`}
              disabled={!p.alive || !me?.alive || !!myVote}
              onClick={() => onVote(id)}
              data-testid={`imp-vote-${id === meId ? 'me' : id}`}
            >
              <Astro color={COLORS[p.color]} dead={!p.alive} size={30} />
              <span>{name(id)}</span>
              {voted && p.alive && <small className="imp-vote__done">votou</small>}
            </button>
          )
        })}
      </div>
      {me?.alive ? (
        myVote ? <p className="modal-note">Já votaste. À espera dos outros…</p> : (
          <button type="button" className="mode-btn" onClick={() => onVote('skip')} data-testid="imp-skip">Saltar voto</button>
        )
      ) : <p className="modal-note">Estás morto: vês a votação mas não votas.</p>}
    </div>
  )
}

function Eject({ game, meId, people }) {
  const name = nameWith(people, meId)
  const e = game.eject
  const p = e.id && game.players[e.id]
  return (
    <div className="imp-over imp-eject" data-testid="imp-eject">
      {p ? (
        <>
          <span className="imp-eject__astro"><Astro color={COLORS[p.color]} size={70} /></span>
          <h3>{name(e.id)} {e.id === meId ? 'foste expulso' : 'foi expulso'}.</h3>
          <p>{e.wasImpostor ? `${e.id === meId ? 'Eras' : 'Era'} impostor.` : `${e.id === meId ? 'Não eras' : 'Não era'} impostor.`}</p>
        </>
      ) : (
        <h3>Ninguém foi expulso.</h3>
      )}
      <p className="modal-note">{e.left === 1 ? 'Resta 1 impostor.' : `Restam ${e.left} impostores.`}</p>
    </div>
  )
}

function Over({ game, meId, people, children }) {
  const name = nameWith(people, meId)
  const me = game.players[meId]
  const won = me && me.role === game.winner
  const imps = game.order.filter((id) => game.players[id].role === 'impostor')
  return (
    <div className={`imp-over imp-over--flow imp-over--${game.winner}`} data-testid="imp-over">
      <p className="imp-over__kicker">{game.winner === 'crew' ? 'Vitória da tripulação' : 'Vitória dos impostores'}</p>
      <h3>{me ? (won ? 'Ganhaste! 🎉' : 'Perdeste') : game.winner === 'crew' ? 'A tripulação ganhou' : 'Os impostores ganharam'}</h3>
      <p>{game.reason}</p>
      <div className="imp-reveal">
        {imps.map((id) => (
          <span key={id}><Astro color={COLORS[game.players[id].color]} size={34} /> {name(id)} {imps.length > 1 ? 'eram' : 'era'} impostor</span>
        ))}
      </div>
      <p className="modal-note">Placar: tripulação {game.wins.crew || 0} · impostores {game.wins.impostor || 0}</p>
      {children}
    </div>
  )
}

// ---------- O jogo ----------
function Board({ game, meId, people, onAction, now, children }) {
  const me = game.players[meId]
  const [task, setTask] = useState(null)
  const playing = !!me && game.phase === 'play'
  const onDir = useCallback((dir) => onAction({ type: 'dir', dir }), [onAction])
  const { press, release } = useControls(onDir, playing && !task)
  const can = me ? actionsFor(game, meId, now) : {}
  const name = nameWith(people, meId)

  // Fecha a tarefa se deixar de dar (reunião, afastou-se, já feita).
  useEffect(() => {
    if (task && (!playing || can.task !== task)) setTask(null)
  }, [task, playing, can.task])

  const progress = taskProgress(game)
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const myTodo = me ? me.tasks.filter((t) => !me.done.includes(t)) : []
  const lastLog = game.log[0]

  return (
    <div className="imp-game">
      <div className="imp-hud">
        <div className="imp-bar" title="Tarefas da tripulação" data-testid="imp-progress">
          <i style={{ width: `${pct}%` }} />
          <span>Tarefas da tripulação: {pct}%</span>
        </div>
        {me && (
          <span className={`imp-role-tag imp-role-tag--${me.role}`}>
            {me.alive ? '' : '👻 '}{me.role === 'impostor' ? 'Impostor' : 'Tripulante'}
          </span>
        )}
      </div>
      <div className="imp-stage">
        {game.phase !== 'meeting' && game.phase !== 'over' && <World game={game} meId={meId} people={people} full={!me} />}
        {game.phase === 'roles' && <RoleScreen game={game} meId={meId} people={people} />}
        {game.phase === 'meeting' && <Meeting game={game} meId={meId} people={people} now={now} onVote={(target) => onAction({ type: 'vote', target })} />}
        {game.phase === 'eject' && <Eject game={game} meId={meId} people={people} />}
        {game.phase === 'over' && <Over game={game} meId={meId} people={people}>{children}</Over>}
        {task && <TaskModal id={task} onClose={() => setTask(null)} onDone={() => { onAction({ type: 'task', id: task }); setTask(null) }} />}
      </div>
      {me && playing && (
        <div className="imp-foot">
          <div className="imp-controls">
            <Pad press={press} release={release} />
            <Actions
              can={can}
              me={me}
              onUse={() => {
                onDir(null)
                setTask(can.task)
              }}
              onKill={() => onAction({ type: 'kill' })}
              onReport={() => onAction({ type: 'report' })}
              onEmergency={() => onAction({ type: 'emergency' })}
            />
          </div>
          <div className="imp-info">
            {me.role === 'crew' ? (
              <p className="imp-tasks" data-testid="imp-tasks">
                <b>As tuas tarefas{me.alive ? '' : ' (como fantasma)'}:</b>{' '}
                {myTodo.length ? myTodo.map((t) => `${STATION[t].name} (${roomAt(STATION[t].x, STATION[t].y)})`).join(' · ') : 'todas feitas ✓'}
              </p>
            ) : (
              <p className="imp-tasks">
                <b>{me.alive ? 'Finge que fazes:' : 'Foste apanhado. Vê como acaba.'}</b>{' '}
                {me.alive && me.tasks.map((t) => STATION[t].name).join(' · ')}
              </p>
            )}
            {lastLog && <p className="imp-log">{fmtLog(lastLog, name)}</p>}
            <p className="modal-note imp-hint--keys">Setas ou WASD para andar · E para usar · R para reportar{me.role === 'impostor' ? ' · Q para matar' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function useResult(game, meId, key) {
  useEffect(() => {
    const me = game?.players[meId]
    if (game?.phase === 'over' && me) recordResultOnce(key, 'impostor', me.role === game.winner, me.role)
  }, [game?.phase]) // eslint-disable-line react-hooks/exhaustive-deps
}

// ---------- Contra bots (tudo no browser) ----------
const botPeople = (id) => (id === 'tu' ? { name: 'Tu' } : { name: BOT_NAMES[Number(id.slice(3))] })

function VsBots() {
  const [bots, setBots] = useState(6)
  const [game, setGame] = useState(null)
  const now = useNow(!!game, 100)

  useEffect(() => {
    if (!game || game.phase === 'over') return undefined
    const t = setInterval(() => setGame((g) => (g && g.phase !== 'over' ? tick(g, Date.now()) : g)), 50)
    return () => clearInterval(t)
  }, [game?.startedAt, game?.phase === 'over']) // eslint-disable-line react-hooks/exhaustive-deps

  useResult(game, 'tu', `impostor-bot-${game?.startedAt}`)

  const onAction = useCallback((action) => setGame((g) => {
    if (!g) return g
    try {
      return applyAction(g, 'tu', action, Date.now())
    } catch {
      return g
    }
  }), [])

  if (!game) {
    return (
      <div className="game-panel">
        <p className="game-status">Quantos bots na nave?</p>
        <div className="bot-levels">
          {[3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} type="button" className={`mode-btn${bots === n ? ' mode-btn--active' : ''}`} onClick={() => setBots(n)} data-testid={`imp-bots-${n}`}>
              {n}
            </button>
          ))}
        </div>
        <p className="modal-note">{bots + 1 >= 8 ? 'Com 8 ou mais há 2 impostores.' : 'Com menos de 8 há 1 impostor.'} Podes calhar a ser tu!</p>
        <button
          type="button"
          className="share-btn"
          data-testid="imp-start"
          onClick={() => {
            const ids = ['tu', ...Array.from({ length: bots }, (_, i) => `bot${i}`)]
            setGame(startGame(ids, ids.slice(1), Date.now(), Math.random, { meetingMs: 45000 }))
          }}
        >
          Começar
        </button>
      </div>
    )
  }

  return (
    <div className="game-panel game-panel--wide">
      <Board game={game} meId="tu" people={botPeople} onAction={onAction} now={now}>
        <div className="game-actions">
          <button type="button" className="share-btn" data-testid="imp-again" onClick={() => gameBreak('impostor', () => setGame((g) => applyAction(g, 'tu', { type: 'rematch' }, Date.now())))}>
            Jogar outra vez
          </button>
          <button type="button" className="mode-btn" onClick={() => setGame(null)}>Mudar nº de bots</button>
        </div>
      </Board>
    </div>
  )
}

// ---------- Online ----------
function OnlineBoard({ state, game, me, dispatch, serverNow }) {
  const people = useCallback((id) => state.players.find((p) => p.id === id) || (id.startsWith('bot') ? { name: BOT_NAMES[Number(id.slice(3))] } : null), [state.players])
  const seated = !!game.players[me.id]
  const tickNow = useNow(true, 100)
  const now = tickNow + (serverNow() - Date.now())
  const onAction = useCallback((a) => Promise.resolve(dispatch(a)).catch(() => {}), [dispatch])
  useResult(seated ? game : null, me.id, `impostor-${state.code}-${game.startedAt}`)
  return (
    <div className="game-panel game-panel--wide">
      <Board game={game} meId={seated ? me.id : null} people={people} onAction={onAction} now={now}>
        {seated && (
          <div className="game-actions">
            <button type="button" className="share-btn" data-testid="imp-again" onClick={() => dispatch({ type: 'rematch' })}>Jogar outra vez</button>
          </div>
        )}
      </Board>
    </div>
  )
}

// Nº de bots escolhido no lobby (lido ao carregar em "Começar jogo").
const lobbyChoice = { bots: 0 }

function LobbyBots({ state, amHost }) {
  const humans = state.players.length
  const min = Math.max(0, 4 - humans)
  const max = Math.max(0, 10 - humans)
  const [bots, setBots] = useState(Math.max(min, 5 - humans))
  const n = Math.min(max, Math.max(min, bots))
  lobbyChoice.bots = n
  const options = useMemo(() => Array.from({ length: max - min + 1 }, (_, i) => min + i), [min, max])
  if (!amHost) return null
  return (
    <div className="bomb-lobby-bots">
      <p className="modal-note">Bots na nave (são precisos pelo menos 4 jogadores):</p>
      <div className="bot-levels">
        {options.map((k) => (
          <button key={k} type="button" className={`mode-btn${n === k ? ' mode-btn--active' : ''}`} onClick={() => setBots(k)} data-testid={`lobby-bots-${k}`}>
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}

const HELP = (
  <>
    <p>Estão todos numa nave. A maioria são <strong>tripulantes</strong>; 1 ou 2 são <strong>impostores</strong> às escondidas.</p>
    <p><strong>Tripulantes:</strong> andam pela nave e fazem as tarefas (os ícones amarelos). Se a barra de tarefas encher, a tripulação ganha.</p>
    <p><strong>Impostores:</strong> fingem que fazem tarefas e eliminam tripulantes quando ninguém está a ver. Ganham quando forem tantos como os tripulantes vivos.</p>
    <p>Quem encontrar um corpo pode <strong>reportar</strong>; também há um botão de emergência no Refeitório. Na reunião falam (na chamada do Discord, por exemplo) e votam em quem expulsar.</p>
    <p>Anda com as setas ou WASD (no telemóvel, com o comando). E para usar, R para reportar, Q para matar.</p>
  </>
)

export default function ImpostorGame() {
  return (
    <GameShell
      game="impostor"
      title="O Impostor"
      help={HELP}
      wide
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
            game="impostor"
            logic={impostorOnline}
            renderLobbyOptions={(props) => <LobbyBots {...props} />}
            prepareStart={() => ({ bots: lobbyChoice.bots })}
            renderGame={(props) => <OnlineBoard {...props} />}
          />
        )
      }
    </GameShell>
  )
}

