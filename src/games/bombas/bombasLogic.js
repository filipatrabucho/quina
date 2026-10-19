// Bombas & Companhia: arena 2D com bombas (estilo Bomberman).
// Lógica pura: corre no anfitrião da sala (ou no browser, contra bots).
// O estado é pequeno para poder ser enviado várias vezes por segundo.

export const W = 13
export const H = 11
export const FUSE_MS = 2400
export const FLAME_MS = 550
export const ROUND_MS = 180000
// Morte súbita: a partir daqui caem blocos em espiral e a arena fecha.
export const SUDDEN_MS = 120000
export const DROP_MS = 600
export const STEP_MS = [190, 160, 135, 115] // por nível de velocidade
export const MAX = { bombs: 6, range: 7, speed: STEP_MS.length - 1 }
export const COLORS = ['#EF3E4A', '#2F80ED', '#2FBF71', '#F2B53B']
const SPAWNS = [
  [1, 1],
  [W - 2, H - 2],
  [W - 2, 1],
  [1, H - 2],
]
const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }
const CRATE_CHANCE = 0.7
const POWER_CHANCE = 0.32
export const POWERS = ['b', 'r', 's']

export const idx = (x, y) => y * W + x

// Ordem em que os blocos caem na morte súbita: em espiral, de fora para dentro.
const SPIRAL = (() => {
  const out = []
  let [x0, y0, x1, y1] = [1, 1, W - 2, H - 2]
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push([x, y0])
    for (let y = y0 + 1; y <= y1; y++) out.push([x1, y])
    if (y0 < y1) for (let x = x1 - 1; x >= x0; x--) out.push([x, y1])
    if (x0 < x1) for (let y = y1 - 1; y > y0; y--) out.push([x0, y])
    x0++, y0++, x1--, y1--
  }
  return out.filter(([x, y]) => !(x % 2 === 0 && y % 2 === 0))
})()
const isHard = (x, y) => x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x % 2 === 0 && y % 2 === 0)

function makeGrid() {
  const safe = new Set()
  for (const [sx, sy] of SPAWNS) {
    safe.add(idx(sx, sy))
    for (const [dx, dy] of Object.values(DIRS)) safe.add(idx(sx + dx, sy + dy))
  }
  const cells = []
  const hidden = {}
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y)
      if (isHard(x, y)) cells.push('#')
      else if (!safe.has(i) && Math.random() < CRATE_CHANCE) {
        cells.push('+')
        if (Math.random() < POWER_CHANCE) hidden[i] = POWERS[Math.floor(Math.random() * POWERS.length)]
      } else cells.push('.')
    }
  }
  return { grid: cells.join(''), hidden }
}

function newRound(ids, bots, score, round, now) {
  const { grid, hidden } = makeGrid()
  const players = {}
  ids.forEach((id, i) => {
    const [x, y] = SPAWNS[i]
    players[id] = { x, y, alive: true, bombs: 1, range: 2, speed: 0, dir: null, next: 0, color: i, bot: bots.includes(id) }
  })
  return {
    round,
    order: ids,
    grid,
    hidden,
    powers: {},
    players,
    bombs: [],
    flames: [],
    nextBomb: 1,
    startedAt: now,
    suddenAt: now + SUDDEN_MS,
    dropped: 0,
    endsAt: now + ROUND_MS,
    over: false,
    winner: null,
    score,
  }
}

export const BOT_NAMES = ['Bot Rita', 'Bot Zé', 'Bot Inês']

export function startGame(ids, bots = [], now = Date.now()) {
  const score = Object.fromEntries(ids.map((id) => [id, 0]))
  return newRound(ids, bots, score, 1, now)
}

export function nextRound(game, now = Date.now()) {
  const bots = game.order.filter((id) => game.players[id].bot)
  return newRound(game.order, bots, game.score, game.round + 1, now)
}

const bombAt = (g, x, y) => g.bombs.find((b) => b.x === x && b.y === y)
export const flameAt = (g, x, y) => g.flames.some((f) => f.x === x && f.y === y)
const cellAt = (g, x, y) => (x < 0 || y < 0 || x >= W || y >= H ? '#' : g.grid[idx(x, y)])
export const stepMs = (p) => STEP_MS[p.speed] ?? STEP_MS[0]

