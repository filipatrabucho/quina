// Avaliação de mãos de Poker (melhor mão de 5 entre 5 a 7 cartas).
export const RANK_VALUE = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13, A: 14 }
export const CATEGORY_NAME = ['Carta alta', 'Par', 'Dois pares', 'Trio', 'Sequência', 'Cor', 'Full house', 'Póquer', 'Sequência de cor']
const VALUE_NAME = { 2: 'dois', 3: 'três', 4: 'quatros', 5: 'cincos', 6: 'seis', 7: 'setes', 8: 'oitos', 9: 'noves', 10: 'dez', 11: 'valetes', 12: 'damas', 13: 'reis', 14: 'ases' }

// Valor de exatamente 5 cartas: [categoria, desempates...] (comparável).
function eval5(cards) {
  const vals = cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a)
  const flush = cards.every((c) => c.suit === cards[0].suit)
  const uniq = [...new Set(vals)]
  let straightHigh = 0
  if (uniq.length === 5) {
    if (vals[0] - vals[4] === 4) straightHigh = vals[0]
    else if (vals[0] === 14 && vals[1] === 5) straightHigh = 5 // A-2-3-4-5
  }
  const counts = {}
  for (const v of vals) counts[v] = (counts[v] || 0) + 1
  // grupos ordenados por tamanho e depois por valor
  const groups = Object.entries(counts).map(([v, n]) => [n, Number(v)]).sort((a, b) => b[0] - a[0] || b[1] - a[1])
  const byGroup = groups.map((g) => g[1])
  if (straightHigh && flush) return [8, straightHigh]
  if (groups[0][0] === 4) return [7, ...byGroup]
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, ...byGroup]
  if (flush) return [5, ...vals]
  if (straightHigh) return [4, straightHigh]
  if (groups[0][0] === 3) return [3, ...byGroup]
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, ...byGroup]
  if (groups[0][0] === 2) return [1, ...byGroup]
  return [0, ...vals]
}

export function compareScores(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0)
    if (d) return d
  }
  return 0
}

// Melhor mão entre 5 e 7 cartas: { score, cards (as 5 usadas) }.
export function bestHand(cards) {
  let best = null
  const n = cards.length
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const five = [cards[a], cards[b], cards[c], cards[d], cards[e]]
            const score = eval5(five)
            if (!best || compareScores(score, best.score) > 0) best = { score, cards: five }
          }
  return best
}

export function handName(score) {
  const [cat, a, b] = score
  switch (cat) {
    case 1: return `Par de ${VALUE_NAME[a]}`
    case 2: return `Dois pares, ${VALUE_NAME[a]} e ${VALUE_NAME[b]}`
    case 3: return `Trio de ${VALUE_NAME[a]}`
    case 7: return `Póquer de ${VALUE_NAME[a]}`
    case 6: return `Full house, ${VALUE_NAME[a]} e ${VALUE_NAME[b]}`
    case 8: return a === 14 ? 'Sequência de cor real' : 'Sequência de cor'
    default: return CATEGORY_NAME[cat]
  }
}
