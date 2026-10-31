import test from 'node:test'
import assert from 'node:assert/strict'
import * as D from '../src/games/desenho/desenhoLogic.js'
import { WORDS } from '../src/games/desenho/words.js'

test('desenho: palavras, máscara e pontos codificados', () => {
  for (const tier of Object.values(WORDS)) assert.ok(tier.length >= 60)
  assert.equal(D.mask('guarda-chuva', [0]), 'g_____-_____')
  assert.equal(D.mask('roda gigante'), '____ _______')
  const pts = [[0, 0], [999, 749], [500, 375]]
  assert.deepEqual(D.decodePoints(D.encodePoints(pts)), pts)
  assert.equal(D.plain('  Guarda-Chuva! '), 'guarda chuva')
})

test('desenho: escolher, desenhar, adivinhar, pontos e fim da vez', () => {
  let g = D.startGame(['a', 'b', 'c'], 0, () => 0.1, { rounds: 2, drawSecs: 60 })
  const drawer = g.drawer
  const [g1, g2] = g.order.filter((x) => x !== drawer)
  assert.equal(g.phase, 'choose')
  assert.equal(g.choices.length, 3)
  assert.equal(D.applyAction(g, g1, { type: 'choose', i: 1 }, 10), g, 'só quem desenha escolhe')
  g = D.applyAction(g, drawer, { type: 'choose', i: 1 }, 10)
  assert.equal(g.phase, 'draw')
  const word = g.word
  // traços: juntam-se pelo id do traço
  g = D.applyAction(g, drawer, { type: 'stroke', sid: 's1', c: '#ff0000', w: 6, p: D.encodePoints([[1, 1], [2, 2]]) }, 20)
  g = D.applyAction(g, drawer, { type: 'stroke', sid: 's1', c: '#ff0000', w: 6, p: D.encodePoints([[3, 3]]) }, 30)
  g = D.applyAction(g, drawer, { type: 'stroke', sid: 's2', c: 'mau', w: 99, p: D.encodePoints([[9, 9]]) }, 40)
  assert.equal(g.strokes.length, 2)
  assert.equal(D.decodePoints(g.strokes[0].p).length, 3)
  assert.equal(g.strokes[1].c, '#14141C')
  assert.equal(g.strokes[1].w, 40)
  assert.equal(D.applyAction(g, g1, { type: 'stroke', sid: 'x', p: '0000' }, 41).strokes.length, 2, 'só quem desenha desenha')
  g = D.applyAction(g, drawer, { type: 'undo' }, 42)
  assert.equal(g.strokes.length, 1)
  // palpites
  g = D.applyAction(g, g1, { type: 'guess', text: 'banana-split' }, 1000)
  assert.equal(g.chat.at(-1).kind, 'guess')
  const typo = word.length >= 4 ? word.slice(0, -1) + (word.endsWith('x') ? 'y' : 'x') : null
  if (typo) {
    g = D.applyAction(g, g1, { type: 'guess', text: typo }, 1100)
    assert.equal(g.chat.at(-1).kind, 'close')
  }
  g = D.applyAction(g, g1, { type: 'guess', text: word.toUpperCase() }, 1200)
  assert.equal(g.chat.at(-1).kind, 'correct')
  assert.ok(g.scores[g1] > 300, 'rápido + primeiro')
  // quem já acertou não pode soprar
  const before = g.chat.length
  g = D.applyAction(g, g1, { type: 'guess', text: `é ${word}` }, 1300)
  assert.equal(g.chat.length, before)
  g = D.applyAction(g, g2, { type: 'guess', text: word }, 30000)
  assert.equal(g.phase, 'reveal', 'todos acertaram: acaba a vez')
  assert.equal(g.scores[drawer], 80)
  // próxima vez
  g = D.tick(g, 30000 + D.REVEAL_MS)
  assert.equal(g.phase, 'choose')
  assert.notEqual(g.drawer, drawer)
})

test('desenho: tempo acaba, pistas, escolha automática e fim do jogo', () => {
  let g = D.startGame(['a', 'b'], 0, () => 0.4, { rounds: 2, drawSecs: 60 })
  let now = 0
  let turns = 0
  while (g.phase !== 'over' && turns < 20) {
    now += D.CHOOSE_MS
    g = D.tick(g, now) // escolhe sozinho
    assert.equal(g.phase, 'draw')
    g = D.tick(g, now + 31000)
    if ([...g.word].filter((c) => c !== ' ' && c !== '-').length >= 4) assert.equal(g.revealed.length, 1, 'uma letra a meio')
    now += 60000
    g = D.tick(g, now)
    assert.equal(g.phase, 'reveal')
    now += D.REVEAL_MS
    g = D.tick(g, now)
    turns++
  }
  assert.equal(turns, 4, '2 rondas x 2 jogadores')
  assert.equal(g.phase, 'over')
  assert.deepEqual(g.winners.sort(), ['a', 'b'])
  const r = D.applyAction(g, 'a', { type: 'rematch' }, now)
  assert.equal(r.phase, 'choose')
  assert.equal(r.scores.a, 0)
  // online
  const o = D.desenhoOnline.start([{ id: 'a' }, { id: 'b' }], { rounds: 3, drawSecs: 100 }, 0)
  assert.equal(o.cfg.rounds, 3)
  assert.equal(o.cfg.drawMs, 100000)
})
