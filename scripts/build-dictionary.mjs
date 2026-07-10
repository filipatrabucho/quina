// Corre isto UMA VEZ (com a tua ligação à internet):
//   node scripts/build-dictionary.mjs
//
// Descarrega um léxico português (fserb/pt-br, licença MIT), filtra só as
// palavras de 5 letras e guarda-as em src/data/ptDictionary.json. A app
// depois usa esse ficheiro localmente, sem precisar de rede nem de motores
// de regras (Hunspell/nspell) — só um Set simples, instantâneo.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const LEXICO_URL = 'https://raw.githubusercontent.com/fserb/pt-br/master/lexico'

console.log('A descarregar léxico de', LEXICO_URL, '...')
const res = await fetch(LEXICO_URL)
if (!res.ok) {
  throw new Error(`Falha ao descarregar (status ${res.status})`)
}
const text = await res.text()

const words = new Set()
for (const rawLine of text.split('\n')) {
  const word = rawLine.trim().toUpperCase()
  if (word.length === 5 && /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]+$/.test(word)) {
    words.add(word)
  }
}

const sorted = [...words].sort()
const outPath = fileURLToPath(new URL('../src/data/ptDictionary.json', import.meta.url))
writeFileSync(outPath, JSON.stringify(sorted))
console.log(`Guardadas ${sorted.length} palavras de 5 letras em src/data/ptDictionary.json`)