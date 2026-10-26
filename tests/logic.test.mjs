// Testes da lógica dos jogos (sem browser): node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as galo from '../src/games/galo/galoLogic.js'
import * as quatro from '../src/games/quatro/quatroLogic.js'
import { xadrezOnline, replay } from '../src/games/xadrez/xadrezLogic.js'
import { chooseMove } from '../src/games/xadrez/chessBot.js'
import { memesOnline } from '../src/games/memes/memesLogic.js'
import { reduceRoom } from '../src/lib/rooms/reduceRoom.js'

const A = { id: 'a', name: 'Ana' }
const B = { id: 'b', name: 'Bruno' }
const C = { id: 'c', name: 'Carla' }

test('galo: deteta vitória, empate e o bot perfeito nunca perde', () => {
  assert.equal(galo.winnerOf(['X', 'X', 'X', null, null, null, null, null, null]).mark, 'X')
  assert.equal(galo.winnerOf(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']).mark, 'empate')
  // Bot bloqueia uma vitória iminente
  assert.equal(galo.bestMove(['X', 'X', null, null, 'O', null, null, null, null], 'O'), 2)
  // Bot fecha a vitória
  assert.equal(galo.bestMove(['O', 'O', null, 'X', 'X', null, null, null, null], 'O'), 2)
  // 200 jogos aleatórios contra o bot difícil: nunca perde
  for (let g = 0; g < 200; g++) {
    const board = Array(9).fill(null)
    let turn = 'X'
    while (!galo.winnerOf(board)) {
      const free = board.map((c, i) => (c ? null : i)).filter((i) => i != null)
      const i = turn === 'O' ? galo.botMove(board, 'O', 'dificil') : free[Math.floor(Math.random() * free.length)]
      board[i] = turn
      turn = turn === 'X' ? 'O' : 'X'
    }
    assert.notEqual(galo.winnerOf(board).mark, 'X')
  }
})

test('galo online: turnos, vitória, placar e desforra', () => {
  let g = galo.galoOnline.start([A, B])
  assert.throws(() => galo.galoOnline.reduce(g, { type: 'move', index: 0 }, 'b'), /vez/)
  for (const [who, i] of [['a', 0], ['b', 3], ['a', 1], ['b', 4]]) g = galo.galoOnline.reduce(g, { type: 'move', index: i }, who)
  assert.throws(() => galo.galoOnline.reduce(g, { type: 'move', index: 0 }, 'a'), /inválida/)
  g = galo.galoOnline.reduce(g, { type: 'move', index: 2 }, 'a')
  assert.equal(g.result.winnerId, 'a')
  assert.deepEqual(g.result.line, [0, 1, 2])
  assert.equal(g.score.a, 1)
  g = galo.galoOnline.reduce(g, { type: 'rematch' }, 'b')
  assert.equal(g.marks.b, 'X')
  assert.equal(g.result, null)
})

test('4 em linha: gravidade, vitória diagonal, coluna cheia e bot', () => {
  let b = quatro.emptyBoard()
  // diagonal para o jogador 1
  const seq = [[0, 1], [1, 2], [1, 1], [2, 2], [2, 2], [2, 1], [3, 2], [3, 2], [3, 2], [3, 1]]
  for (const [c, p] of seq) b = quatro.play(b, c, p)
  const w = quatro.winnerOf(b)
  assert.equal(w.player, 1)
  assert.equal(w.cells.length, 4)
  let full = quatro.emptyBoard()
  for (let i = 0; i < 6; i++) full = quatro.play(full, 0, (i % 2) + 1)
  assert.equal(quatro.play(full, 0, 1), null)
  // Bot ganha quando pode e bloqueia quando tem de ser
  let t = quatro.emptyBoard()
  for (const c of [0, 1, 2]) t = quatro.play(t, c, 2)
  assert.equal(quatro.botMove(t, 2, 'medio'), 3)
  assert.equal(quatro.botMove(t, 1, 'medio'), 3)
  // Bot difícil responde em tempo útil
  const t0 = Date.now()
  quatro.botMove(quatro.emptyBoard(), 1, 'dificil')
  assert.ok(Date.now() - t0 < 3000)
})

test('4 em linha online', () => {
  let g = quatro.quatroOnline.start([A, B])
  for (const [who, c] of [['a', 0], ['b', 1], ['a', 0], ['b', 1], ['a', 0], ['b', 1]]) g = quatro.quatroOnline.reduce(g, { type: 'drop', col: c }, who)
  assert.throws(() => quatro.quatroOnline.reduce(g, { type: 'drop', col: 2 }, 'b'), /vez/)
  g = quatro.quatroOnline.reduce(g, { type: 'drop', col: 0 }, 'a')
  assert.equal(g.result.winnerId, 'a')
  g = quatro.quatroOnline.reduce(g, { type: 'rematch' }, 'a')
  assert.deepEqual(g.order, ['b', 'a'])
})

test('xadrez online: lances válidos, mate pastor, desistência e empate', () => {
  let g = xadrezOnline.start([A, B])
  assert.throws(() => xadrezOnline.reduce(g, { type: 'move', from: 'e7', to: 'e5' }, 'b'), /vez/)
  assert.throws(() => xadrezOnline.reduce(g, { type: 'move', from: 'e2', to: 'e5' }, 'a'), /inválido/)
  const mate = [['a', 'e2', 'e4'], ['b', 'e7', 'e5'], ['a', 'f1', 'c4'], ['b', 'b8', 'c6'], ['a', 'd1', 'h5'], ['b', 'g8', 'f6'], ['a', 'h5', 'f7']]
  for (const [who, from, to] of mate) g = xadrezOnline.reduce(g, { type: 'move', from, to }, who)
  assert.deepEqual(g.result, { winnerId: 'a', reason: 'xeque-mate' })
  assert.equal(g.moves.at(-1), 'Qxf7#')
  g = xadrezOnline.reduce(g, { type: 'rematch' }, 'b')
  assert.equal(g.white, 'b')
  g = xadrezOnline.reduce(g, { type: 'offerDraw' }, 'a')
  assert.equal(xadrezOnline.reduce(g, { type: 'acceptDraw' }, 'a').result, null)
  const drawn = xadrezOnline.reduce(g, { type: 'acceptDraw' }, 'b')
  assert.equal(drawn.result.reason, 'acordo')
  const resigned = xadrezOnline.reduce(g, { type: 'resign' }, 'b')
  assert.equal(resigned.result.winnerId, 'a')
  // promoção (por defeito, dama)
  let p = { ...xadrezOnline.start([A, B]) }
  const line = ['a4', 'h5', 'a5', 'h4', 'a6', 'h3', 'axb7', 'hxg2']
  p.moves = line
  p = xadrezOnline.reduce(p, { type: 'move', from: 'b7', to: 'a8' }, 'a')
  assert.equal(p.moves.at(-1), 'bxa8=Q')
  p = xadrezOnline.reduce(p, { type: 'move', from: 'g2', to: 'h1', promotion: 'n' }, 'b')
  assert.equal(p.moves.at(-1), 'gxh1=N')
  assert.equal(replay(p.moves).turn(), 'w')
})

test('bot de xadrez: encontra o mate e não oferece a dama', () => {
  const mateIn1 = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'
  assert.deepEqual(chooseMove(mateIn1, 'medio'), { from: 'h5', to: 'f7', promotion: undefined })
  // Dama branca atacada por um peão: o bot tira-a dali, sem a entregar
  const hanging = 'rnbqkbnr/pp1ppppp/8/2p5/3Q4/8/PPP1PPPP/RNB1KBNR w KQkq - 0 3'
  for (const level of ['medio', 'dificil']) {
    const m = chooseMove(hanging, level)
    assert.equal(m.from, 'd4')
    assert.ok(!['d7', 'g7'].includes(m.to), `entregou a dama em ${m.to}`)
  }
})

test('memes: rondas, votos, pontos e fim do jogo', () => {
  const templates = Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, name: `T${i}`, url: `x${i}`, boxes: 2 }))
  const ctx = (now, isHost = false) => ({ now, isHost })
  let g = memesOnline.start([A, B, C], { templates, settings: { rounds: 2 } }, 0)
  assert.equal(g.phase, 'writing')
  assert.equal(new Set(Object.values(g.templates).map((t) => t.id)).size, 3)
  const cap = (t) => [{ text: t, x: 50, y: 10 }, { text: '', x: 50, y: 90 }]
  g = memesOnline.reduce(g, { type: 'reroll' }, 'a', ctx(1))
  assert.throws(() => memesOnline.reduce(g, { type: 'reroll' }, 'a', ctx(1)), /uma vez/)
  g = memesOnline.reduce(g, { type: 'submit', captions: cap('a1'), done: true }, 'a', ctx(1))
  g = memesOnline.reduce(g, { type: 'submit', captions: cap('b1'), done: true }, 'b', ctx(1))
  // c só escreveu, não terminou: o tempo acaba e o meme dele conta na mesma
  g = memesOnline.reduce(g, { type: 'submit', captions: cap('c1'), done: false }, 'c', ctx(1))
  assert.equal(g.phase, 'writing')
  g = memesOnline.reduce(g, { type: 'tick' }, 'a', ctx(91000))
  assert.equal(g.phase, 'voting')
  assert.equal(g.order.length, 3)
  assert.throws(() => memesOnline.reduce(g, { type: 'vote', target: 'a' }, 'a', ctx(91001)), /próprio/)
  g = memesOnline.reduce(g, { type: 'vote', target: 'b' }, 'a', ctx(91001))
  g = memesOnline.reduce(g, { type: 'vote', target: 'b' }, 'c', ctx(91001))
  g = memesOnline.reduce(g, { type: 'vote', target: 'a' }, 'b', ctx(91001))
  assert.equal(g.phase, 'results')
  assert.equal(g.scores.b, 250)
  assert.equal(g.scores.a, 100)
  assert.equal(g.scores.c, 0)
  assert.throws(() => memesOnline.reduce(g, { type: 'next' }, 'b', ctx(91002, false)), /anfitrião/)
  g = memesOnline.reduce(g, { type: 'next' }, 'a', ctx(91002, true))
  assert.equal(g.phase, 'writing')
  assert.equal(g.round, 2)
  // Ronda sem memes escritos: salta a votação
  g = memesOnline.reduce(g, { type: 'tick' }, 'a', ctx(999999))
  assert.equal(g.phase, 'results')
  g = memesOnline.reduce(g, { type: 'tick' }, 'a', ctx(9999999))
  assert.equal(g.phase, 'final')
  g = memesOnline.reduce(g, { type: 'restart' }, 'a', ctx(9999999, true))
  assert.equal(g.round, 1)
  assert.equal(g.scores.b, 0)
})

