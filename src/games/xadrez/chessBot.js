import { search, moveFrom, moveTo, movePromo } from './engine.js'

// Bot de xadrez: motor próprio (engine.js) com tempo limitado, por isso
// responde depressa mesmo no telemóvel. Cada nível pensa mais ou menos tempo.
const LEVELS = {
  facil: { timeMs: 150, maxDepth: 2, margin: 150 }, // escolhe ao acaso entre lances "razoáveis"
  medio: { timeMs: 400, maxDepth: 5, margin: 0 },
  dificil: { timeMs: 1200, maxDepth: 12, margin: 0 },
}
export const BOT_LEVELS = Object.keys(LEVELS)

export function chooseMove(fen, level = 'medio') {
  const cfg = LEVELS[level] || LEVELS.medio
  const ply = Number(fen.split(' ')[5] || 1) * 2
  // Variedade: no fácil, qualquer lance perto do melhor; nos outros, só nas
  // primeiras jogadas (para não abrir sempre da mesma maneira).
  const margin = cfg.margin || (ply <= 12 ? 15 : 0)
  const r = search(fen, { ...cfg, exact: margin > 0 })
  if (!r) return null
  let pick = r.move
  if (margin && r.scores.length > 1) {
    const best = r.scores[0][0]
    const near = r.scores.filter(([s]) => s >= best - margin).map(([, m]) => m)
    pick = near[Math.floor(Math.random() * near.length)]
  }
  return { from: moveFrom(pick), to: moveTo(pick), promotion: movePromo(pick) }
}
