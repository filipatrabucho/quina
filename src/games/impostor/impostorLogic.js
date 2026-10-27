// O Impostor: jogo de dedução social numa nave. Os tripulantes fazem tarefas;
// os impostores eliminam tripulantes às escondidas. Quando alguém encontra um
// corpo (ou carrega no botão de emergência) há uma reunião: falam (na chamada)
// e votam para expulsar alguém. A tripulação ganha se fizer todas as tarefas
// ou expulsar os impostores; os impostores ganham quando forem tantos como os
// tripulantes vivos. Lógica pura: corre no anfitrião da sala (ou no browser).

export const W = 32
export const H = 20
export const STEP_MS = 125
export const ROLE_MS = 4500
export const MEETING_MS = 60000
export const EJECT_MS = 6000
export const KILL_COOLDOWN_MS = 15000
// Opções da sala (em segundos).
export const COOLDOWN_OPTIONS = [10, 15, 20, 25, 30]
export const MEETING_OPTIONS = [30, 45, 60, 90]
export const KILL_RANGE = 1.5
export const REPORT_RANGE = 2
export const USE_RANGE = 1
export const VISION = { crew: 4.5, impostor: 6.5 }
export const TASKS_EACH = 5
export const BOT_TASK_MS = 10000 // quanto tempo um bot demora numa tarefa
export const BOT_NAMES = ['Bot Rita', 'Bot Zé', 'Bot Inês', 'Bot Rui', 'Bot Ana', 'Bot Tó', 'Bot Bia', 'Bot Gui', 'Bot Lia']
export const COLORS = ['#E5243B', '#2F80ED', '#2FBF71', '#F2B53B', '#8E44AD', '#FF7A1A', '#1ABC9C', '#EC4899', '#F5F5F5', '#6B4F2A']
export const COLOR_NAMES = ['Vermelho', 'Azul', 'Verde', 'Amarelo', 'Roxo', 'Laranja', 'Turquesa', 'Rosa', 'Branco', 'Castanho']
export const HATS = ['bone', 'cartola', 'coroa', 'festa', 'gorro', 'cowboy', 'chef', 'flor', 'auscultadores']
const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }

// ---------- Mapa ----------
// 3×3 salas ligadas por corredores.
export const ROOMS = [
  { name: 'Cozinha', x: 1, y: 1, w: 7, h: 5 },
  { name: 'Refeitório', x: 12, y: 1, w: 8, h: 5 },
  { name: 'Comunicações', x: 24, y: 1, w: 7, h: 5 },
  { name: 'Enfermaria', x: 1, y: 8, w: 7, h: 4 },
  { name: 'Escritório', x: 12, y: 8, w: 8, h: 4 },
  { name: 'Armazém', x: 24, y: 8, w: 7, h: 4 },
  { name: 'Máquinas', x: 1, y: 14, w: 7, h: 5 },
  { name: 'Ponte de comando', x: 12, y: 14, w: 8, h: 5 },
  { name: 'Laboratório', x: 24, y: 14, w: 7, h: 5 },
]
export const CORRIDORS = [
  // horizontais
  [8, 3, 4, 2], [20, 3, 4, 2], [8, 9, 4, 2], [20, 9, 4, 2], [8, 16, 4, 2], [20, 16, 4, 2],
  // verticais
  [4, 6, 2, 2], [15, 6, 2, 2], [27, 6, 2, 2], [4, 12, 2, 2], [15, 12, 2, 2], [27, 12, 2, 2],
]
export const GRID = (() => {
  const g = Array.from({ length: H }, () => Array(W).fill('#'))
  for (const r of [...ROOMS.map((r) => [r.x, r.y, r.w, r.h]), ...CORRIDORS]) {
    const [x0, y0, w, h] = r
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) g[y][x] = '.'
  }
  return g.map((row) => row.join(''))
})()
export const isFloor = (x, y) => x >= 0 && y >= 0 && x < W && y < H && GRID[y][x] === '.'
export const roomAt = (x, y) => ROOMS.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)?.name || 'Corredor'