test('sala: lobby, lotação, início e espectadores', () => {
  const logic = galo.galoOnline
  let s = { v: 1, code: 'X', hostId: 'a', status: 'lobby', maxPlayers: 2, players: [A], game: null }
  s = reduceRoom(s, { type: 'join', player: B }, 'b', logic)
  s = reduceRoom(s, { type: 'join', player: C }, 'c', logic)
  assert.deepEqual(s.players.map((p) => p.id), ['a', 'b'])
  assert.throws(() => reduceRoom(s, { type: 'start' }, 'b', logic), /anfitrião/)
  s = reduceRoom(s, { type: 'start' }, 'a', logic)
  assert.equal(s.status, 'playing')
  assert.throws(() => reduceRoom(s, { type: 'move', index: 0 }, 'c', logic), /espectador/)
  s = reduceRoom(s, { type: 'move', index: 4 }, 'a', logic)
  assert.equal(s.game.board[4], 'X')
})

import { emptyInput, typeLetter, backspace, setCursor, moveCursor, isFull, toWord } from '../src/games/palavras/utils/guessInput.js'

test('palavras: escrever letras em qualquer casa (_ _ A _ _)', () => {
  let s = setCursor(emptyInput(), 2)
  s = typeLetter(s, 'A')
  assert.deepEqual(s.slots, ['', '', 'A', '', ''])
  assert.equal(s.cursor, 3) // avança para a próxima vazia
  s = typeLetter(s, 'T')
  s = typeLetter(s, 'O')
  assert.equal(s.cursor, 0) // volta à primeira vazia
  s = typeLetter(s, 'P')
  s = typeLetter(s, 'R')
  assert.equal(toWord(s), 'PRATO')
  assert.ok(isFull(s))
  // apagar: limpa a casa do cursor; se estiver vazia, recua e limpa
  s = setCursor(s, 2)
  s = backspace(s)
  assert.deepEqual(s.slots, ['P', 'R', '', 'T', 'O'])
  s = backspace(s)
  assert.deepEqual(s.slots, ['P', '', '', 'T', 'O'])
  assert.equal(s.cursor, 1)
  assert.equal(moveCursor(s, -5).cursor, 0)
  assert.equal(moveCursor(s, 9).cursor, 4)
})

