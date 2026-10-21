// Spider: 104 cartas (2 baralhos) em 10 colunas; o resto (50) sai do monte,
// 10 de cada vez. Desce-se por qualquer naipe, mas só se mudam juntas as
// sequências do mesmo naipe. Uma sequência completa do Rei ao Ás (mesmo naipe)
// sai da mesa; ganha-se com as 8. Pode-se jogar com 1, 2 ou 4 naipes.
export { rankLabel, isRed } from './freecellLogic.js'

const SUIT_SETS = { 1: ['s'], 2: ['s', 'h'], 4: ['s', 'h', 'd', 'c'] }

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function deal(n, suits = 1) {
  const set = SUIT_SETS[suits] || SUIT_SETS[1]
  const cards = []
  let id = 0
  for (let copy = 0; copy < 8 / set.length; copy++) for (const suit of set) for (let rank = 1; rank <= 13; rank++) cards.push({ id: id++, rank, suit, up: false })
  const rand = mulberry32(n * 7919 + suits)
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  const cols = Array.from({ length: 10 }, (_, i) => cards.splice(0, i < 4 ? 6 : 5))
  for (const col of cols) col[col.length - 1].up = true
  return { n, suits, cols, stock: cards, done: 0, moves: 0, history: [] }
}

export const won = (g) => g.done === 8

// Sequência do mesmo naipe a descer, de `from` até ao fim da coluna.
export function isRun(col, from) {
  if (!col[from]?.up) return false
  for (let i = from; i < col.length - 1; i++) {
    const a = col[i]
    const b = col[i + 1]
    if (b.suit !== a.suit || b.rank !== a.rank - 1) return false
  }
  return true
}

const clone = (g) => ({ ...g, cols: g.cols.map((c) => c.map((x) => ({ ...x }))), stock: g.stock.map((x) => ({ ...x })) })
const snapshot = (g) => ({ cols: g.cols.map((c) => c.map((x) => ({ ...x }))), stock: g.stock.map((x) => ({ ...x })), done: g.done, moves: g.moves })

export function canMove(g, from, to) {
  if (from.col === to.col) return false
  const col = g.cols[from.col]
  if (!isRun(col, from.index)) return false
  const dest = g.cols[to.col]
  const top = dest[dest.length - 1]
  return !top || top.rank === col[from.index].rank + 1
}

// Tira as sequências completas (Rei ao Ás) e vira as cartas que ficam por cima.
function tidy(g) {
  for (let i = 0; i < g.cols.length; i++) {
    const col = g.cols[i]
    if (col.length >= 13) {
      const k = col.length - 13
      if (col[k].rank === 13 && isRun(col, k)) {
        g.cols[i] = col.slice(0, k)
        g.done += 1
      }
    }
    const c = g.cols[i]
    if (c.length && !c[c.length - 1].up) c[c.length - 1].up = true
  }
  return g
}

export function move(game, from, to) {
  if (!canMove(game, from, to)) return null
  const g = clone(game)
  g.history = [...game.history, snapshot(game)].slice(-200)
  const cards = g.cols[from.col].slice(from.index)
  g.cols[from.col] = g.cols[from.col].slice(0, from.index)
  g.cols[to.col] = [...g.cols[to.col], ...cards]
  g.moves = game.moves + 1
  return tidy(g)
}

// Dar mais 10 cartas: só com todas as colunas com cartas.
export function canDealStock(g) {
  return g.stock.length > 0 && g.cols.every((c) => c.length > 0)
}

export function dealStock(game) {
  if (!canDealStock(game)) return null
  const g = clone(game)
  g.history = [...game.history, snapshot(game)].slice(-200)
  for (let i = 0; i < 10; i++) {
    const c = g.stock.pop()
    c.up = true
    g.cols[i].push(c)
  }
  g.moves = game.moves + 1
  return tidy(g)
}

export function undo(g) {
  if (!g.history.length) return g
  const prev = g.history[g.history.length - 1]
  return { ...g, ...prev, history: g.history.slice(0, -1) }
}

// Melhor destino: carta do mesmo naipe, depois qualquer naipe, depois coluna vazia.
export function bestMove(g, from) {
  const card = g.cols[from.col][from.index]
  const order = []
  g.cols.forEach((c, i) => {
    if (i === from.col || !c.length) return
    const top = c[c.length - 1]
    if (top.rank === card.rank + 1) order.push({ col: i, w: top.suit === card.suit ? 0 : 1 })
  })
  g.cols.forEach((c, i) => i !== from.col && !c.length && from.index > 0 && order.push({ col: i, w: 2 }))
  order.sort((a, b) => a.w - b.w)
  const to = order.find((o) => canMove(g, from, o))
  return to ? { col: to.col } : null
}
