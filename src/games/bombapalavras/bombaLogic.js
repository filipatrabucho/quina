// Bomba de Palavras: aparece uma sílaba e quem tem a bomba escreve uma palavra
// que a contenha. Se acertar, a bomba passa ao seguinte com outra sílaba. A
// bomba rebenta a uma hora escondida: quem a tiver nessa altura perde uma vida.
// Ganha quem ficar por último. Lógica pura: corre no anfitrião (ou no browser).
import { SYLLABLES } from './syllables.js'

export const COUNTDOWN_MS = 3000
export const BOOM_MS = 2200
export const FUSE_MS = [10000, 24000] // a bomba rebenta entre estes tempos (escondido)
export const MIN_TURN_MS = 3500 // quem recebe a bomba tem sempre pelo menos isto
export const LIVES_OPTIONS = [2, 3]
export const MAX_LIVES = 4
// Letras para o bónus de vida (todas as do alfabeto que se usam em português).
export const ALPHABET = 'abcdefghijlmnopqrstuvxz'
export const BOT_NAMES = ['Bot Rita', 'Bot Zé', 'Bot Inês', 'Bot Rui', 'Bot Ana', 'Bot Tó', 'Bot Bia']
export const BOT_LEVELS = {
  facil: { min: 2800, max: 6500, ok: 0.82 },
  medio: { min: 1800, max: 4500, ok: 0.9 },
  dificil: { min: 1100, max: 3000, ok: 0.96 },
}

export const plain = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')

// Dicionário (carregado à parte; ver dictionary.js).
let DICT = null
let LIST = []
export function setDictionary(words) {
  LIST = words
  DICT = new Set(words)
}
export const dictionaryReady = () => !!DICT
export const isWord = (w) => !!DICT && DICT.has(w)

