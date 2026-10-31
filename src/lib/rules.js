import { useEffect, useState } from 'react'

// Janela "Como jogar" de cada jogo: o cabeçalho do jogo (GameShell) abre-a e
// pode juntar-lhe o resumo rápido (help) do próprio jogo.
let state = { open: false, help: null, shell: false }
const subs = new Set()
const set = (patch) => {
  state = { ...state, ...patch }
  subs.forEach((fn) => fn(state))
}

export const openRules = () => set({ open: true })
export const closeRules = () => set({ open: false })
export function registerShell(help) {
  set({ shell: true, help })
  return () => set({ shell: false, help: null, open: false })
}

export function useRules() {
  const [value, setValue] = useState(state)
  useEffect(() => {
    subs.add(setValue)
    setValue(state)
    return () => subs.delete(setValue)
  }, [])
  return value
}