import * as naval from '../src/games/naval/navalLogic.js'
import { stopOnline, scoreRound, normalize } from '../src/games/stop/stopLogic.js'
import * as cartas from '../src/games/cartas/cartasLogic.js'

test('batalha naval: frota válida, tiros, afundar e bot', () => {
  const fleet = naval.randomFleet()
  assert.ok(naval.validateFleet(fleet))
  const bad = fleet.map((s) => ({ ...s, cells: [...s.cells] }))
  bad[0].cells = bad[1].cells.slice(0, 5).concat([0, 1, 2, 3, 4]).slice(0, 5)
  assert.equal(naval.validateFleet(bad), false)
  // navios não se tocam
  const a = naval.canPlace([{ key: 'x', cells: [0, 1] }], 2, 11, true)
  assert.equal(a, null)
  let g = naval.navalOnline.start([{ id: 'a' }, { id: 'b' }])
  g = naval.navalOnline.reduce(g, { type: 'fleet', fleet }, 'a')
  assert.equal(g.phase, 'colocar')
  g = naval.navalOnline.reduce(g, { type: 'fleet', fleet: naval.randomFleet() }, 'b')
  assert.equal(g.phase, 'jogar')
  assert.throws(() => naval.navalOnline.reduce(g, { type: 'shoot', cell: 0 }, 'b'), /vez/)
  // a afunda todos os navios de b (b falha sempre num canto já usado pelo bot)
  const targets = g.fleets.b.flatMap((s) => s.cells)
  const bShots = []
  for (let k = 0; k < targets.length; k++) {
    g = naval.navalOnline.reduce(g, { type: 'shoot', cell: targets[k] }, 'a')
    if (g.phase === 'fim') break
    const miss = naval.botShot(g.shots.b)
    bShots.push(miss)
    g = naval.navalOnline.reduce(g, { type: 'shoot', cell: miss }, 'b')
    if (g.phase === 'fim') break
  }
  assert.equal(g.winner, 'a')
  assert.ok(g.shots.a.some((s) => s.sunk))
  assert.throws(() => naval.applyShot(g.shots.a, g.fleets.b, targets[0]), /Já disparaste/)
  // o bot persegue um navio depois de acertar
  const f2 = [{ key: 'porta-avioes', cells: [44, 45, 46, 47, 48] }]
  const shots = [{ i: 45, hit: true }]
  const nextShot = naval.botShot(shots)
  assert.ok([35, 55, 44, 46].includes(nextShot))
  assert.ok(f2)
})

