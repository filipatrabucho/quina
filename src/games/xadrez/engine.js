// Motor de xadrez próprio (tabuleiro 0x88), muito mais rápido do que pesquisar
// com o chess.js: gera lances, joga e desfaz sem criar objetos. Usado só pelo
// bot; quem valida os lances no jogo continua a ser o chess.js.
const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6
const WHITE = 0, BLACK = 8
const TYPE = { p: P, n: N, b: B, r: R, q: Q, k: K }
const LETTER = ['', 'p', 'n', 'b', 'r', 'q', 'k']
const VALUE = [0, 100, 320, 330, 500, 900, 20000]

const KNIGHT = [33, 31, 18, 14, -33, -31, -18, -14]
const BISHOP = [15, 17, -15, -17]
const ROOK = [1, -1, 16, -16]
const KING = [1, -1, 16, -16, 15, 17, -15, -17]

const F_CAPTURE = 1, F_EP = 2, F_CASTLE = 4, F_DOUBLE = 8

// Tabelas de posição do ponto de vista das brancas, linha 8 primeiro.
const PST = [
  null,
  [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
]
// Rei no fim da partida: quer ir para o centro.
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50]

export const sqName = (sq) => 'abcdefgh'[sq & 7] + ((sq >> 4) + 1)
const nameSq = (s) => (Number(s[1]) - 1) * 16 + (s.charCodeAt(0) - 97)

export class Position {
  constructor(fen) {
    this.board = new Int8Array(128)
    this.kings = [0, 0]
    this.stack = []
    const [placement, side, castling, ep] = fen.split(' ')
    let rank = 7
    let file = 0
    for (const ch of placement) {
      if (ch === '/') {
        rank--
        file = 0
      } else if (/\d/.test(ch)) file += Number(ch)
      else {
        const color = ch === ch.toLowerCase() ? BLACK : WHITE
        const t = TYPE[ch.toLowerCase()]
        const sq = rank * 16 + file
        this.board[sq] = t | color
        if (t === K) this.kings[color ? 1 : 0] = sq
        file++
      }
    }
    this.side = side === 'b' ? BLACK : WHITE
    this.castle = (castling.includes('K') ? 1 : 0) | (castling.includes('Q') ? 2 : 0) | (castling.includes('k') ? 4 : 0) | (castling.includes('q') ? 8 : 0)
    this.ep = ep && ep !== '-' ? nameSq(ep) : -1
  }

  attacked(sq, by) {
    const b = this.board
    // peões
    const pd = by === WHITE ? -16 : 16
    for (const d of [pd - 1, pd + 1]) {
      const s = sq + d
      if (!(s & 0x88) && b[s] === (P | by)) return true
    }
    for (const d of KNIGHT) {
      const s = sq + d
      if (!(s & 0x88) && b[s] === (N | by)) return true
    }
    for (const d of KING) {
      const s = sq + d
      if (!(s & 0x88) && b[s] === (K | by)) return true
    }
    for (const d of BISHOP) {
      let s = sq + d
      while (!(s & 0x88)) {
        const p = b[s]
        if (p) {
          if (p === (B | by) || p === (Q | by)) return true
          break
        }
        s += d
      }
    }
    for (const d of ROOK) {
      let s = sq + d
      while (!(s & 0x88)) {
        const p = b[s]
        if (p) {
          if (p === (R | by) || p === (Q | by)) return true
          break
        }
        s += d
      }
    }
    return false
  }

  inCheck(side = this.side) {
    return this.attacked(this.kings[side ? 1 : 0], side ^ BLACK)
  }

