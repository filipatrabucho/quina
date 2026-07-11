import { WORDS } from '../data/words.js'

export const WORD_LENGTH = 5
export const MAX_GUESSES = 6

// Dia de referência (arbitrário) para calcular o índice da palavra diária.
const EPOCH = new Date(2024, 0, 1)

export function getTodayIndex(date = new Date()) {
  const d1 = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const d0 = Date.UTC(EPOCH.getFullYear(), EPOCH.getMonth(), EPOCH.getDate())
  const daysPassed = Math.floor((d1 - d0) / 86400000)
  return ((daysPassed % WORDS.length) + WORDS.length) % WORDS.length
}

export function getTodayWord(date = new Date()) {
  return WORDS[getTodayIndex(date)]
}

export function getTodayKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

// Modos de jogo: quantos tabuleiros simultâneos e quantas tentativas.
export const MODES = {
  classico: { label: 'Clássico', boards: 1, maxGuesses: 6 },
  dueto: { label: 'Dueto', boards: 2, maxGuesses: 7 },
  quarteto: { label: 'Quarteto', boards: 4, maxGuesses: 9 },
}

// Cada modo usa uma fatia distinta da lista (nunca partilham palavras entre
// si): índice 0,3,6... para o Clássico, 1,4,7... para o Dueto, 2,5,8...
// para o Quarteto.
const MODE_KEYS = ['classico', 'dueto', 'quarteto']

function wordsForMode(modeKey) {
  const bucket = MODE_KEYS.indexOf(modeKey)
  return WORDS.filter((_, i) => i % MODE_KEYS.length === bucket)
}

// Escolhe `count` palavras distintas para o dia e o modo indicado
// (determinístico: mesmo dia + mesmo modo = mesmas palavras para toda a
// gente, mas nunca repetidas entre modos diferentes).
export function getTodayWords(modeKey, count, date = new Date()) {
  const pool = wordsForMode(modeKey)
  const base = getTodayIndex(date) % pool.length
  const words = []
  const seen = new Set()
  let offset = 0
  while (words.length < count && offset < pool.length) {
    const idx = (base + offset * 37) % pool.length
    if (!seen.has(idx)) {
      seen.add(idx)
      words.push(pool[idx])
    }
    offset++
  }
  return words
}

// Nota: a lista WORDS serve apenas para escolher a palavra secreta do dia.
// A validação das tentativas usa o dicionário Hunspell PT-PT — ver
// utils/dictionary.js (isRealWord) — para aceitar qualquer palavra real,
// não só as ~180 desta lista.

// Avalia uma tentativa contra a palavra-alvo, devolvendo um array de estados:
// 'certo' | 'lugar-errado' | 'errado', tratando corretamente letras repetidas.
export function evaluateGuess(guess, target) {
  const result = new Array(WORD_LENGTH).fill('errado')
  const targetLetters = target.split('')
  const guessLetters = guess.split('')
  const used = new Array(WORD_LENGTH).fill(false)

  // 1ª passagem: letras certas na posição certa
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      result[i] = 'certo'
      used[i] = true
    }
  }

  // 2ª passagem: letras certas em posição errada
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'certo') continue
    const idx = targetLetters.findIndex(
      (letter, j) => !used[j] && letter === guessLetters[i]
    )
    if (idx !== -1) {
      result[i] = 'lugar-errado'
      used[idx] = true
    }
  }

  return result
}

// Devolve, para cada letra do teclado, o melhor estado já observado.
export function computeKeyboardStatuses(guesses, statusesPerGuess) {
  const statuses = {}
  const priority = { 'certo': 3, 'lugar-errado': 2, 'errado': 1 }

  guesses.forEach((guess, gi) => {
    guess.split('').forEach((letter, li) => {
      const status = statusesPerGuess[gi][li]
      if (!statuses[letter] || priority[status] > priority[statuses[letter]]) {
        statuses[letter] = status
      }
    })
  })

  return statuses
}

// Igual, mas combinando os resultados de vários tabuleiros em simultâneo
// (Dueto/Quarteto) — cada letra mostra o melhor estado já visto em qualquer
// um dos tabuleiros.
export function computeKeyboardStatusesMulti(guesses, perBoardStatuses) {
  const statuses = {}
  const priority = { 'certo': 3, 'lugar-errado': 2, 'errado': 1 }

  perBoardStatuses.forEach((boardStatuses) => {
    guesses.forEach((guess, gi) => {
      guess.split('').forEach((letter, li) => {
        const status = boardStatuses[gi][li]
        if (!statuses[letter] || priority[status] > priority[statuses[letter]]) {
          statuses[letter] = status
        }
      })
    })
  })

  return statuses
}

export function buildShareGrid(statusesPerGuess) {
  const emoji = { 'certo': '🟩', 'lugar-errado': '🟨', 'errado': '⬛' }
  return statusesPerGuess
    .map((row) => row.map((s) => emoji[s]).join(''))
    .join('\n')
}