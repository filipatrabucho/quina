export const GRID_SIZE = 4
export const MIN_VALUE = 1
export const MAX_VALUE = 20
const DIAGONAL_INDICES = [0, 5, 10, 15] // topo-esquerda a baixo-direita, num tabuleiro 4x4

// PRNG simples e determinístico (mulberry32) — mesmo dia = mesmo baralho
// para toda a gente, sem precisar de servidor.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFromDate(date) {
  const key = `${date.getFullYear()}${date.getMonth()}${date.getDate()}`
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  return hash
}

export function getTodayKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

// Baralho do dia: valores de MIN_VALUE a MAX_VALUE, baralhados de forma
// determinística (mesmo dia = mesma ordem para toda a gente).
export function getTodayDeck(date = new Date()) {
  const rand = mulberry32(seedFromDate(date))
  const values = []
  for (let v = MIN_VALUE; v <= MAX_VALUE; v++) values.push(v)
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  return values
}

// Baralho aleatório (não determinístico) — usado nas partidas multiplayer.
// O tamanho é configurável porque, com vários jogadores, cada um precisa de
// 16 azulejos para o seu próprio painel — o baralho tem de ter tiles
// suficientes para todos, não só para um jogador.
export function generateRandomDeck(size = MAX_VALUE) {
  const values = []
  for (let v = MIN_VALUE; v <= size; v++) values.push(v)
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  return values
}

// Verifica se `value` pode ser colocado na posição `index` da grelha,
// respeitando ordem crescente estrita em toda a linha e coluna (ignorando
// casas ainda vazias).
export function isValidPlacement(cells, index, value) {
  const row = Math.floor(index / GRID_SIZE)
  const col = index % GRID_SIZE

  for (let c = 0; c < GRID_SIZE; c++) {
    if (c === col) continue
    const other = cells[row * GRID_SIZE + c]
    if (other == null) continue
    if (c < col && other >= value) return false
    if (c > col && other <= value) return false
  }

  for (let r = 0; r < GRID_SIZE; r++) {
    if (r === row) continue
    const other = cells[r * GRID_SIZE + col]
    if (other == null) continue
    if (r < row && other >= value) return false
    if (r > row && other <= value) return false
  }

  return true
}

export function isBoardFull(cells) {
  return cells.every((c) => c != null)
}

// Configuração inicial oficial: cada jogador começa com 4 azulejos já
// colocados na diagonal do seu painel, tirados ao acaso e ordenados de
// forma crescente. `deck` já deve vir baralhado — usa os primeiros 4.
export function buildInitialSetup(deck) {
  const diagValues = deck.slice(0, 4).sort((a, b) => a - b)
  const cells = Array(GRID_SIZE * GRID_SIZE).fill(null)
  DIAGONAL_INDICES.forEach((idx, i) => {
    cells[idx] = diagValues[i]
  })
  return { cells, drawIndex: 4 }
}