import { WORDS } from '../data/words.js'

// Validação de palavras contra um léxico português já expandido (gerado por
// scripts/build-dictionary.mjs em src/data/ptDictionary.json), sempre unido
// com a lista de palavras-alvo (words.js) — para garantir que a própria
// palavra do dia nunca é rejeitada, mesmo que por acaso não esteja no
// léxico externo.
let wordsPromise = null

function loadWords() {
  if (!wordsPromise) {
    wordsPromise = import('../data/ptDictionary.json').then(
      (mod) => new Set([...mod.default, ...WORDS])
    )
  }
  return wordsPromise
}

// Chamar cedo (ex.: ao montar a app) para o dicionário já estar pronto
// quando o jogador submeter a primeira tentativa.
export function preloadDictionary() {
  return loadWords()
}

// O teclado do jogo não tem acentos, mas o léxico tem palavras acentuadas
// (ex: "país", "está"). Testamos as variantes de acentuação plausíveis da
// tentativa e aceitamos se alguma existir no léxico.
const ACCENT_VARIANTS = {
  A: ['A', 'Á', 'À', 'Â', 'Ã'],
  E: ['E', 'É', 'Ê'],
  I: ['I', 'Í'],
  O: ['O', 'Ó', 'Ô', 'Õ'],
  U: ['U', 'Ú', 'Ü'],
  C: ['C', 'Ç'],
}

function* accentVariants(word) {
  const options = word.split('').map((l) => ACCENT_VARIANTS[l] || [l])
  function* combine(i, acc) {
    if (i === options.length) {
      yield acc
      return
    }
    for (const opt of options[i]) yield* combine(i + 1, acc + opt)
  }
  yield* combine(0, '')
}

export async function isRealWord(guess) {
  const words = await loadWords()
  for (const variant of accentVariants(guess)) {
    if (words.has(variant)) return true
  }
  return false
}