test('stop: rondas, STOP, contestar e pontuação', () => {
  const A = { id: 'a' }, B = { id: 'b' }, C = { id: 'c' }
  let g = stopOnline.start([A, B, C], { settings: { rounds: 1, seconds: 60 } }, 0)
  assert.equal(g.phase, 'escrever')
  const L = g.letter
  const word = (w) => L + w
  const full = (suffix) => Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => [i, word(suffix + i)]))
  assert.throws(() => stopOnline.reduce(g, { type: 'stop', answers: { 0: word('x') } }, 'a', { now: 1 }), /Preenche/)
  g = stopOnline.reduce(g, { type: 'answers', answers: { ...full('comum'), 5: '' } }, 'b', { now: 1 })
  g = stopOnline.reduce(g, { type: 'answers', answers: { 0: 'Zzz' } }, 'c', { now: 1 })
  g = stopOnline.reduce(g, { type: 'stop', answers: full('comum') }, 'a', { now: 2 })
  assert.equal(g.phase, 'rever')
  assert.equal(g.stoppedBy, 'a')
  // respostas ainda entram durante a tolerância
  g = stopOnline.reduce(g, { type: 'answers', answers: { ...full('comum'), 1: word('unico'), 5: '' } }, 'b', { now: 3 })
  // depois da tolerância já não
  const late = stopOnline.reduce(g, { type: 'answers', answers: full('tarde') }, 'c', { now: 99999 })
  assert.equal(late.answers.c[0], 'Zzz')
  // b e c contestam a resposta 0 de a
  g = stopOnline.reduce(g, { type: 'contest', target: 'a', cat: 0 }, 'b', { now: 4 })
  assert.throws(() => stopOnline.reduce(g, { type: 'next' }, 'b', { now: 5, isHost: false }), /anfitrião/)
  g = stopOnline.reduce(g, { type: 'next' }, 'a', { now: 5, isHost: true })
  assert.equal(g.phase, 'resultados')
  // a: cat0 contestada (0), cat1 igual a... b mudou cat1 => a única válida em 1? b tem unico, a tem comum1 -> diferentes => 10 cada
  // cat 2..4 iguais a b => 5 ; cat5: b vazio => a única => 20
  assert.equal(g.roundDetail.a[0], 0)
  assert.equal(g.roundDetail.a[1], 10)
  assert.equal(g.roundDetail.a[2], 5)
  assert.equal(g.roundDetail.a[5], 20)
  assert.equal(g.roundDetail.c[0], 0) // não começa pela letra
  assert.equal(normalize('  Ção  Évora '), 'cao evora')
  g = stopOnline.reduce(g, { type: 'next' }, 'a', { now: 6, isHost: true })
  assert.equal(g.phase, 'final')
  assert.ok(scoreRound)
})