function canEnter(g, x, y) {
  return cellAt(g, x, y) === '.' && !bombAt(g, x, y)
}

function clone(g) {
  return {
    ...g,
    players: Object.fromEntries(Object.entries(g.players).map(([id, p]) => [id, { ...p }])),
    bombs: g.bombs.map((b) => ({ ...b })),
    flames: g.flames.slice(),
    powers: { ...g.powers },
    hidden: { ...g.hidden },
  }
}

function tryMove(g, id, now) {
  const p = g.players[id]
  if (!p.alive || !p.dir || now < p.next) return false
  const [dx, dy] = DIRS[p.dir]
  const nx = p.x + dx
  const ny = p.y + dy
  if (!canEnter(g, nx, ny)) return false
  p.x = nx
  p.y = ny
  p.next = now + stepMs(p)
  const k = idx(nx, ny)
  const pw = g.powers[k]
  if (pw) {
    if (pw === 'b') p.bombs = Math.min(MAX.bombs, p.bombs + 1)
    if (pw === 'r') p.range = Math.min(MAX.range, p.range + 1)
    if (pw === 's') p.speed = Math.min(MAX.speed, p.speed + 1)
    delete g.powers[k]
  }
  return true
}

function placeBomb(g, id, now) {
  const p = g.players[id]
  if (!p?.alive || g.over) return false
  if (bombAt(g, p.x, p.y)) return false
  if (g.bombs.filter((b) => b.owner === id).length >= p.bombs) return false
  g.bombs.push({ id: g.nextBomb++, x: p.x, y: p.y, owner: id, at: now + FUSE_MS, range: p.range })
  return true
}

// Células atingidas por uma bomba (para a explosão e para os bots).
export function blastCells(g, b) {
  const out = [[b.x, b.y]]
  for (const [dx, dy] of Object.values(DIRS)) {
    for (let k = 1; k <= b.range; k++) {
      const x = b.x + dx * k
      const y = b.y + dy * k
      const c = cellAt(g, x, y)
      if (c === '#') break
      out.push([x, y])
      if (c === '+' || bombAt(g, x, y)) break
    }
  }
  return out
}

function explode(g, now) {
  const due = g.bombs.filter((b) => b.at <= now)
  if (!due.length) return false
  const grid = g.grid.split('')
  const revealed = []
  const queue = [...due]
  const done = new Set()
  while (queue.length) {
    const b = queue.shift()
    if (done.has(b.id)) continue
    done.add(b.id)
    for (const [x, y] of blastCells(g, b)) {
      const k = idx(x, y)
      if (grid[k] === '+') {
        grid[k] = '.'
        if (g.hidden[k]) revealed.push([k, g.hidden[k]])
      } else if (g.powers[k]) {
        delete g.powers[k]
      }
      if (!g.flames.some((f) => f.x === x && f.y === y)) g.flames.push({ x, y, until: now + FLAME_MS })
      else g.flames = g.flames.map((f) => (f.x === x && f.y === y ? { ...f, until: now + FLAME_MS } : f))
      const chained = g.bombs.find((o) => o.x === x && o.y === y && !done.has(o.id))
      if (chained) queue.push(chained)
    }
  }
  g.bombs = g.bombs.filter((b) => !done.has(b.id))
  g.grid = grid.join('')
  for (const [k, pw] of revealed) {
    g.powers[k] = pw
    delete g.hidden[k]
  }
  return true
}

function dropBlocks(g, now) {
  if (now < g.suddenAt) return false
  const due = Math.min(SPIRAL.length, Math.floor((now - g.suddenAt) / DROP_MS) + 1)
  if (due <= g.dropped) return false
  const grid = g.grid.split('')
  for (let i = g.dropped; i < due; i++) {
    const [x, y] = SPIRAL[i]
    const k = idx(x, y)
    grid[k] = '#'
    delete g.powers[k]
    delete g.hidden[k]
    g.bombs = g.bombs.filter((b) => b.x !== x || b.y !== y)
    for (const p of Object.values(g.players)) {
      if (p.alive && p.x === x && p.y === y) {
        p.alive = false
        p.dir = null
      }
    }
  }
  g.grid = grid.join('')
  g.dropped = due
  return true
}

