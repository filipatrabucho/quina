// Tabuleiro fixo da ilha: 19 hexágonos (raio 2), com os vértices e as
// arestas calculados uma vez. Hexágonos "pointy-top", tamanho 1.
const SQ3 = Math.sqrt(3)

export const HEXES = []
for (let r = -2; r <= 2; r++) {
  for (let q = -2; q <= 2; q++) {
    if (Math.abs(q + r) <= 2) HEXES.push({ q, r, x: SQ3 * (q + r / 2), y: 1.5 * r })
  }
}

export const VERTICES = [] // { x, y, hexes: [], adj: [], edges: [] }
export const EDGES = [] // { a, b, hexes: [], x, y }
const vKey = new Map()
const eKey = new Map()

HEXES.forEach((h, hi) => {
  h.vertices = []
  for (let k = 0; k < 6; k++) {
    const ang = ((60 * k - 90) * Math.PI) / 180
    const x = h.x + Math.cos(ang)
    const y = h.y + Math.sin(ang)
    const key = `${Math.round(x * 1000)},${Math.round(y * 1000)}`
    if (!vKey.has(key)) {
      vKey.set(key, VERTICES.length)
      VERTICES.push({ x, y, hexes: [], adj: [], edges: [] })
    }
    const vi = vKey.get(key)
    VERTICES[vi].hexes.push(hi)
    h.vertices.push(vi)
  }
  h.edges = []
  for (let k = 0; k < 6; k++) {
    const a = h.vertices[k]
    const b = h.vertices[(k + 1) % 6]
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    if (!eKey.has(key)) {
      eKey.set(key, EDGES.length)
      EDGES.push({ a: Math.min(a, b), b: Math.max(a, b), hexes: [], x: (VERTICES[a].x + VERTICES[b].x) / 2, y: (VERTICES[a].y + VERTICES[b].y) / 2 })
    }
    const ei = eKey.get(key)
    EDGES[ei].hexes.push(hi)
    h.edges.push(ei)
  }
})
VERTICES.forEach((v) => {
  v.adj = []
  v.edges = []
})
EDGES.forEach((e, ei) => {
  VERTICES[e.a].adj.push(e.b)
  VERTICES[e.b].adj.push(e.a)
  VERTICES[e.a].edges.push(ei)
  VERTICES[e.b].edges.push(ei)
})

export const hexNeighbors = (hi) => {
  const { q, r } = HEXES[hi]
  return [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]]
    .map(([dq, dr]) => HEXES.findIndex((h) => h.q === q + dq && h.r === r + dr))
    .filter((i) => i >= 0)
}

export const edgeBetween = (a, b) => VERTICES[a].edges.find((ei) => EDGES[ei].a === Math.min(a, b) && EDGES[ei].b === Math.max(a, b))

// As 30 arestas da costa, por ordem à volta da ilha.
export const COAST = EDGES.map((e, i) => i)
  .filter((i) => EDGES[i].hexes.length === 1)
  .sort((i, j) => Math.atan2(EDGES[i].y, EDGES[i].x) - Math.atan2(EDGES[j].y, EDGES[j].x))

// 9 portos espalhados pela costa (espaçamento 3,3,4 como no tabuleiro original).
export const PORT_EDGES = (() => {
  const gaps = [3, 3, 4, 3, 3, 4, 3, 3, 4]
  const out = []
  let i = 0
  for (const g of gaps) {
    out.push(COAST[i])
    i += g
  }
  return out
})()
