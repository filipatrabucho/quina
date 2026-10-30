import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import { gameBreak } from '../../lib/ads.js'
import Astro from './Astro.jsx'
import { Link } from 'react-router-dom'
import { recordResultOnce } from '../../lib/social.js'
import { useAuth } from '../../hooks/useAuth.js'
import { hasAccount, loadLook, saveLook } from './look.js'
import {
  W, H, ROOMS, CORRIDORS, STATIONS, BUTTON, VENTS, COLORS, COLOR_NAMES, HATS, BOT_NAMES, VISION,
  COOLDOWN_OPTIONS, MEETING_OPTIONS, KILL_COOLDOWN_MS, MEETING_MS, SAY_MAX,
  dist, roomAt, ventById, visionOf, taskProgress, actionsFor, startGame, applyAction, tick, impostorOnline,
} from './impostorLogic.js'

const KEYS = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' }
const STATION = Object.fromEntries(STATIONS.map((s) => [s.id, s]))
const secs = (ms) => Math.max(0, Math.ceil(ms / 1000))
const HAT_NAMES = { bone: 'Boné', cartola: 'Cartola', coroa: 'Coroa', festa: 'Chapéu de festa', gorro: 'Gorro', cowboy: 'Cowboy', chef: 'Chef', flor: 'Flor', auscultadores: 'Auscultadores' }
// A personagem de um jogador (cor + chapéu).
const Char = ({ p, size, dead, ghost }) => <Astro color={COLORS[p.color]} hat={dead ? null : p.hat} dead={dead} ghost={ghost} size={size} />

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
function Actions({ can, me, onUse, onKill, onReport, onEmergency, onVent }) {
  const list = []
  if (can.report) list.push({ key: 'report', label: 'Reportar', icon: '📢', run: onReport, kb: 'R', cls: 'imp-act--report' })
  if (me.role === 'impostor' && me.alive) {
    list.push({ key: 'kill', label: can.killIn ? `Matar (${secs(can.killIn)})` : 'Matar', icon: '🔪', run: onKill, kb: 'Q', cls: 'imp-act--kill', off: !can.kill })
  }
  if (can.task) list.push({ key: 'task', label: 'Usar', icon: '🔧', run: onUse, kb: 'E', cls: 'imp-act--use' })
  if (can.emergency) list.push({ key: 'emergency', label: 'Reunião', icon: '🚨', run: onEmergency, kb: 'E', cls: 'imp-act--report' })
  if (can.vent) list.push({ key: 'vent', label: 'Conduta', icon: '🕳️', run: onVent, kb: 'V', cls: 'imp-act--vent' })

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

// Dentro de uma conduta: ir para as condutas ligadas ou sair.
function VentPanel({ ventId, onMove, onExit }) {
  const v = ventById(ventId)
  useEffect(() => {
    const down = (e) => {
      if (e.repeat || e.target.closest?.('input, textarea')) return
      const k = e.key.toUpperCase()
      if (k === 'V' || k === 'E' || k === ' ') {
        e.preventDefault()
        onExit()
      } else if (k === '1' || k === '2') onMove(v.links[Number(k) - 1])
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  })
  return (
    <div className="imp-acts imp-vent" data-testid="imp-vent-panel">
      <span className="imp-vent__title">🕳️ Na conduta ({roomAt(v.x, v.y)}): ninguém te vê.</span>
      {v.links.map((id, i) => {
        const to = ventById(id)
        return (
          <button key={id} type="button" className="imp-act imp-act--use" onClick={() => onMove(id)} data-testid={`imp-vent-to-${id}`}>
            <span aria-hidden="true">➜</span>{roomAt(to.x, to.y)}<kbd>{i + 1}</kbd>
          </button>
        )
      })}
      <button type="button" className="imp-act imp-act--vent" onClick={onExit} data-testid="imp-vent-exit">
        <span aria-hidden="true">⬆️</span>Sair<kbd>V</kbd>
      </button>
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
      {VENTS.map((v) => (
        <g key={v.id} transform={`translate(${v.x * c} ${v.y * c})`} data-vent={v.id}>
          <rect x={c * 0.1} y={c * 0.22} width={c * 0.8} height={c * 0.56} rx={c * 0.1} fill="#1A1E2E" stroke="#6B7394" strokeWidth="1.5" />
          {[0.36, 0.5, 0.64].map((k) => <line key={k} x1={c * 0.18} x2={c * 0.82} y1={c * k} y2={c * k} stroke="#6B7394" strokeWidth="1.2" />)}
        </g>
      ))}
      <g transform={`translate(${BUTTON.x * c} ${BUTTON.y * c})`}>
        <circle cx={c / 2} cy={c / 2} r={c * 0.42} fill="#7A1F2B" />
        <circle cx={c / 2} cy={c / 2} r={c * 0.3} fill="#E5243B" stroke="#14141C" strokeWidth="1.5" />
      </g>
    </svg>
  )
}

// Mini-mapa (toca para aumentar; M no teclado).
function MiniMap({ game, meId }) {
  const [big, setBig] = useState(false)
  const me = game.players[meId]
  useEffect(() => {
    const down = (e) => {
      if (e.repeat || e.target.closest?.('input, textarea')) return
      if (e.key === 'm' || e.key === 'M') setBig((b) => !b)
      else if (e.key === 'Escape') setBig(false)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])
  if (!me) return null
  const todo = me.role === 'crew' ? me.tasks.filter((t) => !me.done.includes(t)).map((t) => STATION[t]) : []
  const imp = me.role === 'impostor'
  const mates = imp ? game.order.filter((id) => id !== meId && game.players[id].role === 'impostor' && game.players[id].alive) : []
  return (
    <button type="button" className={`imp-mini${big ? ' imp-mini--big' : ''}`} onClick={() => setBig((b) => !b)} aria-label={big ? 'Fechar o mapa' : 'Abrir o mapa'} data-testid="imp-minimap">
      <svg viewBox={`-0.5 -0.5 ${W + 1} ${H + 1}`} aria-hidden="true">
        {CORRIDORS.map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} fill="#3A4160" />)}
        {ROOMS.map((r) => (
          <g key={r.name}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="0.4" fill="#4C5578" stroke="#252B45" strokeWidth="0.2" />
            {big && <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 0.3} fontSize="0.85" textAnchor="middle" fill="#E6EAF8" fontWeight="700">{r.name}</text>}
          </g>
        ))}
        <circle cx={BUTTON.x + 0.5} cy={BUTTON.y + 0.5} r="0.55" fill="#E5243B" />
        {imp && VENTS.map((v) => <rect key={v.id} x={v.x + 0.1} y={v.y + 0.25} width="0.8" height="0.5" fill="#9AA3C7" />)}
        {todo.map((s) => <circle key={s.id} cx={s.x + 0.5} cy={s.y + 0.5} r="0.55" fill="#FFC93C" stroke="#14141C" strokeWidth="0.15" data-mini-task={s.id} />)}
        {mates.map((id) => <circle key={id} cx={game.players[id].x + 0.5} cy={game.players[id].y + 0.5} r="0.55" fill="#FF6B6B" />)}
        <circle cx={me.x + 0.5} cy={me.y + 0.5} r="0.8" fill={COLORS[me.color]} stroke="#fff" strokeWidth="0.3" data-mini-me="1" />
      </svg>
      {big && <span className="imp-mini__legend">Amarelo: as tuas tarefas{imp ? ' · cinzento: condutas' : ''} · vermelho: botão de emergência</span>}
    </button>
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
            <Astro color={COLORS[game.players[b.id].color]} dead size={Math.round(c * 1.15)} />
          </span>
        ))}
        {game.order.map((id) => {
          const p = game.players[id]
          const isMe = id === meId
          if (!isMe && (!sees(p) || (!p.alive && !ghostView) || p.vent)) return null
          const imp = me?.role === 'impostor' && p.role === 'impostor'
          return (
            <span key={id} className={`imp-ent${isMe ? ' imp-ent--me' : ''}${p.vent ? ' imp-ent--vent' : ''}`} style={pos(p.x, p.y)} data-testid={isMe ? 'imp-me' : undefined}>
              <span className={`imp-ent__name${imp ? ' imp-ent__name--imp' : ''}`}>{isMe ? 'Tu' : people(id)?.name}</span>
              <Char p={p} ghost={!p.alive} size={Math.round(c * 1.15)} />
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
      {me && !full && <MiniMap game={game} meId={meId} />}
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
      <Char p={me} size={80} />
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

// O que cada frase diz (t: nome de quem se fala; mine: fala-se de mim).
function chatText(m, name, meId) {
  const mine = m.target === meId
  const t = m.target ? name(m.target) : ''
  switch (m.kind) {
    case 'found': return mine ? `Encontrei o teu corpo em ${m.room}.` : `Encontrei o corpo de ${t} em ${m.room}.`
    case 'emergency': return 'Chamei a reunião: alguém anda estranho.'
    case 'saw': return mine ? 'Eu vi-te a matar!' : `Eu vi ${t} a matar!`
    case 'vent': return mine ? 'Eu vi-te a sair de uma conduta!' : `Eu vi ${t} a sair de uma conduta!`
    case 'accuse': return mine ? 'Acho que foste tu.' : `Acho que foi ${t}.`
    case 'safe': return mine ? 'Estavas comigo, não foste tu.' : `${t} estava comigo, não foi.`
    case 'agree': return mine ? 'Concordo, és tu.' : `Concordo, voto em ${t}.`
    case 'deny': return 'Não fui eu! Estava a fazer as minhas tarefas.'
    case 'skip': return 'Não tenho a certeza. Melhor saltar.'
    default: return ''
  }
}

// Frases rápidas para falar com os bots (e com toda a gente, online).
const PHRASES = [
  { kind: 'saw', label: 'Vi a matar', icon: '🔪', target: true },
  { kind: 'vent', label: 'Vi na conduta', icon: '🕳️', target: true },
  { kind: 'accuse', label: 'Acho que foi…', icon: '🤔', target: true },
  { kind: 'safe', label: 'Estava comigo', icon: '🤝', target: true },
  { kind: 'deny', label: 'Não fui eu', icon: '🙅' },
  { kind: 'skip', label: 'Saltem', icon: '🤷' },
]

function Meeting({ game, meId, people, now, onVote, onSay }) {
  const name = nameWith(people, meId)
  const m = game.meeting
  const me = game.players[meId]
  const myVote = m.votes[meId]
  const body = m.body && game.bodies.find((b) => b.id === m.body)
  const [picking, setPicking] = useState(null) // frase à espera de escolher a pessoa
  const chatRef = useRef(null)
  const chat = (m.chat || []).filter((c) => c.at <= now).sort((a, b) => a.at - b.at)
  const typing = [...new Set((m.chat || []).filter((c) => c.at > now).map((c) => c.by))]
  const left = SAY_MAX - (m.chat || []).filter((c) => c.by === meId).length
  useEffect(() => {
    const el = chatRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.length])
  const speak = (kind, target = null) => {
    onSay({ type: 'say', kind, target })
    setPicking(null)
  }
  const pickPhrase = PHRASES.find((x) => x.kind === picking)
  return (
    <div className="imp-over imp-over--flow imp-meeting" data-testid="imp-meeting">
      <p className="imp-over__kicker">{body ? '📢 Corpo encontrado' : '🚨 Reunião de emergência'}</p>
      <h3>Quem é o impostor?</h3>
      <p className="imp-meeting__time">Faltam <b data-testid="imp-meet-time">{secs(game.phaseEnds - now)}</b> s · digam o que viram e votem</p>
      <div className="imp-chat" ref={chatRef} data-testid="imp-chat" aria-live="polite">
        {chat.length === 0 && <p className="imp-chat__empty">Ninguém disse nada ainda.</p>}
        {chat.map((c, k) => (
          <p key={k} className={`imp-chat__msg${c.by === meId ? ' imp-chat__msg--me' : ''}`}>
            <Char p={game.players[c.by]} size={22} />
            <b style={{ color: COLORS[game.players[c.by].color] }}>{name(c.by)}:</b> {chatText(c, name, meId)}
          </p>
        ))}
        {typing.length > 0 && <p className="imp-chat__typing">{typing.map(name).join(', ')} {typing.length === 1 ? 'está' : 'estão'} a escrever…</p>}
      </div>
      {me?.alive && (
        <div className="imp-say" data-testid="imp-say">
          {pickPhrase ? (
            <p className="imp-say__hint">
              {pickPhrase.icon} <b>{pickPhrase.label}</b>: toca na pessoa de quem estás a falar.{' '}
              <button type="button" className="link-btn" onClick={() => setPicking(null)}>Cancelar</button>
            </p>
          ) : left > 0 ? (
            <>
              <span className="imp-say__label">Dizer ({left}):</span>
              {PHRASES.map((ph) => (
                <button key={ph.kind} type="button" className="imp-say__btn" onClick={() => (ph.target ? setPicking(ph.kind) : speak(ph.kind))} data-testid={`imp-say-${ph.kind}`}>
                  <span aria-hidden="true">{ph.icon}</span> {ph.label}
                </button>
              ))}
            </>
          ) : (
            <p className="imp-say__hint">Já disseste tudo o que podias nesta reunião.</p>
          )}
        </div>
      )}
      <div className="imp-votes">
        {game.order.map((id) => {
          const p = game.players[id]
          const voted = !!m.votes[id]
          const pick = picking && p.alive && id !== meId
          return (
            <button
              key={id}
              type="button"
              className={`imp-vote${!p.alive ? ' imp-vote--dead' : ''}${myVote === id ? ' imp-vote--mine' : ''}${pick ? ' imp-vote--pick' : ''}`}
              disabled={picking ? !pick : !p.alive || !me?.alive || !!myVote}
              onClick={() => (picking ? speak(picking, id) : onVote(id))}
              data-testid={`imp-vote-${id === meId ? 'me' : id}`}
            >
              <Char p={p} dead={!p.alive} size={30} />
              <span>{name(id)}</span>
              {voted && p.alive && <small className="imp-vote__done">votou</small>}
            </button>
          )
        })}
      </div>
      {me?.alive ? (
        myVote ? <p className="modal-note">Já votaste. À espera dos outros…</p> : (
          <button type="button" className="mode-btn" onClick={() => onVote('skip')} disabled={!!picking} data-testid="imp-skip">Saltar voto</button>
        )
      ) : <p className="modal-note">Estás morto: vês a votação mas não votas nem falas.</p>}
      {!picking && me?.alive && !myVote && <p className="modal-note imp-meeting__tip">Toca numa pessoa para votar nela. Os bots ouvem o que dizes antes de votar.</p>}
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
          <span className="imp-eject__astro"><Char p={p} size={70} /></span>
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
          <span key={id}><Char p={game.players[id]} size={34} /> {name(id)} {imps.length > 1 ? 'eram' : 'era'} impostor</span>
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
        {game.phase === 'meeting' && <Meeting game={game} meId={meId} people={people} now={now} onVote={(target) => onAction({ type: 'vote', target })} onSay={onAction} />}
        {game.phase === 'eject' && <Eject game={game} meId={meId} people={people} />}
        {game.phase === 'over' && <Over game={game} meId={meId} people={people}>{children}</Over>}
        {task && <TaskModal id={task} onClose={() => setTask(null)} onDone={() => { onAction({ type: 'task', id: task }); setTask(null) }} />}
      </div>
      {me && playing && (
        <div className="imp-foot">
          <div className="imp-controls">
            <Pad press={press} release={release} />
            {can.inVent ? (
              <VentPanel ventId={can.inVent} onMove={(to) => onAction({ type: 'ventMove', to })} onExit={() => onAction({ type: 'vent' })} />
            ) : (
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
                onVent={() => {
                  onDir(null)
                  onAction({ type: 'vent' })
                }}
              />
            )}
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
            <p className="modal-note imp-hint--keys">Setas ou WASD para andar · E para usar · R para reportar · M para o mapa{me.role === 'impostor' ? ' · Q para matar · V para as condutas' : ''}</p>
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

// ---------- Aparência e definições ----------
// Cor e chapéu: só com conta (ficam guardados na conta).
function LookPicker({ user, look, onChange, taken = new Set() }) {
  const [saved, setSaved] = useState('')
  if (!hasAccount(user)) {
    return (
      <div className="imp-look imp-look--locked" data-testid="imp-look-locked">
        <Astro color={COLORS[0]} hat="coroa" size={46} />
        <p className="modal-note"><Link to="/conta?modo=criar&voltar=%2Fimpostor">Cria uma conta grátis</Link> para escolheres a cor e o chapéu do teu boneco.</p>
      </div>
    )
  }
  const set = (patch) => {
    const next = { color: look?.color ?? null, hat: look?.hat ?? null, ...patch }
    onChange(next)
    setSaved('')
    saveLook(next).then(() => setSaved('Guardado na tua conta ✓'), () => setSaved('Não deu para guardar na conta, mas fica para esta partida.'))
  }
  const color = look?.color ?? null
  return (
    <div className="imp-look" data-testid="imp-look">
      <div className="imp-look__preview">
        <Astro color={COLORS[color ?? 0]} hat={look?.hat} size={76} />
        <small>{color == null ? 'Cor ao calhas' : COLOR_NAMES[color]}{look?.hat ? ` · ${HAT_NAMES[look.hat]}` : ''}</small>
      </div>
      <div className="imp-look__opts">
        <p className="imp-look__label">Cor</p>
        <div className="imp-look__colors">
          {COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              className={`imp-swatch${color === i ? ' imp-swatch--on' : ''}`}
              style={{ background: c }}
              disabled={taken.has(i) && color !== i}
              title={taken.has(i) && color !== i ? `${COLOR_NAMES[i]} (já escolhida)` : COLOR_NAMES[i]}
              aria-label={COLOR_NAMES[i]}
              aria-pressed={color === i}
              onClick={() => set({ color: i })}
              data-testid={`imp-color-${i}`}
            />
          ))}
        </div>
        <p className="imp-look__label">Chapéu</p>
        <div className="imp-look__hats">
          {[null, ...HATS].map((h) => (
            <button
              key={h || 'nenhum'}
              type="button"
              className={`imp-hat${(look?.hat ?? null) === h ? ' imp-hat--on' : ''}`}
              title={h ? HAT_NAMES[h] : 'Sem chapéu'}
              aria-label={h ? HAT_NAMES[h] : 'Sem chapéu'}
              aria-pressed={(look?.hat ?? null) === h}
              onClick={() => set({ hat: h })}
              data-testid={`imp-hat-${h || 'nenhum'}`}
            >
              <Astro color={COLORS[color ?? 0]} hat={h} size={34} />
            </button>
          ))}
        </div>
        {saved && <p className="modal-note imp-look__saved">{saved}</p>}
      </div>
    </div>
  )
}

function useLook(user) {
  const [look, setLook] = useState(null)
  useEffect(() => setLook(loadLook(user)), [user])
  return [look, setLook]
}

// Tempo entre mortes e duração das reuniões.
function TimeOptions({ cooldown, meeting, onChange }) {
  return (
    <div className="imp-times">
      <p className="modal-note">Tempo de espera do impostor entre mortes:</p>
      <div className="bot-levels">
        {COOLDOWN_OPTIONS.map((s) => (
          <button key={s} type="button" className={`mode-btn${cooldown === s ? ' mode-btn--active' : ''}`} onClick={() => onChange({ cooldown: s, meeting })} data-testid={`imp-cd-${s}`}>
            {s} s
          </button>
        ))}
      </div>
      <p className="modal-note">Duração das reuniões:</p>
      <div className="bot-levels">
        {MEETING_OPTIONS.map((s) => (
          <button key={s} type="button" className={`mode-btn${meeting === s ? ' mode-btn--active' : ''}`} onClick={() => onChange({ cooldown, meeting: s })} data-testid={`imp-meet-${s}`}>
            {s} s
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- Contra bots (tudo no browser) ----------
const botPeople = (id) => (id === 'tu' ? { name: 'Tu' } : { name: BOT_NAMES[Number(id.slice(3))] })

function VsBots() {
  const [bots, setBots] = useState(6)
  const [times, setTimes] = useState({ cooldown: KILL_COOLDOWN_MS / 1000, meeting: 45 })
  const { user } = useAuth()
  const [look, setLook] = useLook(user)
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
        <TimeOptions cooldown={times.cooldown} meeting={times.meeting} onChange={setTimes} />
        <LookPicker user={user} look={look} onChange={setLook} />
        <button
          type="button"
          className="share-btn"
          data-testid="imp-start"
          onClick={() => {
            const ids = ['tu', ...Array.from({ length: bots }, (_, i) => `bot${i}`)]
            setGame(startGame(ids, ids.slice(1), Date.now(), Math.random, { killCooldown: times.cooldown * 1000, meetingMs: times.meeting * 1000, looks: { tu: look || {} } }))
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
          <button type="button" className="mode-btn" onClick={() => setGame(null)}>Mudar bots e definições</button>
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

// Escolhas do anfitrião no lobby (lidas ao carregar em "Começar jogo").
const lobbyChoice = { bots: 0, killCooldown: KILL_COOLDOWN_MS / 1000, meeting: MEETING_MS / 1000 }

function LobbyOptions({ state, amHost, dispatch }) {
  const humans = state.players.length
  const min = Math.max(0, 4 - humans)
  const max = Math.max(0, 10 - humans)
  const [bots, setBots] = useState(Math.max(min, 5 - humans))
  const [times, setTimes] = useState({ cooldown: lobbyChoice.killCooldown, meeting: lobbyChoice.meeting })
  const { user } = useAuth()
  const [look, setLook] = useLook(user)
  const n = Math.min(max, Math.max(min, bots))
  lobbyChoice.bots = n
  lobbyChoice.killCooldown = times.cooldown
  lobbyChoice.meeting = times.meeting
  const options = useMemo(() => Array.from({ length: max - min + 1 }, (_, i) => min + i), [min, max])
  // A minha cor e chapéu vão para a sala (o anfitrião usa-os ao começar).
  useEffect(() => {
    if (look && (look.color != null || look.hat)) dispatch({ type: 'prefs', prefs: { color: look.color, hat: look.hat } })
  }, [look?.color, look?.hat]) // eslint-disable-line react-hooks/exhaustive-deps
  const taken = new Set(state.players.filter((p) => p.id !== user?.id && Number.isInteger(p.prefs?.color)).map((p) => p.prefs.color))
  return (
    <div className="imp-lobby">
      {amHost && (
        <div className="bomb-lobby-bots">
          <p className="modal-note">Bots na nave (são precisos pelo menos 4 jogadores):</p>
          <div className="bot-levels">
            {options.map((k) => (
              <button key={k} type="button" className={`mode-btn${n === k ? ' mode-btn--active' : ''}`} onClick={() => setBots(k)} data-testid={`lobby-bots-${k}`}>
                {k}
              </button>
            ))}
          </div>
          <TimeOptions cooldown={times.cooldown} meeting={times.meeting} onChange={setTimes} />
        </div>
      )}
      <LookPicker user={user} look={look} onChange={setLook} taken={taken} />
    </div>
  )
}

const HELP = (
  <>
    <p>Estão todos numa nave. A maioria são <strong>tripulantes</strong>; 1 ou 2 são <strong>impostores</strong> às escondidas.</p>
    <p><strong>Tripulantes:</strong> andam pela nave e fazem as tarefas (os ícones amarelos). Se a barra de tarefas encher, a tripulação ganha.</p>
    <p><strong>Impostores:</strong> fingem que fazem tarefas e eliminam tripulantes quando ninguém está a ver. Ganham quando forem tantos como os tripulantes vivos.</p>
    <p>Quem encontrar um corpo pode <strong>reportar</strong>; também há um botão de emergência no Refeitório. Na reunião falam (na chamada do Discord, por exemplo) e votam em quem expulsar.</p>
    <p>Na reunião também há <strong>frases rápidas</strong> (“Vi a matar”, “Estava comigo”…): os bots leem o que dizes e votam conforme o que se diz. Mas cuidado, um impostor também pode mentir!</p>
    <p>Os impostores podem esconder-se nas <strong>condutas de ar</strong> (as grelhas no chão) e viajar por elas para outras salas. Quem os vir a entrar ou a sair fica a desconfiar!</p>
    <p>O <strong>mini-mapa</strong> no canto mostra onde estás e as tuas tarefas; toca nele (ou carrega em M) para o aumentar.</p>
    <p>Na sala dá para mudar o tempo de espera do impostor entre mortes e a duração das reuniões. Com conta, escolhes a cor e o chapéu do teu boneco.</p>
    <p>Anda com as setas ou WASD (no telemóvel, com o comando). E para usar, R para reportar, Q para matar, V para as condutas.</p>
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
            renderLobbyOptions={(props) => <LobbyOptions {...props} />}
            prepareStart={() => ({ bots: lobbyChoice.bots, killCooldown: lobbyChoice.killCooldown, meeting: lobbyChoice.meeting })}
            renderGame={(props) => <OnlineBoard {...props} />}
          />
        )
      }
    </GameShell>
  )
}

