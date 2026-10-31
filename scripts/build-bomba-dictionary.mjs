// Corre isto UMA VEZ (com ligação à internet):
//   node scripts/build-bomba-dictionary.mjs
//
// Gera o dicionário da Bomba de Palavras a partir do mesmo léxico português
// das Palavras (fserb/pt-br, licença MIT), mas com palavras de todos os
// tamanhos (3 a 15 letras):
//   - public/palavras-pt.txt  (uma palavra por linha, sem acentos, carregado só no jogo)
//   - src/games/bombapalavras/syllables.js  (sílabas por dificuldade)
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const LEXICO_URL = 'https://raw.githubusercontent.com/fserb/pt-br/master/lexico'
const plain = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '')

const res = await fetch(LEXICO_URL)
if (!res.ok) throw new Error(`Falha ao descarregar (status ${res.status})`)
const words = new Set()
for (const raw of (await res.text()).split('\n')) {
  const w = plain(raw.trim().toLowerCase())
  if (w.length >= 3 && w.length <= 15 && /^[a-z]+$/.test(w)) words.add(w)
}
const sorted = [...words].sort()
writeFileSync(fileURLToPath(new URL('../public/palavras-pt.txt', import.meta.url)), sorted.join('\n'))

// Sílabas (2 ou 3 letras) e em quantas palavras aparecem.
const count = new Map()
for (const w of sorted) {
  const seen = new Set()
  for (const n of [2, 3]) for (let i = 0; i + n <= w.length; i++) seen.add(w.slice(i, i + n))
  for (const s of seen) count.set(s, (count.get(s) || 0) + 1)
}
const pick = (min, max, len) => [...count].filter(([s, c]) => s.length === len && c >= min && c < max).map(([s]) => s).sort()
const tiers = {
  facil: [...pick(3000, Infinity, 2), ...pick(2500, Infinity, 3)],
  medio: [...pick(800, 3000, 2), ...pick(700, 2500, 3)],
  dificil: [...pick(350, 800, 2), ...pick(300, 700, 3)],
}
const out = `// Gerado por scripts/build-bomba-dictionary.mjs (não editar à mão).
// Sílabas por dificuldade: em quantas palavras do dicionário aparecem.
export const SYLLABLES = ${JSON.stringify(tiers, null, 0)}
`
writeFileSync(fileURLToPath(new URL('../src/games/bombapalavras/syllables.js', import.meta.url)), out)
console.log(`${sorted.length} palavras; sílabas: fácil ${tiers.facil.length}, médio ${tiers.medio.length}, difícil ${tiers.dificil.length}`)