export const BUTTON = { x: 15, y: 2 } // botão de emergência (Refeitório)
// Condutas de ar: só os impostores as usam. Cada grupo liga 3 salas.
const VENT_GROUPS = [
  [{ id: 'v-cozinha', x: 4, y: 2 }, { id: 'v-enfermaria', x: 6, y: 10 }, { id: 'v-maquinas', x: 4, y: 17 }],
  [{ id: 'v-comunicacoes', x: 27, y: 4 }, { id: 'v-armazem', x: 25, y: 9 }, { id: 'v-laboratorio', x: 27, y: 15 }],
  [{ id: 'v-refeitorio', x: 12, y: 1 }, { id: 'v-escritorio', x: 13, y: 10 }, { id: 'v-ponte', x: 19, y: 17 }],
]
export const VENTS = VENT_GROUPS.flatMap((group) => group.map((v) => ({ ...v, links: group.filter((o) => o.id !== v.id).map((o) => o.id) })))
export const ventById = (id) => VENTS.find((v) => v.id === id)
export const STATIONS = [
  { id: 'lixo', name: 'Esvaziar o lixo', x: 2, y: 2 },
  { id: 'fogao', name: 'Desligar o fogão', x: 6, y: 5 },
  { id: 'filtro', name: 'Limpar o filtro', x: 19, y: 5 },
  { id: 'fios', name: 'Ligar os fios', x: 29, y: 2 },
  { id: 'antena', name: 'Alinhar a antena', x: 25, y: 5 },
  { id: 'exame', name: 'Fazer o exame', x: 2, y: 10 },
  { id: 'papeis', name: 'Assinar papéis', x: 18, y: 9 },
  { id: 'caixas', name: 'Arrumar caixas', x: 29, y: 10 },
  { id: 'motor', name: 'Calibrar o motor', x: 2, y: 17 },
  { id: 'energia', name: 'Repor a energia', x: 6, y: 15 },
  { id: 'rota', name: 'Corrigir a rota', x: 16, y: 18 },
  { id: 'amostra', name: 'Analisar amostra', x: 29, y: 17 },
]
const SPAWN = [[13, 3], [14, 3], [17, 3], [18, 3], [13, 4], [14, 4], [17, 4], [18, 4], [15, 5], [16, 5]]

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
// Os bots impostores esperam mais entre mortes (são mais certeiros do que as pessoas).
const BOT_COOLDOWN_X = 1.3
const cooldownOf = (cfgMs, isBotPlayer) => Math.round(cfgMs * (isBotPlayer ? BOT_COOLDOWN_X : 1))
export const isBot = (g, id) => g.bots.includes(id)
export const visionOf = (g, id) => (g.players[id].role === 'impostor' ? VISION.impostor : VISION.crew)
const alive = (g) => g.order.filter((id) => g.players[id].alive)
const aliveBy = (g, role) => alive(g).filter((id) => g.players[id].role === role)

