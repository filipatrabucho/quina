import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as B from '../src/games/bombapalavras/bombaLogic.js'
import { SYLLABLES } from '../src/games/bombapalavras/syllables.js'

const words = readFileSync(new URL('../public/palavras-pt.txt', import.meta.url), 'utf8').split('\n').filter(Boolean)
B.setDictionary(words)

const playing = (g, holder, syllable) => ({ ...g, phase: 'play', phaseEnds: null, explodesAt: 1e9, holder, syllable, turnStarted: 0 })

test('bomba: dicionário e sílabas', () => {
  assert.ok(words.length > 100000)
  for (const w of ['casa', 'autocarro', 'telemovel', 'ecra', 'facto', 'bue']) assert.ok(B.isWord(w), w)
  assert.equal(B.plain('  Cão! '), 'cao')
  for (const tier of Object.values(SYLLABLES)) {
    assert.ok(tier.length > 50)
    // todas as sílabas têm palavras que dão
    for (const s of tier.slice(0, 40)) assert.ok(words.some((w) => w.includes(s)), s)
  }
})

test('bomba: palavras certas passam a bomba, erradas não', () => {
  let g = playing(B.startGame(['a', 'b', 'c'], [], 0, () => 0.3), 'a', 'ca')
  g = { ...g, order: ['a', 'b', 'c'] }
  g = B.applyAction(g, 'b', { type: 'word', text: 'casa' }, 10)
  assert.equal(g.holder, 'a', 'só quem tem a bomba joga')
  for (const [text, reason] of [['xy', 'curta'], ['mesa', 'sílaba'], ['caxqz', 'não existe']]) {
    g = B.applyAction(g, 'a', { type: 'word', text }, 10)
    assert.equal(g.last.reason, reason, text)
    assert.equal(g.holder, 'a')
  }
  g = B.applyAction(g, 'a', { type: 'word', text: 'Cão' }, 10) // sem sílaba "ca"? "cao" tem "ca"
  assert.ok(g.last.ok)
  assert.equal(g.holder, 'b')
  assert.ok(g.explodesAt >= 10 + B.MIN_TURN_MS)
  g = { ...g, syllable: 'ca' }
  g = B.applyAction(g, 'b', { type: 'word', text: 'cao' }, 20)
  assert.equal(g.last.reason, 'repetida')
  // a escrever
  g = B.applyAction(g, 'b', { type: 'typing', text: 'cas' }, 21)
  assert.equal(g.typing, 'cas')
})

test('bomba: rebenta, tira vidas e acaba; bónus do alfabeto', () => {
  let g = playing(B.startGame(['a', 'b'], [], 0, () => 0.5, { lives: 2 }), 'a', 'ca')
  g = { ...g, order: ['a', 'b'], explodesAt: 100 }
  g = B.tick(g, 100)
  assert.equal(g.phase, 'boom')
  assert.equal(g.players.a.lives, 1)
  g = B.tick(g, 100 + B.BOOM_MS)
  assert.equal(g.phase, 'play')
  assert.equal(g.holder, 'a', 'quem perdeu e continua vivo recomeça')
  g = { ...g, explodesAt: 5000 }
  g = B.tick(B.tick(g, 5000), 5000 + B.BOOM_MS)
  assert.equal(g.phase, 'over')
  assert.equal(g.winner, 'b')
  assert.equal(g.wins.b, 1)
  const r = B.applyAction(g, 'a', { type: 'rematch' }, 9000)
  assert.equal(r.phase, 'countdown')
  assert.equal(r.players.a.lives, 2)
  // bónus: falta só uma letra
  let h = playing(B.startGame(['a', 'b'], [], 0), 'a', 'ca')
  h = { ...h, order: ['a', 'b'], players: { ...h.players, a: { ...h.players.a, letters: B.ALPHABET.replace('s', ''), lives: 2 } } }
  h = B.applyAction(h, 'a', { type: 'word', text: 'casa' }, 10)
  assert.equal(h.players.a.lives, 3)
  assert.ok(h.last.bonus)
})

test('bomba: jogos só com bots acabam e os bots acertam quase sempre', () => {
  let oks = 0
  let fails = 0
  for (let k = 0; k < 6; k++) {
    const ids = ['bot0', 'bot1', 'bot2']
    let g = B.startGame(ids, ids, 0, Math.random, { level: 'medio' })
    let t = 0
    let lastAt = null
    while (g.phase !== 'over' && t < 30 * 60000) {
      t += 100
      g = B.tick(g, t)
      if (g.last && g.last.at !== lastAt) { lastAt = g.last.at; g.last.ok ? oks++ : fails++ }
    }
    assert.equal(g.phase, 'over')
  }
  assert.ok(oks > fails * 4, `${oks} certas, ${fails} erradas`)
})

test('bomba: online completa com bots até 2', () => {
  const g = B.bombaOnline.start([{ id: 'a' }], { bots: 0, lives: 3 }, 0)
  assert.equal(g.order.length, 2)
  assert.equal(g.players.a.lives, 3)
})
