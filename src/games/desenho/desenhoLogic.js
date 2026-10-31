// Desenha e Adivinha: à vez, cada um escolhe uma palavra e desenha-a; os outros
// escrevem palpites. Quanto mais depressa se acerta, mais pontos (quem desenha
// também ganha por cada um que acerta). Lógica pura: corre no anfitrião.
import { WORDS } from './words.js'

export const CHOOSE_MS = 15000
export const REVEAL_MS = 5000
export const ROUND_OPTIONS = [2, 3]
export const DRAW_OPTIONS = [60, 80, 100] // segundos
export const MAX_STROKE_CHARS = 90000 // limite do desenho (para as mensagens não ficarem enormes)
export const W = 1000
export const H = 750

export const plain = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-\s]+/g, ' ').replace(/[^a-z0-9 ]/g, '')

function shuffle(list, rand = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Três palavras para escolher: uma de cada dificuldade (sem repetir as já usadas).
function options(used, rand) {
  return ['facil', 'medio', 'dificil'].map((d) => {
    const pool = WORDS[d].filter((w) => !used.includes(w))
    const list = pool.length ? pool : WORDS[d]
    return { word: list[Math.floor(rand() * list.length)], level: d }
  })
}

// "_ _ _ _" com as letras já reveladas (espaços e hífenes sempre à vista).
export function mask(word, revealed = []) {
  return [...word].map((ch, i) => (ch === ' ' || ch === '-' ? ch : revealed.includes(i) ? ch : '_')).join('')
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  }
  return d[a.length][b.length]
}

// opts: { rounds, drawSecs }
export function startGame(ids, now = Date.now(), rand = Math.random, opts = {}) {
  if (ids.length < 2) throw new Error('São precisos pelo menos 2 jogadores.')
  const order = shuffle(ids, rand)
  const g = {
    order,
    scores: Object.fromEntries(ids.map((id) => [id, 0])),
    cfg: {
      rounds: ROUND_OPTIONS.includes(opts.rounds) ? opts.rounds : 2,
      drawMs: (DRAW_OPTIONS.includes(opts.drawSecs) ? opts.drawSecs : 80) * 1000,
    },
    round: 1,
    turn: 0,
    used: [],
    chat: [],
    startedAt: now,
    game: (opts.game || 0) + 1,
  }
  return beginTurn(g, now, rand)
}

function beginTurn(g, now, rand) {
  return {
    ...g,
    drawer: g.order[g.turn],
    phase: 'choose',
    phaseEnds: now + CHOOSE_MS,
    choices: options(g.used, rand),
    word: null,
    revealed: [],
    strokes: [],
    guessed: {},
    drawStarted: null,
  }
}

const sys = (g, text, now) => ({ ...g, chat: [...g.chat, { by: null, kind: 'system', text, at: now }].slice(-60) })

function endTurn(g, now, reason) {
  // quem desenha ganha pontos por cada um que acertou
  const n = Object.keys(g.guessed).length
  const scores = { ...g.scores, [g.drawer]: g.scores[g.drawer] + n * 40 }
  return sys({ ...g, scores, phase: 'reveal', phaseEnds: now + REVEAL_MS, endReason: reason }, `A palavra era «${g.word}».`, now)
}

function nextTurn(g, now, rand) {
  let turn = g.turn + 1
  let round = g.round
  if (turn >= g.order.length) {
    turn = 0
    round += 1
  }
  if (round > g.cfg.rounds) {
    const best = Math.max(...g.order.map((id) => g.scores[id]))
    const winners = g.order.filter((id) => g.scores[id] === best)
    return { ...g, phase: 'over', phaseEnds: null, winners }
  }
  return beginTurn({ ...g, turn, round }, now, rand)
}

function choose(g, i, now) {
  const word = g.choices[i]?.word || g.choices[0].word
  return { ...g, word, phase: 'draw', phaseEnds: now + g.cfg.drawMs, drawStarted: now, used: [...g.used, word], strokes: [], revealed: [] }
}

const strokeChars = (strokes) => strokes.reduce((s, x) => s + x.p.length, 0)

