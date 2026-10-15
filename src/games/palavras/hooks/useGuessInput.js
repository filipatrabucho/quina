import { useCallback, useMemo, useState } from 'react'
import { emptyInput, typeLetter, backspace, deleteAt, moveCursor, setCursor, isFull, toWord } from '../utils/guessInput.js'

export function useGuessInput() {
  const [input, setInput] = useState(emptyInput)
  const type = useCallback((l) => setInput((s) => typeLetter(s, l)), [])
  const back = useCallback(() => setInput((s) => backspace(s)), [])
  const del = useCallback(() => setInput((s) => deleteAt(s)), [])
  const move = useCallback((d) => setInput((s) => moveCursor(s, d)), [])
  const select = useCallback((i) => setInput((s) => setCursor(s, i)), [])
  const reset = useCallback(() => setInput(emptyInput()), [])
  return useMemo(
    () => ({ input, word: toWord(input), full: isFull(input), type, back, del, move, select, reset }),
    [input, type, back, del, move, select, reset]
  )
}

// Teclas físicas → ações do jogo ('ENTER', 'BACK', 'DEL', 'LEFT', 'RIGHT' ou letra).
export function keyFromEvent(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return null
  const k = e.key
  if (k === 'Enter') return 'ENTER'
  if (k === 'Backspace') return 'BACK'
  if (k === 'Delete') return 'DEL'
  if (k === 'ArrowLeft') return 'LEFT'
  if (k === 'ArrowRight') return 'RIGHT'
  const up = k.toUpperCase()
  return /^[A-Z]$/.test(up) ? up : null
}