  // Lances pseudo-legais (ints: from | to<<7 | promo<<14 | flags<<17).
  generate(capturesOnly = false) {
    const out = []
    const b = this.board
    const us = this.side
    const them = us ^ BLACK
    const add = (from, to, flags, promo = 0) => out.push(from | (to << 7) | (promo << 14) | (flags << 17))
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7
        continue
      }
      const p = b[sq]
      if (!p || (p & BLACK) !== us) continue
      const t = p & 7
      if (t === P) {
        const fwd = us === WHITE ? 16 : -16
        const startRank = us === WHITE ? 1 : 6
        const promoRank = us === WHITE ? 7 : 0
        const one = sq + fwd
        if (!capturesOnly && !(one & 0x88) && !b[one]) {
          if (one >> 4 === promoRank) for (const pr of [Q, R, B, N]) add(sq, one, 0, pr)
          else {
            add(sq, one, 0)
            const two = one + fwd
            if (sq >> 4 === startRank && !b[two]) add(sq, two, F_DOUBLE)
          }
        }
        for (const d of [fwd - 1, fwd + 1]) {
          const s = sq + d
          if (s & 0x88) continue
          if (b[s] && (b[s] & BLACK) === them) {
            if (s >> 4 === promoRank) for (const pr of [Q, R, B, N]) add(sq, s, F_CAPTURE, pr)
            else add(sq, s, F_CAPTURE)
          } else if (s === this.ep) add(sq, s, F_CAPTURE | F_EP)
        }
        continue
      }
      if (t === N || t === K) {
        for (const d of t === N ? KNIGHT : KING) {
          const s = sq + d
          if (s & 0x88) continue
          const q = b[s]
          if (!q) {
            if (!capturesOnly) add(sq, s, 0)
          } else if ((q & BLACK) === them) add(sq, s, F_CAPTURE)
        }
        if (t === K && !capturesOnly) this.castles(sq, add)
        continue
      }
      const dirs = t === B ? BISHOP : t === R ? ROOK : KING
      for (const d of dirs) {
        let s = sq + d
        while (!(s & 0x88)) {
          const q = b[s]
          if (!q) {
            if (!capturesOnly) add(sq, s, 0)
          } else {
            if ((q & BLACK) === them) add(sq, s, F_CAPTURE)
            break
          }
          s += d
        }
      }
    }
    return out
  }

  castles(sq, add) {
    const b = this.board
    const us = this.side
    const them = us ^ BLACK
    const base = us === WHITE ? 0 : 112
    if (sq !== base + 4) return
    const kBit = us === WHITE ? 1 : 4
    const qBit = us === WHITE ? 2 : 8
    if (this.castle & kBit && !b[base + 5] && !b[base + 6] && b[base + 7] === (R | us)) {
      if (!this.attacked(base + 4, them) && !this.attacked(base + 5, them) && !this.attacked(base + 6, them)) add(sq, base + 6, F_CASTLE)
    }
    if (this.castle & qBit && !b[base + 3] && !b[base + 2] && !b[base + 1] && b[base] === (R | us)) {
      if (!this.attacked(base + 4, them) && !this.attacked(base + 3, them) && !this.attacked(base + 2, them)) add(sq, base + 2, F_CASTLE)
    }
  }

  make(m) {
    const b = this.board
    const from = m & 127
    const to = (m >> 7) & 127
    const promo = (m >> 14) & 7
    const flags = m >> 17
    const p = b[from]
    const us = this.side
    let captured = b[to]
    let capSq = to
    if (flags & F_EP) {
      capSq = to + (us === WHITE ? -16 : 16)
      captured = b[capSq]
      b[capSq] = 0
    }
    this.stack.push({ m, captured, capSq, castle: this.castle, ep: this.ep })
    b[to] = promo ? promo | us : p
    b[from] = 0
    if ((p & 7) === K) {
      this.kings[us ? 1 : 0] = to
      if (flags & F_CASTLE) {
        if (to === from + 2) {
          b[from + 1] = b[from + 3]
          b[from + 3] = 0
        } else {
          b[from - 1] = b[from - 4]
          b[from - 4] = 0
        }
      }
    }
    this.ep = flags & F_DOUBLE ? (from + to) >> 1 : -1
    // direitos de roque
    for (const s of [from, to]) {
      if (s === 4) this.castle &= ~3
      else if (s === 0) this.castle &= ~2
      else if (s === 7) this.castle &= ~1
      else if (s === 116) this.castle &= ~12
      else if (s === 112) this.castle &= ~8
      else if (s === 119) this.castle &= ~4
    }
    this.side ^= BLACK
  }

  unmake() {
    const { m, captured, capSq, castle, ep } = this.stack.pop()
    const b = this.board
    const from = m & 127
    const to = (m >> 7) & 127
    const promo = (m >> 14) & 7
    const flags = m >> 17
    this.side ^= BLACK
    const us = this.side
    const p = promo ? P | us : b[to]
    b[from] = p
    b[to] = 0
    if (captured) b[capSq] = captured
    if ((p & 7) === K) {
      this.kings[us ? 1 : 0] = from
      if (flags & F_CASTLE) {
        if (to === from + 2) {
          b[from + 3] = b[from + 1]
          b[from + 1] = 0
        } else {
          b[from - 4] = b[from - 1]
          b[from - 1] = 0
        }
      }
    }
    this.castle = castle
    this.ep = ep
  }

  legal() {
    const out = []
    for (const m of this.generate()) {
      this.make(m)
      if (!this.inCheck(this.side ^ BLACK)) out.push(m)
      this.unmake()
    }
    return out
  }

  // Avaliação do ponto de vista de quem joga.
  evaluate() {
    const b = this.board
    let score = 0
    let material = 0
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7
        continue
      }
      const p = b[sq]
      if (!p || (p & 7) === K) continue
      material += VALUE[p & 7]
    }
    const endgame = material < 2600
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7
        continue
      }
      const p = b[sq]
      if (!p) continue
      const t = p & 7
      const white = !(p & BLACK)
      const r = sq >> 4
      const f = sq & 7
      const idx = white ? (7 - r) * 8 + f : r * 8 + f
      const table = t === K && endgame ? KING_END : PST[t]
      const v = VALUE[t] + table[idx]
      score += white ? v : -v
    }
    return this.side === WHITE ? score : -score
  }
}