test('cartas coloridas: baralho, jogar, +2, inverter, comprar e ganhar', () => {
  assert.equal(cartas.buildDeck().length, 108)
  let g = cartas.startGame(['a', 'b', 'c'])
  assert.equal(g.hands.a.length, 7)
  assert.ok(/^\d$/.test(g.discard[0].value))
  // Força uma situação conhecida
  const top = { id: 900, color: 'r', value: '5' }
  g = { ...g, discard: [top], color: 'r', turn: 0, direction: 1, hands: {
    a: [{ id: 901, color: 'r', value: '+2' }, { id: 902, color: 'b', value: '7' }, { id: 903, color: null, value: 'cor' }],
    b: [{ id: 904, color: 'r', value: 'inverter' }, { id: 905, color: 'g', value: '1' }],
    c: [{ id: 906, color: 'y', value: '2' }],
  } }
  assert.throws(() => cartas.playCard(g, 'a', 902), /não serve/)
  assert.throws(() => cartas.playCard(g, 'b', 904), /vez/)
  g = cartas.playCard(g, 'a', 901) // +2 em b: b compra 2 e perde a vez
  assert.equal(g.hands.b.length, 4)
  assert.equal(cartas.currentPlayer(g), 'c')
  assert.throws(() => cartas.playCard(g, 'c', 906), /não serve/)
  const beforeLen = g.hands.c.length
  g = cartas.drawCard(g, 'c')
  assert.equal(g.hands.c.length, beforeLen + 1)
  if (g.drawnThisTurn != null) g = cartas.passTurn(g, 'c')
  assert.equal(cartas.currentPlayer(g), 'a')
  assert.throws(() => cartas.playCard(g, 'a', 903), /Escolhe uma cor/)
  g = cartas.playCard(g, 'a', 903, 'g')
  assert.equal(g.color, 'g')
  // b inverte (com 3 jogadores muda o sentido)
  const inv = g.hands.b.find((c) => c.value === 'inverter')
  g = { ...g, color: 'r' }
  g = cartas.playCard(g, 'b', inv.id)
  assert.equal(g.direction, -1)
  assert.equal(cartas.currentPlayer(g), 'a')
  // ganhar
  g = { ...g, hands: { ...g.hands, a: [{ id: 950, color: null, value: 'cor' }] } }
  g = cartas.playCard(g, 'a', 950, 'b')
  assert.equal(g.winner, 'a')
  assert.equal(g.score.a, 1)
  // bots conseguem jogar uma partida inteira até ao fim
  for (let n = 0; n < 20; n++) {
    let s = cartas.startGame(['x', 'y', 'z', 'w'])
    for (let k = 0; k < 2000 && !s.winner; k++) {
      const p = cartas.currentPlayer(s)
      s = cartas.applyMove(s, p, cartas.botMove(s, p))
    }
    assert.ok(s.winner, 'partida de bots chega ao fim')
    const total = s.drawPile.length + s.discard.length + Object.values(s.hands).reduce((a, h) => a + h.length, 0)
    assert.equal(total, 108, 'nenhuma carta se perde')
  }
})

