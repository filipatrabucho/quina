import { useEffect, useState } from 'react'

// Ecrã inteiro dos jogos. Usa o ecrã inteiro do browser na página toda (para
// o chat continuar a aparecer por cima) e esconde o resto do site com a classe
// "is-game-fs". Onde o browser não deixa (ex.: iPhone), fica só o modo "foco":
// o jogo ocupa a janela toda.
let on = false
const subs = new Set()

function set(value) {
  on = value
  document.documentElement.classList.toggle('is-game-fs', value)
  subs.forEach((fn) => fn(value))
}

export async function enterFullscreen() {
  set(true)
  try {
    if (document.fullscreenEnabled && !document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
  } catch {
    // sem permissão: fica o modo "foco"
  }
}

export async function exitFullscreen() {
  if (on) set(false)
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
  } catch {
    // já tinha saído
  }
}

if (typeof document !== 'undefined') {
  // Saiu com Esc (ou o gesto do telemóvel): sai também do modo do site.
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && on) set(false)
  })
}

export function useGameFullscreen() {
  const [value, setValue] = useState(on)
  useEffect(() => {
    subs.add(setValue)
    setValue(on)
    return () => subs.delete(setValue)
  }, [])
  return value
}