function shuffle(list, rand = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function impostorCount(n) {
  return n >= 8 ? 2 : 1
}

// Cores: primeiro as escolhidas (se ninguém a tiver já), depois as que sobram.
function assignLooks(ids, looks = {}) {
  const color = {}
  const taken = new Set()
  for (const id of ids) {
    const c = looks[id]?.color
    if (Number.isInteger(c) && c >= 0 && c < COLORS.length && !taken.has(c)) {
      color[id] = c
      taken.add(c)
    }
  }
  const free = COLORS.map((_, i) => i).filter((i) => !taken.has(i))
  ids.forEach((id, i) => {
    if (color[id] == null) color[id] = free.length ? free.shift() : i % COLORS.length
  })
  const hat = Object.fromEntries(ids.map((id) => [id, HATS.includes(looks[id]?.hat) ? looks[id].hat : null]))
  return { color, hat }
}

// opts: { killCooldown, meetingMs, looks: { id: { color, hat } } }
export function startGame(ids, bots = [], now = Date.now(), rand = Math.random, opts = {}) {
  if (ids.length < 4) throw new Error('São precisos pelo menos 4 jogadores (podes juntar bots).')
  const imps = new Set(shuffle(ids, rand).slice(0, impostorCount(ids.length)))
  const looks = assignLooks(ids, opts.looks)
  const players = {}
  ids.forEach((id, i) => {
    const [x, y] = SPAWN[i % SPAWN.length]
    const role = imps.has(id) ? 'impostor' : 'crew'
    players[id] = {
      x, y, dir: null, next: 0, color: looks.color[id], hat: looks.hat[id], vent: null, role, alive: true,
      tasks: shuffle(STATIONS.map((s) => s.id), rand).slice(0, TASKS_EACH),
      done: [], emergency: 1, killReady: now + ROLE_MS + cooldownOf(opts.killCooldown || KILL_COOLDOWN_MS, bots.includes(id)),
      bot: bots.includes(id) ? { goal: null, wait: 0, suspect: null, why: null, target: null, flee: false, ventOut: 0, ventMoved: false } : null,
    }
  })
  return {
    order: ids,
    bots,
    players,
    bodies: [],
    phase: 'roles',
    phaseEnds: now + ROLE_MS,
    meeting: null,
    eject: null,
    winner: null,
    reason: null,
    cfg: { killCooldown: opts.killCooldown || KILL_COOLDOWN_MS, meetingMs: opts.meetingMs || MEETING_MS },
    log: [],
    round: (opts.round || 0) + 1,
    wins: opts.wins || { crew: 0, impostor: 0 },
    startedAt: now,
  }
}

const clone = (g) => ({
  ...g,
  players: Object.fromEntries(Object.entries(g.players).map(([id, p]) => [id, { ...p, done: p.done.slice(), bot: p.bot && { ...p.bot } }])),
  bodies: g.bodies.slice(),
  meeting: g.meeting && { ...g.meeting, votes: { ...g.meeting.votes } },
  log: g.log.slice(),
})

function addLog(g, msg) {
  g.log = [msg, ...g.log].slice(0, 20)
}

// Tarefas: total da tripulação (contam também as dos tripulantes já mortos).
export function taskProgress(g) {
  let total = 0
  let done = 0
  for (const id of g.order) {
    const p = g.players[id]
    if (p.role !== 'crew') continue
    total += p.tasks.length
    done += p.done.length
  }
  return { done, total }
}

function checkWin(g, now) {
  if (g.phase === 'over') return true
  const imps = aliveBy(g, 'impostor').length
  const crew = aliveBy(g, 'crew').length
  const { done, total } = taskProgress(g)
  let winner = null
  let reason = null
  if (imps === 0) [winner, reason] = ['crew', 'Os impostores foram todos expulsos.']
  else if (total > 0 && done >= total) [winner, reason] = ['crew', 'A tripulação fez todas as tarefas.']
  else if (imps >= crew) [winner, reason] = ['impostor', 'Os impostores ficaram em maioria.']
  if (!winner) return false
  g.phase = 'over'
  g.winner = winner
  g.reason = reason
  g.phaseEnds = null
  g.wins = { ...g.wins, [winner]: (g.wins[winner] || 0) + 1 }
  return true
}

// ---------- Movimento ----------
function tryMove(g, id, now) {
  const p = g.players[id]
  if (!p.dir || p.vent || now < p.next || g.phase !== 'play') return false
  const [dx, dy] = DIRS[p.dir]
  const nx = p.x + dx
  const ny = p.y + dy
  if (!isFloor(nx, ny)) return false
  p.x = nx
  p.y = ny
  p.next = now + STEP_MS
  return true
}

// O que esta pessoa pode fazer agora, onde está.
export function actionsFor(g, id, now) {
  const p = g.players[id]
  const out = { task: null, report: null, kill: null, emergency: false, killIn: 0, vent: null, inVent: null }
  if (!p || g.phase !== 'play') return out
  if (p.vent) {
    // Dentro da conduta só dá para mudar de conduta ou sair.
    out.inVent = p.vent
    if (p.role === 'impostor') out.killIn = Math.max(0, p.killReady - now)
    return out
  }
  if (p.role === 'crew') {
    const st = STATIONS.find((s) => p.tasks.includes(s.id) && !p.done.includes(s.id) && dist(p, s) <= USE_RANGE)
    if (st) out.task = st.id
  }
  if (!p.alive) return out
  const body = g.bodies.find((b) => dist(p, b) <= REPORT_RANGE)
  if (body) out.report = body.id
  if (p.emergency > 0 && dist(p, BUTTON) <= 1.5) out.emergency = true
  if (p.role === 'impostor') {
    const v = VENTS.find((x) => dist(p, x) <= USE_RANGE)
    if (v) out.vent = v.id
    out.killIn = Math.max(0, p.killReady - now)
    if (!out.killIn) {
      const target = alive(g)
        .filter((o) => o !== id && g.players[o].role === 'crew' && dist(p, g.players[o]) <= KILL_RANGE)
        .sort((a, b) => dist(p, g.players[a]) - dist(p, g.players[b]))[0]
      if (target) out.kill = target
    }
  }
  return out
}

function kill(g, id, target, now) {
  const k = g.players[id]
  const v = g.players[target]
  v.alive = false
  v.dir = null
  g.bodies.push({ id: target, x: v.x, y: v.y })
  k.killReady = now + cooldownOf(g.cfg.killCooldown, !!k.bot)
  // Quem estava a ver fica a saber (os bots lembram-se).
  for (const o of alive(g)) {
    const w = g.players[o]
    if (o === id || w.role !== 'crew' || !w.bot) continue
    if (dist(w, k) <= VISION.crew) Object.assign(w.bot, { suspect: id, why: 'kill' })
  }
}

// Entrar/sair/mudar de conduta. Quem vir um impostor a entrar ou a sair desconfia.
function seenByCrew(g, id) {
  const p = g.players[id]
  for (const o of alive(g)) {
    const w = g.players[o]
    if (o !== id && w.role === 'crew' && w.bot && dist(w, p) <= VISION.crew) Object.assign(w.bot, { suspect: id, why: 'vent' })
  }
}
function enterVent(g, id, ventId) {
  const p = g.players[id]
  const v = ventById(ventId)
  Object.assign(p, { x: v.x, y: v.y, dir: null, vent: v.id })
  seenByCrew(g, id)
}
function moveVent(g, id, to) {
  const p = g.players[id]
  const v = ventById(to)
  Object.assign(p, { x: v.x, y: v.y, vent: v.id })
}
function exitVent(g, id) {
  g.players[id].vent = null
  seenByCrew(g, id)
}

function startMeeting(g, by, body, now) {
  g.phase = 'meeting'
  g.phaseEnds = now + g.cfg.meetingMs
  g.meeting = { by, body, votes: {} }
  for (const id of g.order) Object.assign(g.players[id], { dir: null, vent: null })
  addLog(g, body ? `@${by} encontrou o corpo de @${body}.` : `@${by} chamou uma reunião de emergência.`)
}

function endMeeting(g, now) {
  const tally = {}
  for (const v of Object.values(g.meeting.votes)) tally[v] = (tally[v] || 0) + 1
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1])
  let out = null
  if (ranked.length && ranked[0][0] !== 'skip' && (ranked.length === 1 || ranked[0][1] > ranked[1][1])) out = ranked[0][0]
  if (out) {
    g.players[out].alive = false
    addLog(g, `@${out} foi expulso${g.players[out].role === 'impostor' ? ' e era impostor' : ' e não era impostor'}.`)
  } else addLog(g, 'Ninguém foi expulso.')
  g.eject = { id: out, wasImpostor: out ? g.players[out].role === 'impostor' : null, tally, votes: g.meeting.votes, left: aliveBy(g, 'impostor').length }
  g.meeting = null
  g.phase = 'eject'
  g.phaseEnds = now + EJECT_MS
}