test('cartas coloridas: várias cartas com o mesmo número de uma vez', () => {
  let g = cartas.startGame(['a', 'b'])
  g = { ...g, discard: [{ id: 900, color: 'r', value: '5' }], color: 'r', turn: 0, direction: 1, drawnThisTurn: null, hands: {
    a: [{ id: 1, color: 'b', value: '5' }, { id: 2, color: 'g', value: '5' }, { id: 3, color: 'y', value: '7' }, { id: 4, color: 'y', value: '5' }],
    b: [{ id: 10, color: 'g', value: '1' }],
  } }
  assert.throws(() => cartas.playCard(g, 'a', 1, undefined, [3]), /mesmo número/)
  assert.throws(() => cartas.playCard(g, 'a', 1, undefined, [99]), /Não tens/)
  assert.throws(() => cartas.playCard(g, 'a', 3, undefined, []), /não serve/) // a primeira tem de servir
  const n = cartas.playCard(g, 'a', 1, undefined, [2, 4])
  assert.deepEqual(n.hands.a.map((c) => c.id), [3])
  assert.deepEqual(n.discard.slice(-3).map((c) => c.id), [1, 2, 4])
  assert.equal(n.color, 'y') // manda a última
  assert.equal(n.lastAction.count, 3)
  assert.equal(cartas.currentPlayer(n), 'b')
  // ficar sem cartas ao jogar várias ganha
  const w = cartas.playCard({ ...g, hands: { ...g.hands, a: [{ id: 1, color: 'b', value: '5' }, { id: 2, color: 'g', value: '5' }] } }, 'a', 2, undefined, [1])
  assert.equal(w.winner, 'a')
  // só números
  const act = { ...g, discard: [{ id: 900, color: 'r', value: '+2' }], hands: { ...g.hands, a: [{ id: 5, color: 'r', value: '+2' }, { id: 6, color: 'b', value: '+2' }] } }
  assert.throws(() => cartas.playCard(act, 'a', 5, undefined, [6]), /mesmo número/)
  // o bot junta as do mesmo número e deixa em cima a cor de que tem mais
  const m = cartas.botMove(g, 'a')
  const after = cartas.applyMove(g, 'a', m)
  assert.deepEqual(after.hands.a.map((c) => c.id), [3])
  assert.equal(after.color, 'y')
  // jogos inteiros só com bots continuam a acabar
  for (let k = 0; k < 30; k++) {
    let x = cartas.startGame(['a', 'b', 'c'])
    for (let t = 0; t < 3000 && !x.winner; t++) { const p = cartas.currentPlayer(x); x = cartas.applyMove(x, p, cartas.botMove(x, p)) }
    assert.ok(x.winner, 'o jogo acaba')
  }
})
