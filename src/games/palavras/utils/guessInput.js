import { WORD_LENGTH } from './gameLogic.js'

// Tentativa a ser escrita: uma casa por letra ('' = vazia) e o cursor.
// Permite escrever as letras em qualquer ordem (ex.: _ _ A _ _).
export const emptyInput = () => ({ slots: Array(WORD_LENGTH).fill(''), cursor: 0 })

export function typeLetter({ slots, cursor }, letter) {
  const next = [...slots]
  next[cursor] = letter
  // Avança para a próxima casa vazia (à frente; se não houver, desde o início).
  let target = -1
  for (let i = cursor + 1; i < WORD_LENGTH; i++) if (!next[i]) { target = i; break }
  if (target < 0) for (let i = 0; i < cursor; i++) if (!next[i]) { target = i; break }
  if (target < 0) target = Math.min(cursor + 1, WORD_LENGTH - 1)
  return { slots: next, cursor: target }
}

export function backspace({ slots, cursor }) {
  const next = [...slots]
  if (next[cursor]) {
    next[cursor] = ''
    return { slots: next, cursor }
  }
  const prev = Math.max(0, cursor - 1)
  next[prev] = ''
  return { slots: next, cursor: prev }
}

export function deleteAt({ slots, cursor }) {
  const next = [...slots]
  next[cursor] = ''
  return { slots: next, cursor }
}

export function moveCursor(state, delta) {
  return { ...state, cursor: Math.min(WORD_LENGTH - 1, Math.max(0, state.cursor + delta)) }
}

export function setCursor(state, index) {
  return { ...state, cursor: Math.min(WORD_LENGTH - 1, Math.max(0, index)) }
}

export const isFull = ({ slots }) => slots.every(Boolean)
export const toWord = ({ slots }) => slots.join('')