export function applyAction(game, id, action, now = Date.now(), rand = Math.random) {
  if (!game.order.includes(id)) throw new Error('Não estás neste jogo.')
  switch (action.type) {
    case 'rematch':
      if (game.phase !== 'over') return game
      return startGame(game.order, now, rand, { rounds: game.cfg.rounds, drawSecs: game.cfg.drawMs / 1000, game: game.game })
    case 'choose':
      if (game.phase !== 'choose' || id !== game.drawer) return game
      return choose(game, Number(action.i) || 0, now)
    case 'stroke': {
      // Um bocado de traço: { sid, c (cor), w (grossura), p (pontos codificados) }.
      if (game.phase !== 'draw' || id !== game.drawer) return game
      const p = String(action.p || '')
      if (!/^[0-9a-z]*$/.test(p) || p.length % 4 || !p) return game
      if (strokeChars(game.strokes) + p.length > MAX_STROKE_CHARS) return game
      const c = /^#[0-9a-fA-F]{6}$/.test(action.c) ? action.c : '#14141C'
      const w = Math.max(2, Math.min(40, Number(action.w) || 6))
      const last = game.strokes[game.strokes.length - 1]
      if (last && last.sid === action.sid) {
        return { ...game, strokes: [...game.strokes.slice(0, -1), { ...last, p: last.p + p }] }
      }
      return { ...game, strokes: [...game.strokes, { sid: String(action.sid).slice(0, 12), c, w, p }] }
    }
    case 'undo':
      if (game.phase !== 'draw' || id !== game.drawer || !game.strokes.length) return game
      return { ...game, strokes: game.strokes.slice(0, -1) }
    case 'clear':
      if (game.phase !== 'draw' || id !== game.drawer || !game.strokes.length) return game
      return { ...game, strokes: [] }
    case 'guess': {
      const text = String(action.text || '').trim().slice(0, 40)
      if (!text) return game
      // fora do desenho (ou quem já acertou / quem desenha): só conversa
      if (game.phase !== 'draw' || id === game.drawer || game.guessed[id] != null) {
        if (game.phase === 'draw' && plain(text).includes(plain(game.word))) return game // não dá para soprar a resposta
        return { ...game, chat: [...game.chat, { by: id, kind: 'talk', text, at: now, onlyGuessed: game.phase === 'draw' }].slice(-60) }
      }
      const a = plain(text)
      const b = plain(game.word)
      if (a === b) {
        const left = Math.max(0, game.phaseEnds - now)
        const first = Object.keys(game.guessed).length === 0
        const pts = Math.max(50, Math.round(300 * (left / game.cfg.drawMs))) + (first ? 50 : 0)
        let g = {
          ...game,
          guessed: { ...game.guessed, [id]: pts },
          scores: { ...game.scores, [id]: game.scores[id] + pts },
          chat: [...game.chat, { by: id, kind: 'correct', at: now, pts }].slice(-60),
        }
        const everyone = g.order.filter((o) => o !== g.drawer).every((o) => g.guessed[o] != null)
        if (everyone) g = endTurn(g, now, 'all')
        return g
      }
      const close = b.length >= 4 && lev(a, b) === 1
      return { ...game, chat: [...game.chat, { by: id, kind: close ? 'close' : 'guess', text, at: now }].slice(-60) }
    }
    default:
      throw new Error('Ação desconhecida.')
  }
}

export function tick(game, now, rand = Math.random) {
  if (game.phase === 'over' || now < game.phaseEnds) {
    // pistas: revela uma letra a meio e outra aos 75% do tempo
    if (game.phase === 'draw') {
      const letters = [...game.word].map((ch, i) => (ch === ' ' || ch === '-' ? -1 : i)).filter((i) => i >= 0)
      const elapsed = (now - game.drawStarted) / game.cfg.drawMs
      const want = letters.length < 4 ? 0 : elapsed >= 0.75 ? 2 : elapsed >= 0.5 ? 1 : 0
      if (game.revealed.length < want) {
        const hidden = letters.filter((i) => !game.revealed.includes(i))
        return { ...game, revealed: [...game.revealed, hidden[Math.floor(rand() * hidden.length)]] }
      }
    }
    return game
  }
  if (game.phase === 'choose') return choose(game, Math.floor(rand() * 3), now)
  if (game.phase === 'draw') return endTurn(game, now, 'time')
  if (game.phase === 'reveal') return nextTurn(game, now, rand)
  return game
}

export const desenhoOnline = {
  minPlayers: 2,
  maxPlayers: 10,
  tick: true,
  tickMs: 250,
  broadcastMs: 120,
  start(players, action, now) {
    return startGame(players.map((p) => p.id), now, Math.random, { rounds: Number(action.rounds), drawSecs: Number(action.drawSecs) })
  },
  reduce(game, action, fromId, { now }) {
    if (action.type === 'tick') return tick(game, now)
    return applyAction(game, fromId, action, now)
  },
}

// Pontos: cada coordenada (0 a 1295) em 2 letras de base 36.
export function encodePoints(points) {
  let s = ''
  for (const [x, y] of points) s += Math.round(x).toString(36).padStart(2, '0') + Math.round(y).toString(36).padStart(2, '0')
  return s
}
export function decodePoints(s) {
  const out = []
  for (let i = 0; i + 3 < s.length; i += 4) out.push([parseInt(s.slice(i, i + 2), 36), parseInt(s.slice(i + 2, i + 4), 36)])
  return out
}