function shuffle(list, rand = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Sílabas: começa fácil e vai ficando mais difícil com o número de palavras.
function pickSyllable(g, rand) {
  const n = g.used.length
  const r = rand()
  const tier = n < 6 ? (r < 0.8 ? 'facil' : 'medio') : n < 18 ? (r < 0.35 ? 'facil' : r < 0.85 ? 'medio' : 'dificil') : r < 0.2 ? 'facil' : r < 0.6 ? 'medio' : 'dificil'
  const pool = SYLLABLES[tier]
  let s = pool[Math.floor(rand() * pool.length)]
  if (s === g.syllable) s = pool[(pool.indexOf(s) + 1) % pool.length]
  return s
}

const alive = (g) => g.order.filter((id) => g.players[id].lives > 0)
const fuse = (rand) => FUSE_MS[0] + Math.floor(rand() * (FUSE_MS[1] - FUSE_MS[0]))
function nextAlive(g, fromId) {
  const n = g.order.length
  const i = g.order.indexOf(fromId)
  for (let k = 1; k <= n; k++) {
    const id = g.order[(i + k) % n]
    if (g.players[id].lives > 0) return id
  }
  return fromId
}

// opts: { lives, level, round, wins }
export function startGame(ids, bots = [], now = Date.now(), rand = Math.random, opts = {}) {
  if (ids.length < 2) throw new Error('São precisos pelo menos 2 jogadores (podes juntar bots).')
  const lives = LIVES_OPTIONS.includes(opts.lives) ? opts.lives : 2
  const order = shuffle(ids, rand)
  const g = {
    order,
    bots,
    players: Object.fromEntries(ids.map((id) => [id, { lives, letters: '', words: 0, bot: bots.includes(id) ? { at: 0, word: null, plan: 0 } : null }])),
    holder: order[0],
    syllable: null,
    used: [],
    typing: '',
    phase: 'countdown',
    phaseEnds: now + COUNTDOWN_MS,
    explodesAt: null,
    turnStarted: now + COUNTDOWN_MS,
    last: null,
    boom: null,
    winner: null,
    cfg: { lives, level: BOT_LEVELS[opts.level] ? opts.level : 'medio' },
    round: (opts.round || 0) + 1,
    wins: opts.wins || {},
    startedAt: now,
  }
  g.syllable = pickSyllable(g, rand)
  return g
}

const clone = (g) => ({
  ...g,
  players: Object.fromEntries(Object.entries(g.players).map(([id, p]) => [id, { ...p, bot: p.bot && { ...p.bot } }])),
  used: g.used.slice(),
})

function giveBomb(g, id, now) {
  g.holder = id
  g.typing = ''
  g.turnStarted = now
  if (g.players[id].bot) g.players[id].bot = { at: 0, word: null, plan: 0 }
}

// Tenta uma palavra (de uma pessoa ou de um bot). Devolve o motivo se falhar.
function tryWord(g, id, text, now, rand) {
  const w = plain(text)
  let reason = null
  if (w.length < 3) reason = 'curta'
  else if (!w.includes(g.syllable)) reason = 'sílaba'
  else if (g.used.includes(w)) reason = 'repetida'
  else if (!isWord(w)) reason = 'não existe'
  g.last = { by: id, word: String(text).trim().slice(0, 30), ok: !reason, reason, syllable: g.syllable, at: now }
  if (reason) return reason
  const p = g.players[id]
  g.used.push(w)
  p.words += 1
  // Bónus: usar todas as letras do alfabeto dá uma vida.
  let letters = p.letters
  for (const ch of w) if (ALPHABET.includes(ch) && !letters.includes(ch)) letters += ch
  if (letters.length >= ALPHABET.length) {
    p.lives = Math.min(MAX_LIVES, p.lives + 1)
    letters = ''
    g.last.bonus = true
  }
  p.letters = letters
  g.syllable = pickSyllable(g, rand)
  giveBomb(g, nextAlive(g, id), now)
  g.explodesAt = Math.max(g.explodesAt, now + MIN_TURN_MS)
  return null
}

export function applyAction(game, id, action, now = Date.now(), rand = Math.random) {
  const p = game.players[id]
  if (!p) throw new Error('Não estás neste jogo.')
  if (action.type === 'rematch') {
    if (game.phase !== 'over') return game
    return startGame(game.order, game.bots, now, rand, { ...game.cfg, round: game.round, wins: game.wins })
  }
  if (game.phase !== 'play' || game.holder !== id) return game
  if (action.type === 'typing') {
    const text = String(action.text || '').slice(0, 30)
    if (text === game.typing) return game
    return { ...game, typing: text }
  }
  if (action.type === 'word') {
    const g = clone(game)
    tryWord(g, id, action.text, now, rand)
    return g
  }
  throw new Error('Ação desconhecida.')
}

// Bot: pensa um bocado, "escreve" a palavra aos poucos e envia. Às vezes engana-se.
function botTurn(g, id, now, rand) {
  const b = g.players[id].bot
  const lvl = BOT_LEVELS[g.cfg.level]
  if (!b.at) {
    const hard = SYLLABLES.dificil.includes(g.syllable) ? 1.35 : SYLLABLES.medio.includes(g.syllable) ? 1.1 : 1
    b.plan = now
    b.at = now + Math.round((lvl.min + rand() * (lvl.max - lvl.min)) * hard)
    const options = LIST.filter((w) => w.includes(g.syllable) && w.length <= 10 && !g.used.includes(w))
    b.word = options.length && rand() < lvl.ok ? options[Math.floor(rand() * options.length)] : null
    if (!b.word) b.wrong = g.syllable + ['ao', 'ra', 'te', 'mo'][Math.floor(rand() * 4)] + 'x'
    return true
  }
  const text = b.word || b.wrong
  if (now < b.at) {
    // vai mostrando o que está a escrever
    const shown = text.slice(0, Math.max(0, Math.floor(((now - b.plan) / (b.at - b.plan)) * text.length)))
    if (shown !== g.typing) {
      g.typing = shown
      return true
    }
    return false
  }
  if (b.word) tryWord(g, id, b.word, now, rand)
  else {
    tryWord(g, id, b.wrong, now, rand)
    // tenta outra vez daqui a nada
    g.players[id].bot = { at: 0, word: null, plan: 0 }
    g.typing = ''
  }
  return true
}

export function tick(game, now, rand = Math.random) {
  if (game.phase === 'over') return game
  if (game.phase === 'countdown') {
    if (now < game.phaseEnds) return game
    const g = clone(game)
    g.phase = 'play'
    g.phaseEnds = null
    g.explodesAt = now + fuse(rand)
    giveBomb(g, g.holder, now)
    return g
  }
  if (game.phase === 'boom') {
    if (now < game.phaseEnds) return game
    const g = clone(game)
    const left = alive(g)
    if (left.length <= 1) {
      g.phase = 'over'
      g.winner = left[0] || null
      if (g.winner) g.wins = { ...g.wins, [g.winner]: (g.wins[g.winner] || 0) + 1 }
      g.phaseEnds = null
      return g
    }
    g.phase = 'play'
    g.phaseEnds = null
    g.syllable = pickSyllable(g, rand)
    g.explodesAt = now + fuse(rand)
    giveBomb(g, g.players[g.boom.id].lives > 0 ? g.boom.id : nextAlive(g, g.boom.id), now)
    g.boom = null
    return g
  }
  // a jogar
  if (now >= game.explodesAt) {
    const g = clone(game)
    const p = g.players[g.holder]
    p.lives -= 1
    g.boom = { id: g.holder, syllable: g.syllable, out: p.lives <= 0 }
    g.phase = 'boom'
    g.phaseEnds = now + BOOM_MS
    g.typing = ''
    g.explodesAt = null
    return g
  }
  if (game.players[game.holder].bot) {
    const g = clone(game)
    return botTurn(g, g.holder, now, rand) ? g : game
  }
  return game
}

export const bombaOnline = {
  minPlayers: 1,
  maxPlayers: 8,
  tick: true,
  tickMs: 100,
  broadcastMs: 100,
  start(players, action, now) {
    const humans = players.map((p) => p.id)
    const nBots = Math.max(2 - humans.length, 0, Math.min(8 - humans.length, Number(action.bots) || 0))
    const bots = Array.from({ length: nBots }, (_, i) => `bot${i}`)
    return startGame([...humans, ...bots], bots, now, Math.random, { lives: Number(action.lives), level: action.level })
  },
  reduce(game, action, fromId, { now }) {
    if (action.type === 'tick') return tick(game, now)
    return applyAction(game, fromId, action, now)
  },
}