function resumePlay(g, now) {
  g.bodies = []
  g.eject = null
  g.phase = 'play'
  g.phaseEnds = null
  let k = 0
  for (const id of g.order) {
    const p = g.players[id]
    if (p.alive) {
      ;[p.x, p.y] = SPAWN[k++ % SPAWN.length]
    }
    p.dir = null
    p.vent = null
    if (p.role === 'impostor') p.killReady = now + cooldownOf(g.cfg.killCooldown, !!p.bot)
    if (p.bot) Object.assign(p.bot, { goal: null, wait: 0, target: null, flee: false, ventOut: 0, ventMoved: false })
  }
}

// ---------- Ações das pessoas ----------
export function applyAction(game, id, action, now = Date.now(), rand = Math.random) {
  const p = game.players[id]
  if (!p) throw new Error('Não estás neste jogo.')
  if (action.type === 'rematch') {
    if (game.phase !== 'over') return game
    const looks = Object.fromEntries(game.order.map((id) => [id, { color: game.players[id].color, hat: game.players[id].hat }]))
    return startGame(game.order, game.bots, now, rand, { ...game.cfg, round: game.round, wins: game.wins, looks })
  }
  if (action.type === 'dir') {
    const dir = action.dir && DIRS[action.dir] ? action.dir : null
    if (p.dir === dir) return game
    const g = clone(game)
    g.players[id].dir = dir
    tryMove(g, id, now)
    return g
  }
  if (action.type === 'vote') {
    if (game.phase !== 'meeting' || !p.alive || game.meeting.votes[id]) return game
    const target = action.target
    if (target !== 'skip' && !game.players[target]?.alive) throw new Error('Não podes votar nessa pessoa.')
    const g = clone(game)
    g.meeting.votes[id] = target
    if (alive(g).every((o) => g.meeting.votes[o])) endMeeting(g, now)
    return g
  }
  if (game.phase !== 'play') return game
  const can = actionsFor(game, id, now)
  const g = clone(game)
  const me = g.players[id]
  switch (action.type) {
    case 'task':
      if (can.task !== action.id) throw new Error('Tens de estar junto da tarefa.')
      me.done.push(action.id)
      checkWin(g, now)
      return g
    case 'kill':
      if (!can.kill) throw new Error('Não há ninguém perto ou ainda não podes.')
      kill(g, id, can.kill, now)
      checkWin(g, now)
      return g
    case 'report':
      if (!can.report) throw new Error('Não há nenhum corpo perto.')
      startMeeting(g, id, can.report, now)
      return g
    case 'vent':
      if (can.inVent) exitVent(g, id)
      else if (can.vent) enterVent(g, id, can.vent)
      else throw new Error('Não há nenhuma conduta aqui.')
      return g
    case 'ventMove':
      if (!can.inVent || !ventById(can.inVent).links.includes(action.to)) throw new Error('Essa conduta não está ligada a esta.')
      moveVent(g, id, action.to)
      return g
    case 'emergency':
      if (!can.emergency) throw new Error('Tens de estar junto do botão.')
      me.emergency -= 1
      startMeeting(g, id, null, now)
      return g
    default:
      throw new Error('Ação desconhecida.')
  }
}