export const moveFrom = (m) => sqName(m & 127)
export const moveTo = (m) => sqName((m >> 7) & 127)
export const movePromo = (m) => LETTER[(m >> 14) & 7] || undefined

const MATE = 100000
class Stop extends Error {}

function orderScore(pos, m, killers, ply, pv) {
  if (m === pv) return 1e6
  const flags = m >> 17
  const promo = (m >> 14) & 7
  let s = 0
  if (flags & F_CAPTURE) {
    const victim = flags & F_EP ? P : pos.board[(m >> 7) & 127] & 7
    const attacker = pos.board[m & 127] & 7
    s = 10000 + VALUE[victim] * 10 - VALUE[attacker]
  } else if (killers[ply] && (killers[ply][0] === m || killers[ply][1] === m)) s = 5000
  if (promo) s += 9000 + VALUE[promo]
  return s
}

function sortMoves(pos, moves, killers, ply, pv) {
  const scored = moves.map((m) => [orderScore(pos, m, killers, ply, pv), m])
  scored.sort((a, b) => b[0] - a[0])
  return scored.map((x) => x[1])
}

// Procura com aprofundamento iterativo e limite de tempo.
// exact: nota exata de todos os lances da raiz (mais lento; serve para escolher
// ao acaso entre lances quase tão bons como o melhor).
export function search(fen, { timeMs = 500, maxDepth = 6, exact = false } = {}) {
  const pos = new Position(fen)
  const deadline = Date.now() + timeMs
  const killers = []
  let nodes = 0
  const tick = () => {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) throw new Stop()
  }

  function quiesce(alpha, beta, depth) {
    tick()
    const stand = pos.evaluate()
    if (stand >= beta) return beta
    if (stand > alpha) alpha = stand
    if (depth === 0) return alpha
    for (const m of sortMoves(pos, pos.generate(true), killers, 0, 0)) {
      pos.make(m)
      if (pos.inCheck(pos.side ^ BLACK)) {
        pos.unmake()
        continue
      }
      const score = -quiesce(-beta, -alpha, depth - 1)
      pos.unmake()
      if (score >= beta) return beta
      if (score > alpha) alpha = score
    }
    return alpha
  }

  function negamax(depth, alpha, beta, ply) {
    tick()
    const check = pos.inCheck()
    if (depth <= 0 && !check) return quiesce(alpha, beta, 6)
    const moves = sortMoves(pos, pos.generate(), killers, ply, 0)
    let legal = 0
    let best = -Infinity
    for (const m of moves) {
      pos.make(m)
      if (pos.inCheck(pos.side ^ BLACK)) {
        pos.unmake()
        continue
      }
      legal++
      const score = -negamax(depth - 1, -beta, -alpha, ply + 1)
      pos.unmake()
      if (score > best) best = score
      if (score > alpha) alpha = score
      if (alpha >= beta) {
        if (!((m >> 17) & F_CAPTURE)) {
          const k = (killers[ply] = killers[ply] || [0, 0])
          if (k[0] !== m) {
            k[1] = k[0]
            k[0] = m
          }
        }
        break
      }
    }
    if (!legal) return check ? -MATE + ply : 0
    return best
  }

  const rootMoves = pos.legal()
  if (!rootMoves.length) return null
  let order = sortMoves(pos, rootMoves, killers, 0, 0)
  let bestMove = order[0]
  let scores = []
  let depthDone = 0
  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      let alpha = -Infinity
      const results = []
      for (const m of order) {
        pos.make(m)
        // sem `exact`, os lances piores só têm um limite (corte alfa-beta)
        const score = -negamax(depth - 1, -Infinity, exact ? Infinity : -alpha + 1, 1)
        pos.unmake()
        results.push([score, m])
        if (score > alpha) alpha = score
      }
      results.sort((a, b) => b[0] - a[0])
      order = results.map((r) => r[1])
      scores = results
      bestMove = order[0]
      depthDone = depth
      if (results[0][0] > MATE - 100) break // mate encontrado
    } catch (e) {
      if (!(e instanceof Stop)) throw e
      // repõe a posição (o erro pode ter saído a meio de um lance)
      while (pos.stack.length) pos.unmake()
      break
    }
  }
  return { move: bestMove, scores, depth: depthDone, nodes }
}

// Contagem de nós (para testar o gerador de lances).
export function perft(fen, depth) {
  const pos = new Position(fen)
  const walk = (d) => {
    if (d === 0) return 1
    let n = 0
    for (const m of pos.legal()) {
      pos.make(m)
      n += walk(d - 1)
      pos.unmake()
    }
    return n
  }
  return walk(depth)
}