function burnPlayers(g) {
  let changed = false
  for (const p of Object.values(g.players)) {
    if (p.alive && flameAt(g, p.x, p.y)) {
      p.alive = false
      p.dir = null
      changed = true
    }
  }
  return changed
}

function checkEnd(g, now) {
  if (g.over) return
  const alive = g.order.filter((id) => g.players[id].alive)
  if (alive.length <= 1 || now >= g.endsAt) {
    g.over = true
    g.winner = alive.length === 1 ? alive[0] : 'draw'
    if (alive.length === 1) g.score = { ...g.score, [alive[0]]: (g.score[alive[0]] || 0) + 1 }
    for (const p of Object.values(g.players)) p.dir = null
  }
}

// ---------- Bots ----------
// Quando é que cada casa arde: [início, fim], com as reações em cadeia.
function dangerTimes(g, now, extra = null) {
  const bombs = (extra ? [...g.bombs, extra] : g.bombs).map((b) => ({ ...b }))
  for (let pass = 0; pass < bombs.length; pass++) {
    let changed = false
    for (const b of bombs) {
      for (const o of bombs) {
        if (o === b || o.at <= b.at) continue
        if (blastCells(g, b).some(([x, y]) => x === o.x && y === o.y)) {
          o.at = b.at
          changed = true
        }
      }
    }
    if (!changed) break
  }
  const t = new Map()
  const add = (k, from, to) => {
    const cur = t.get(k)
    t.set(k, cur ? [Math.min(cur[0], from), Math.max(cur[1], to)] : [from, to])
  }
  for (const f of g.flames) add(idx(f.x, f.y), now, f.until)
  for (const b of bombs) for (const [x, y] of blastCells(g, b)) add(idx(x, y), b.at, b.at + FLAME_MS)
  // Na morte súbita, as próximas casas da espiral também são perigosas.
  if (now >= g.suddenAt - 3000) {
    for (let i = g.dropped; i < Math.min(SPIRAL.length, g.dropped + 8); i++) {
      const [x, y] = SPIRAL[i]
      add(idx(x, y), g.suddenAt + i * DROP_MS, Infinity)
    }
  }
  return t
}

// Procura em largura; devolve a primeira direção do caminho até à casa mais
// próxima que cumpra `goal`. `ok(x, y, passos)` diz se dá para lá passar.
function bfs(g, x, y, goal, ok, maxDepth = 40) {
  const seen = new Set([idx(x, y)])
  const queue = [[x, y, null, 0]]
  while (queue.length) {
    const [cx, cy, first, d] = queue.shift()
    if (d > 0 && goal(cx, cy)) return first
    if (d >= maxDepth) continue
    for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
      const nx = cx + dx
      const ny = cy + dy
      const k = idx(nx, ny)
      if (seen.has(k) || !canEnter(g, nx, ny) || !ok(nx, ny, d + 1)) continue
      seen.add(k)
      queue.push([nx, ny, first || dir, d + 1])
    }
  }
  return null
}

const enemyNear = (g, id, cells) =>
  g.order.some((o) => o !== id && g.players[o].alive && cells.some(([x, y]) => g.players[o].x === x && g.players[o].y === y))

// Caminho para uma casa segura que não passe por casas que ardem quando lá estiver.
function escapeDir(g, p, times, now, maxDepth) {
  const step = stepMs(p) + 60
  const passable = (x, y, steps) => {
    const span = times.get(idx(x, y))
    if (!span) return true
    const arrive = now + steps * step
    // Passa antes de arder (com folga para sair dela) ou depois de apagar.
    return arrive + step < span[0] - 150 || arrive > span[1] + 100
  }
  return bfs(g, p.x, p.y, (x, y) => !times.has(idx(x, y)), passable, maxDepth)
}