// ---------- Bots ----------
function bfsStep(from, to) {
  if (from.x === to.x && from.y === to.y) return null
  const key = (x, y) => y * W + x
  const prev = new Map([[key(from.x, from.y), null]])
  const q = [[from.x, from.y]]
  while (q.length) {
    const [x, y] = q.shift()
    if (x === to.x && y === to.y) break
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
      const nx = x + dx
      const ny = y + dy
      const k = key(nx, ny)
      if (!isFloor(nx, ny) || prev.has(k)) continue
      prev.set(k, [x, y, d])
      q.push([nx, ny])
    }
  }
  let cur = prev.get(key(to.x, to.y))
  if (cur === undefined) return null
  let dir = null
  let at = [to.x, to.y]
  while (cur) {
    dir = cur[2]
    at = [cur[0], cur[1]]
    if (at[0] === from.x && at[1] === from.y) break
    cur = prev.get(key(at[0], at[1]))
  }
  return dir
}

function botPlay(g, id, now, rand) {
  const p = g.players[id]
  const b = p.bot
  const can = actionsFor(g, id, now)
  // Impostor numa conduta: muda para outra e sai lá.
  if (p.vent) {
    if (now >= b.ventOut) {
      if (!b.ventMoved) {
        const links = ventById(p.vent).links
        moveVent(g, id, links[Math.floor(rand() * links.length)])
        Object.assign(b, { ventMoved: true, ventOut: now + 700 })
      } else {
        exitVent(g, id)
        Object.assign(b, { flee: false, ventMoved: false, goal: null })
      }
    }
    p.dir = null
    return
  }
  if (p.role === 'impostor' && p.alive && b.flee) {
    // depois de matar foge pela conduta mais perto (se ninguém estiver a ver)
    const watching = alive(g).some((o) => o !== id && g.players[o].role === 'crew' && dist(p, g.players[o]) <= VISION.crew)
    if (can.vent && !watching) {
      enterVent(g, id, can.vent)
      b.ventOut = now + 600
      return
    }
    if (!b.goal?.vent) {
      const v = [...VENTS].sort((x, y) => dist(p, x) - dist(p, y))[0]
      if (dist(p, v) > 7) b.flee = false
      else b.goal = { x: v.x, y: v.y, vent: true }
    }
  }
  if (p.alive) {
    // vê um corpo: vai lá e reporta (os impostores não reportam)
    if (p.role === 'crew') {
      if (can.report) return startMeeting(g, id, can.report, now)
      const seen = g.bodies.find((x) => dist(p, x) <= VISION.crew)
      if (seen) b.goal = { x: seen.x, y: seen.y }
    }
    if (p.role === 'impostor' && can.kill) {
      // só mata sem testemunhas
      const witnesses = alive(g).filter((o) => o !== id && o !== can.kill && g.players[o].role === 'crew' && dist(p, g.players[o]) <= VISION.crew)
      if (!witnesses.length && rand() < 0.8) {
        kill(g, id, can.kill, now)
        b.goal = null
        b.flee = rand() < 0.7
        return checkWin(g, now)
      }
    }
  }
  if (p.role === 'crew' && can.task) {
    if (!b.wait) b.wait = now + BOT_TASK_MS
    if (now >= b.wait) {
      p.done.push(can.task)
      b.wait = 0
      b.goal = null
      checkWin(g, now)
    }
    p.dir = null
    return
  }
  // escolhe um destino: tarefas por fazer; os impostores andam atrás de alguém ou fingem tarefas
  if (!b.goal || (p.x === b.goal.x && p.y === b.goal.y)) {
    if (p.role === 'crew') {
      // às vezes dá uma volta (como as pessoas) antes da tarefa seguinte
      const todo = STATIONS.filter((s) => p.tasks.includes(s.id) && !p.done.includes(s.id))
      b.goal = todo.length && rand() < 0.5 ? todo[Math.floor(rand() * todo.length)] : STATIONS[Math.floor(rand() * STATIONS.length)]
    } else if (!b.target) {
      b.goal = STATIONS[Math.floor(rand() * STATIONS.length)]
    }
  }
  // Impostor: quando pode matar, persegue o tripulante mais isolado.
  if (p.role === 'impostor' && p.alive) {
    const crew = alive(g).filter((o) => g.players[o].role === 'crew')
    if (b.target && !g.players[b.target]?.alive) b.target = null
    if (!b.flee && !b.target && can.killIn < 4000 && crew.length) {
      const lonely = (o) => Math.min(...crew.filter((c) => c !== o).map((c) => dist(g.players[o], g.players[c])), 99)
      b.target = crew.sort((x, y) => lonely(y) - lonely(x))[0]
    }
    if (b.target && !b.flee) b.goal = { x: g.players[b.target].x, y: g.players[b.target].y }
  }
  if (!b.goal) b.goal = STATIONS[Math.floor(rand() * STATIONS.length)]
  p.dir = bfsStep(p, b.goal)
  if (!p.dir) b.goal = null
}

