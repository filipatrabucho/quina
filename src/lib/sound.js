// Som das notificações, gerado com Web Audio (sem ficheiros).
// Os browsers só deixam tocar depois de um clique ou tecla na página.
const KEY = 'quina-som'
let ctx = null
let last = 0

export function soundEnabled() {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundEnabled(on) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // ignora
  }
}

function unlock() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
}

if (typeof window !== 'undefined') {
  const once = () => {
    unlock()
    window.removeEventListener('pointerdown', once)
    window.removeEventListener('keydown', once)
  }
  window.addEventListener('pointerdown', once)
  window.addEventListener('keydown', once)
}

const TUNES = {
  mensagem: [[880, 0], [1320, 0.09]],
  convite: [[660, 0], [880, 0.1], [1320, 0.2]],
  amigos: [[740, 0], [988, 0.12]],
  medalha: [[784, 0], [988, 0.1], [1175, 0.2], [1568, 0.3]],
}

export function playNotify(kind = 'mensagem') {
  if (!soundEnabled() || !ctx || ctx.state !== 'running') return
  const now = Date.now()
  if (now - last < 1200) return // várias notificações juntas: um só som
  last = now
  const t0 = ctx.currentTime + 0.01
  for (const [freq, at] of TUNES[kind] || TUNES.mensagem) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t0 + at)
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + at + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.22)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0 + at)
    osc.stop(t0 + at + 0.25)
  }
}