function botThink(g, id, now) {
  const p = g.players[id]
  if (!p.alive || now < p.next) return
  const here = idx(p.x, p.y)
  const times = dangerTimes(g, now)

  // 1. Fugir se a casa onde está vai arder.
  if (times.has(here)) {
    p.dir = escapeDir(g, p, times, now, 14)
    return
  }
  // 2. Pôr bomba se der jeito (caixa ou adversário ao alcance) e houver fuga.
  const mine = g.bombs.filter((b) => b.owner === id).length
  if (mine < p.bombs && !bombAt(g, p.x, p.y)) {
    const test = { id: -1, x: p.x, y: p.y, range: p.range, owner: id, at: now + FUSE_MS }
    const cells = blastCells(g, test)
    const hitsCrate = cells.some(([x, y]) => cellAt(g, x, y) === '+')
    if ((hitsCrate || enemyNear(g, id, cells)) && Math.random() < 0.85) {
      const escape = escapeDir(g, p, dangerTimes(g, now, test), now, 8)
      if (escape) {
        placeBomb(g, id, now)
        p.dir = escape
        return
      }
    }
  }
  // 3. Ir buscar prémios, depois caixas ou adversários, sem entrar em casas perigosas.
  const safe = (x, y) => !times.has(idx(x, y))
  const target =
    bfs(g, p.x, p.y, (x, y) => !!g.powers[idx(x, y)], safe, 10) ||
    bfs(g, p.x, p.y, (x, y) => Object.values(DIRS).some(([dx, dy]) => cellAt(g, x + dx, y + dy) === '+'), safe) ||
    bfs(g, p.x, p.y, (x, y) => g.order.some((o) => o !== id && g.players[o].alive && Math.abs(g.players[o].x - x) + Math.abs(g.players[o].y - y) <= 1), safe)
  if (target && Math.random() < 0.9) {
    p.dir = target
    return
  }
  // 4. Andar um pouco ao calhas (sem se meter em perigo).
  const options = Object.entries(DIRS).filter(([, [dx, dy]]) => canEnter(g, p.x + dx, p.y + dy) && safe(p.x + dx, p.y + dy))
  p.dir = options.length && Math.random() < 0.5 ? options[Math.floor(Math.random() * options.length)][0] : null
}

// ---------- Avanço do tempo ----------
export function advance(game, now) {
  if (game.over) return game
  const g = clone(game)
  let changed = false
  const bombsBefore = g.bombs.length
  for (const id of g.order) if (g.players[id].bot) botThink(g, id, now)
  if (g.bombs.length !== bombsBefore) changed = true
  for (const id of g.order) if (tryMove(g, id, now)) changed = true
  if (dropBlocks(g, now)) changed = true
  if (explode(g, now)) changed = true
  const before = g.flames.length
  g.flames = g.flames.filter((f) => f.until > now)
  if (g.flames.length !== before) changed = true
  if (burnPlayers(g)) changed = true
  const wasOver = g.over
  checkEnd(g, now)
  if (g.over !== wasOver) changed = true
  // As mudanças de direção dos bots só contam se mexerem em algo visível.
  return changed ? g : game
}

export function applyInput(game, id, action, now) {
  const p = game.players[id]
  if (!p || game.over) return game
  if (action.type === 'dir') {
    const dir = action.dir && DIRS[action.dir] ? action.dir : null
    if (p.dir === dir) return game
    const g = clone(game)
    g.players[id].dir = dir
    // Responde logo ao carregar na tecla (sem esperar pelo próximo tick).
    tryMove(g, id, now)
    burnPlayers(g)
    checkEnd(g, now)
    return g
  }
  if (action.type === 'bomb') {
    const g = clone(game)
    return placeBomb(g, id, now) ? g : game
  }
  return game
}

// ---------- Sala online ----------
export const bombasOnline = {
  minPlayers: 1,
  maxPlayers: 4,
  tickMs: 100,
  broadcastMs: 90,
  tick: true,
  start(players, action, now) {
    const humans = players.map((p) => p.id)
    const nBots = Math.max(0, Math.min(4 - humans.length, Number(action.bots) || 0))
    if (humans.length + nBots < 2) throw new Error('Junta mais um jogador ou adiciona um bot.')
    const bots = Array.from({ length: nBots }, (_, i) => `bot${i}`)
    return startGame([...humans, ...bots], bots, now)
  },
  reduce(game, action, fromId, { now }) {
    if (action.type === 'tick') return advance(game, now)
    if (action.type === 'rematch') return game.over ? nextRound(game, now) : game
    return applyInput(game, fromId, action, now)
  },
}