function botVote(g, id, rand) {
  const p = g.players[id]
  const others = alive(g).filter((o) => o !== id)
  if (p.role === 'impostor') {
    const crew = others.filter((o) => g.players[o].role === 'crew')
    return crew.length && rand() < 0.5 ? crew[Math.floor(rand() * crew.length)] : 'skip'
  }
  if (p.bot.suspect && g.players[p.bot.suspect]?.alive) return p.bot.suspect
  // segue o voto de alguém que já votou numa pessoa (às vezes)
  const named = Object.values(g.meeting.votes).filter((v) => v !== 'skip' && v !== id)
  if (named.length && rand() < 0.4) return named[Math.floor(rand() * named.length)]
  return 'skip'
}

// ---------- O tempo passa ----------
export function tick(game, now, rand = Math.random) {
  if (game.phase === 'over') return game
  const g = clone(game)
  let changed = false
  if (g.phase === 'roles' && now >= g.phaseEnds) {
    g.phase = 'play'
    g.phaseEnds = null
    changed = true
  } else if (g.phase === 'meeting') {
    // Os bots votam aos poucos, depois de dar tempo às pessoas para falarem
    // (ou logo que todas as pessoas tenham votado).
    const elapsed = now - (g.phaseEnds - g.cfg.meetingMs)
    const humansVoted = alive(g).every((o) => g.players[o].bot || g.meeting.votes[o])
    const botsMayVote = humansVoted || elapsed >= g.cfg.meetingMs * 0.35
    for (const id of g.order) {
      const p = g.players[id]
      if (botsMayVote && p.bot && p.alive && !g.meeting.votes[id] && rand() < 0.08) {
        g.meeting.votes[id] = botVote(g, id, rand)
        changed = true
      }
    }
    if (now >= g.phaseEnds || alive(g).every((o) => g.meeting.votes[o])) {
      endMeeting(g, now)
      changed = true
    }
  } else if (g.phase === 'eject' && now >= g.phaseEnds) {
    if (!checkWin(g, now)) resumePlay(g, now)
    changed = true
  } else if (g.phase === 'play') {
    // Estado de um bot que importa guardar (tarefas, espera, alvo, direção).
    const sig = (p) => `${p.dir}|${p.done.length}|${p.x},${p.y}|${p.vent}|${p.alive}|${p.killReady}|${JSON.stringify(p.bot)}`
    for (const id of g.order) {
      if (g.phase !== 'play') break
      const p = g.players[id]
      if (!p.bot) continue
      const before = sig(p)
      const bodies = g.bodies.length
      botPlay(g, id, now, rand)
      if (sig(p) !== before || g.bodies.length !== bodies || g.phase !== 'play') changed = true
    }
    if (g.phase === 'play') for (const id of g.order) if (tryMove(g, id, now)) changed = true
    if (checkWin(g, now)) changed = true
  }
  return changed ? g : game
}

export const impostorOnline = {
  minPlayers: 1,
  maxPlayers: 10,
  tick: true,
  tickMs: 60,
  broadcastMs: 90,
  start(players, action, now) {
    const humans = players.map((p) => p.id)
    const nBots = Math.max(4 - humans.length, 0, Math.min(10 - humans.length, Number(action.bots) || 0))
    const bots = Array.from({ length: nBots }, (_, i) => `bot${i}`)
    const pick = (v, list, def) => (list.includes(Number(v)) ? Number(v) * 1000 : def)
    const looks = Object.fromEntries(players.map((p) => [p.id, p.prefs || {}]))
    return startGame([...humans, ...bots], bots, now, Math.random, {
      killCooldown: pick(action.killCooldown, COOLDOWN_OPTIONS, KILL_COOLDOWN_MS),
      meetingMs: pick(action.meeting, MEETING_OPTIONS, MEETING_MS),
      looks,
    })
  },
  reduce(game, action, fromId, { now }) {
    if (action.type === 'tick') return tick(game, now)
    return applyAction(game, fromId, action, now)
  },
}
