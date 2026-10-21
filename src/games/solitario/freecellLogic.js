// FreeCell: 52 cartas em 8 colunas, 4 células livres e 4 fundações (do Ás ao
// Rei, por naipe). Nas colunas, desce-se alternando cores. As distribuições
// são as do FreeCell clássico do Windows: o "Jogo #N" é sempre o mesmo.
export const RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }
export const rankLabel = (r) => RANK_LABEL[r] || String(r)
export const isRed = (c) => c.suit === 'h' || c.suit === 'd'
const MS_SUITS = ['c', 'd', 'h', 's'] // ordem do baralho do Windows
export const FOUNDATION_SUITS = ['s', 'h', 'd', 'c']

export function deal(n) {
  let state = n >>> 0
  const rng = () => {
    state = (state * 214013 + 2531011) & 0x7fffffff
    return state >>> 16
  }
  const cards = Array.from({ length: 52 }, (_, i) => ({ id: i, rank: Math.floor(i / 4) + 1, suit: MS_SUITS[i % 4] }))
  const cols = Array.from({ length: 8 }, () => [])
  for (let i = 0; i < 52; i++) {
    const j = rng() % cards.length
    cols[i % 8].push(cards[j])
    cards[j] = cards[cards.length - 1]
    cards.pop()
  }
  return { n, cols, cells: [null, null, null, null], found: { s: 0, h: 0, d: 0, c: 0 }, moves: 0, history: [] }
}

export const won = (g) => FOUNDATION_SUITS.every((s) => g.found[s] === 13)

// Pode pôr `card` em cima de `onto` numa coluna?
const stacks = (card, onto) => !onto || (onto.rank === card.rank + 1 && isRed(onto) !== isRed(card))

// Sequência válida (cores alternadas, a descer) a partir de `from` até ao fim.
export function isRun(col, from) {
  for (let i = from; i < col.length - 1; i++) if (!stacks(col[i + 1], col[i])) return false
  return true
}

// Máximo de cartas que se podem mudar de uma vez (com as células e colunas vazias).
export function maxMove(g, toEmpty) {
  const free = g.cells.filter((c) => !c).length
  const empty = g.cols.filter((c) => !c.length).length - (toEmpty ? 1 : 0)
  return (free + 1) * 2 ** Math.max(0, empty)
}

const clone = (g) => ({ ...g, cols: g.cols.map((c) => c.slice()), cells: g.cells.slice(), found: { ...g.found } })
const snapshot = (g) => ({ cols: g.cols.map((c) => c.slice()), cells: g.cells.slice(), found: { ...g.found }, moves: g.moves })

// Origem: { col, index } ou { cell }. Destino: { col } | { cell } | { found: true }.
export function cardsAt(g, from) {
  if (from.cell != null) return g.cells[from.cell] ? [g.cells[from.cell]] : []
  return g.cols[from.col].slice(from.index)
}

export function canMove(g, from, to) {
  const cards = cardsAt(g, from)
  if (!cards.length) return false
  if (from.col != null && !isRun(g.cols[from.col], from.index)) return false
  if (to.found) {
    if (cards.length !== 1) return false
    return g.found[cards[0].suit] === cards[0].rank - 1
  }
  if (to.cell != null) return cards.length === 1 && !g.cells[to.cell]
  if (to.col != null) {
    if (from.col === to.col) return false
    const dest = g.cols[to.col]
    const top = dest[dest.length - 1]
    if (!stacks(cards[0], top)) return false
    return cards.length <= maxMove(g, !dest.length)
  }
  return false
}

export function move(game, from, to) {
  if (!canMove(game, from, to)) return null
  const g = clone(game)
  g.history = [...game.history, snapshot(game)].slice(-200)
  const cards = cardsAt(game, from)
  if (from.cell != null) g.cells[from.cell] = null
  else g.cols[from.col] = g.cols[from.col].slice(0, from.index)
  if (to.found) g.found[cards[0].suit] = cards[0].rank
  else if (to.cell != null) g.cells[to.cell] = cards[0]
  else g.cols[to.col] = [...g.cols[to.col], ...cards]
  g.moves = game.moves + 1
  return autoFoundation(g)
}

export function undo(g) {
  if (!g.history.length) return g
  const prev = g.history[g.history.length - 1]
  return { ...g, ...prev, history: g.history.slice(0, -1) }
}

// Sobe para as fundações as cartas que já não fazem falta (seguro: as de cor
// contrária com um a menos já lá estão).
function safe(g, card) {
  if (g.found[card.suit] !== card.rank - 1) return false
  if (card.rank <= 2) return true
  const opp = isRed(card) ? ['s', 'c'] : ['h', 'd']
  return opp.every((s) => g.found[s] >= card.rank - 1)
}

export function autoFoundation(g) {
  let moved = true
  while (moved) {
    moved = false
    for (let i = 0; i < 4; i++) {
      const c = g.cells[i]
      if (c && safe(g, c)) {
        g.cells[i] = null
        g.found[c.suit] = c.rank
        moved = true
      }
    }
    for (let i = 0; i < 8; i++) {
      const col = g.cols[i]
      const c = col[col.length - 1]
      if (c && safe(g, c)) {
        g.cols[i] = col.slice(0, -1)
        g.found[c.suit] = c.rank
        moved = true
      }
    }
  }
  return g
}

// Melhor destino ao tocar duas vezes numa carta: fundação, outra coluna com
// cartas, coluna vazia, célula livre.
export function bestMove(g, from) {
  const cands = [{ found: true }]
  const cols = g.cols.map((c, i) => i).filter((i) => i !== from.col)
  for (const i of cols) if (g.cols[i].length) cands.push({ col: i })
  for (const i of cols) if (!g.cols[i].length) cands.push({ col: i })
  if (from.cell == null) g.cells.forEach((c, i) => !c && cands.push({ cell: i }))
  return cands.find((to) => canMove(g, from, to)) || null
}
