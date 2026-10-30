import test from 'node:test'
import assert from 'node:assert/strict'
import { GRID, W, H, isFloor, STATIONS, BUTTON, ROOMS, startGame, applyAction, tick, actionsFor, taskProgress, impostorCount, impostorOnline } from '../src/games/impostor/impostorLogic.js'
import * as L from '../src/games/impostor/impostorLogic.js'

test('mapa: todas as salas ligadas e as tarefas em sítios onde se chega', () => {
  assert.equal(GRID.length, H)
  assert.ok(GRID.every((r) => r.length === W))
  // flood fill a partir do botão
  const seen = new Set([`${BUTTON.x},${BUTTON.y}`])
  const q = [[BUTTON.x, BUTTON.y]]
  while (q.length) {
    const [x, y] = q.shift()
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`
      if (isFloor(x + dx, y + dy) && !seen.has(k)) { seen.add(k); q.push([x + dx, y + dy]) }
    }
  }
  for (const s of STATIONS) assert.ok(seen.has(`${s.x},${s.y}`), s.name)
  for (const r of ROOMS) assert.ok(seen.has(`${r.x},${r.y}`), r.name)
})

test('papéis: 1 impostor até 7 jogadores, 2 a partir de 8', () => {
  assert.equal(impostorCount(5), 1)
  assert.equal(impostorCount(8), 2)
  const g = startGame(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], [], 0)
  assert.equal(Object.values(g.players).filter((p) => p.role === 'impostor').length, 2)
  assert.throws(() => startGame(['a', 'b', 'c'], [], 0), /pelo menos 4/)
})

test('matar, reportar, votar e expulsar', () => {
  let g = startGame(['a', 'b', 'c', 'd', 'e'], [], 0, () => 0.1)
  g = tick(g, 5000) // acaba a apresentação dos papéis
  assert.equal(g.phase, 'play')
  const imp = g.order.find((id) => g.players[id].role === 'impostor')
  const [v, w] = g.order.filter((id) => id !== imp)
  // põe o impostor ao lado da vítima, longe dos outros
  g.players[imp] = { ...g.players[imp], x: 2, y: 2, killReady: 0 }
  g.players[v] = { ...g.players[v], x: 3, y: 2 }
  assert.equal(actionsFor(g, imp, 40000).kill, v)
  g = applyAction(g, imp, { type: 'kill' }, 40000)
  assert.equal(g.players[v].alive, false)
  assert.equal(g.bodies.length, 1)
  assert.ok(actionsFor(g, imp, 40001).killIn > 0, 'tempo de espera depois de matar')
  // outro tripulante encontra o corpo
  g.players[w] = { ...g.players[w], x: 4, y: 2 }
  g = applyAction(g, w, { type: 'report' }, 41000)
  assert.equal(g.phase, 'meeting')
  // todos os vivos votam no impostor
  for (const id of g.order.filter((x) => g.players[x].alive)) g = applyAction(g, id, { type: 'vote', target: id === imp ? w : imp }, 42000)
  assert.equal(g.phase, 'eject')
  assert.equal(g.eject.id, imp)
  assert.equal(g.eject.wasImpostor, true)
  g = tick(g, 42000 + 7000)
  assert.equal(g.phase, 'over')
  assert.equal(g.winner, 'crew')
})

test('empate na votação: ninguém sai; tarefas todas feitas: ganha a tripulação', () => {
  let g = startGame(['a', 'b', 'c', 'd'], [], 0, () => 0.3)
  g = tick(g, 5000)
  const someone = g.order[0]
  g.players[someone] = { ...g.players[someone], x: BUTTON.x, y: BUTTON.y }
  g = applyAction(g, someone, { type: 'emergency' }, 6000)
  const ids = g.order
  g = applyAction(g, ids[0], { type: 'vote', target: ids[1] }, 7000)
  g = applyAction(g, ids[1], { type: 'vote', target: ids[0] }, 7000)
  g = applyAction(g, ids[2], { type: 'vote', target: 'skip' }, 7000)
  g = applyAction(g, ids[3], { type: 'vote', target: 'skip' }, 7000)
  assert.equal(g.eject.id, null)
  g = tick(g, 14000)
  assert.equal(g.phase, 'play')
  // fazer todas as tarefas
  for (const id of g.order) if (g.players[id].role === 'crew') g.players[id].done = g.players[id].tasks.slice()
  g = tick(g, 15000)
  assert.equal(g.winner, 'crew')
  assert.ok(taskProgress(g).done === taskProgress(g).total)
})

test('jogos só com bots acabam com um vencedor', () => {
  const results = { crew: 0, impostor: 0 }
  for (let k = 0; k < 12; k++) {
    const ids = Array.from({ length: k % 2 ? 6 : 9 }, (_, i) => `bot${i}`)
    let g = startGame(ids, ids, 0, Math.random, { killCooldown: 15000, meetingMs: 20000 })
    let t = 0
    while (g.phase !== 'over' && t < 30 * 60000) {
      t += 100
      g = tick(g, t)
    }
    assert.equal(g.phase, 'over', 'o jogo acaba')
    results[g.winner]++
  }
  assert.ok(results.crew + results.impostor === 12)
})

test('online: junta bots até 10', () => {
  const g = impostorOnline.start([{ id: 'x' }, { id: 'y' }], { bots: 20 }, 0)
  assert.equal(g.order.length, 10)
})

test('impostor: condutas (entrar, mudar, sair, escondido, reunião tira de lá)', () => {
  for (const v of L.VENTS) {
    assert.ok(L.isFloor(v.x, v.y), `${v.id} no chão`)
    assert.equal(v.links.length, 2)
    assert.ok(!L.STATIONS.some((s) => s.x === v.x && s.y === v.y), `${v.id} não está em cima de uma tarefa`)
  }
  const ids = ['a', 'b', 'c', 'd', 'e']
  let g = L.startGame(ids, [], 0, () => 0.1)
  g = L.tick(g, L.ROLE_MS + 1)
  const imp = ids.find((id) => g.players[id].role === 'impostor')
  const crew = ids.find((id) => g.players[id].role === 'crew')
  const v = L.VENTS[0]
  g = { ...g, players: { ...g.players, [imp]: { ...g.players[imp], x: v.x, y: v.y }, [crew]: { ...g.players[crew], x: v.x, y: v.y } } }
  const now = L.ROLE_MS + 2
  assert.equal(L.actionsFor(g, crew, now).vent, null, 'tripulantes não usam condutas')
  assert.throws(() => L.applyAction(g, crew, { type: 'vent' }, now), /conduta/)
  assert.equal(L.actionsFor(g, imp, now).vent, v.id)
  g = L.applyAction(g, imp, { type: 'vent' }, now)
  assert.equal(g.players[imp].vent, v.id)
  const inside = L.actionsFor(g, imp, now)
  assert.equal(inside.inVent, v.id)
  assert.equal(inside.kill, null)
  assert.throws(() => L.applyAction(g, imp, { type: 'ventMove', to: L.VENTS[4].id }, now), /ligada/)
  const to = L.ventById(v.links[0])
  g = L.applyAction(g, imp, { type: 'ventMove', to: to.id }, now)
  assert.deepEqual([g.players[imp].x, g.players[imp].y], [to.x, to.y])
  g = L.applyAction(g, imp, { type: 'dir', dir: 'd' }, now + 500)
  assert.deepEqual([g.players[imp].x, g.players[imp].y], [to.x, to.y], 'dentro da conduta não anda')
  g = L.applyAction(g, imp, { type: 'vent' }, now + 600)
  assert.equal(g.players[imp].vent, null)
  g = L.applyAction(g, imp, { type: 'vent' }, now + 700)
  g = { ...g, players: { ...g.players, [crew]: { ...g.players[crew], x: L.BUTTON.x, y: L.BUTTON.y + 1 } } }
  g = L.applyAction(g, crew, { type: 'emergency' }, now + 800)
  assert.equal(g.phase, 'meeting')
  assert.equal(g.players[imp].vent, null, 'a reunião tira toda a gente das condutas')
})

test('impostor: cores e chapéus escolhidos, repetidos não, mantêm-se na desforra', () => {
  const ids = ['a', 'b', 'c', 'd']
  const g = L.startGame(ids, [], 0, Math.random, { looks: { a: { color: 3, hat: 'coroa' }, b: { color: 3, hat: 'nada' }, c: { color: 99 } } })
  assert.equal(g.players.a.color, 3)
  assert.equal(g.players.a.hat, 'coroa')
  assert.notEqual(g.players.b.color, 3, 'cor já escolhida por outro')
  assert.equal(g.players.b.hat, null)
  assert.equal(new Set(ids.map((id) => g.players[id].color)).size, 4)
  const over = { ...g, phase: 'over', winner: 'crew' }
  const r = L.applyAction(over, 'a', { type: 'rematch' }, 1000)
  assert.equal(r.players.a.color, 3)
  assert.equal(r.players.a.hat, 'coroa')
  // online: tempos da sala e preferências do lobby
  const o = L.impostorOnline.start([{ id: 'a', prefs: { color: 5, hat: 'chef' } }, { id: 'b' }], { bots: 3, killCooldown: 10, meeting: 90 }, 0)
  assert.equal(o.cfg.killCooldown, 10000)
  assert.equal(o.cfg.meetingMs, 90000)
  assert.equal(o.players.a.color, 5)
  assert.equal(o.players.a.hat, 'chef')
  const d = L.impostorOnline.start([{ id: 'a' }], { bots: 3, killCooldown: 7 }, 0)
  assert.equal(d.cfg.killCooldown, L.KILL_COOLDOWN_MS, 'valor inválido usa o normal')
})

test('impostor: falar na reunião convence os bots', () => {
  const ids = ['tu', 'bot0', 'bot1', 'bot2', 'bot3', 'bot4']
  let g = L.startGame(ids, ids.slice(1), 0, () => 0.99)
  // fixa papéis: bot0 é o impostor
  for (const id of ids) g.players[id].role = id === 'bot0' ? 'impostor' : 'crew'
  g = L.tick(g, L.ROLE_MS + 1)
  const t = L.ROLE_MS + 10
  g = { ...g, players: { ...g.players, tu: { ...g.players.tu, x: L.BUTTON.x, y: L.BUTTON.y + 1 } } }
  g = L.applyAction(g, 'tu', { type: 'emergency' }, t)
  assert.equal(g.phase, 'meeting')
  assert.throws(() => L.applyAction(g, 'tu', { type: 'say', kind: 'saw' }, t), /de quem/)
  assert.throws(() => L.applyAction(g, 'tu', { type: 'say', kind: 'saw', target: 'tu' }, t), /outra pessoa/)
  g = L.applyAction(g, 'tu', { type: 'say', kind: 'saw', target: 'bot0' }, t + 100, () => 0.1)
  const chat = g.meeting.chat
  assert.ok(chat.some((m) => m.by === 'tu' && m.kind === 'saw' && m.target === 'bot0'))
  assert.ok(chat.some((m) => m.by === 'bot0' && m.kind === 'deny'), 'o acusado defende-se')
  // os bots votam (depois de dar tempo) e expulsam quem eu acusei
  g = L.applyAction(g, 'tu', { type: 'vote', target: 'bot0' }, t + 200)
  let now = t + 300
  while (g.phase === 'meeting' && now < t + 120000) { now += 100; g = L.tick(g, now, () => 0.05) }
  assert.equal(g.eject.id, 'bot0', 'votaram como eu disse: ' + JSON.stringify(g.eject.votes))
  // limite de frases
  let h = L.startGame(ids, ids.slice(1), 0, () => 0.99)
  h = L.tick(h, L.ROLE_MS + 1)
  h = { ...h, players: { ...h.players, tu: { ...h.players.tu, x: L.BUTTON.x, y: L.BUTTON.y + 1 } } }
  h = L.applyAction(h, 'tu', { type: 'emergency' }, t)
  for (const [k, who] of [['accuse', 'bot1'], ['accuse', 'bot2'], ['safe', 'bot3'], ['skip', null]]) h = L.applyAction(h, 'tu', { type: 'say', kind: k, target: who }, t + 1)
  assert.throws(() => L.applyAction(h, 'tu', { type: 'say', kind: 'deny' }, t + 2), /disseste/)
})

test('impostor: o bot impostor não persegue quem está acompanhado e desiste ao fim de um tempo', () => {
  const ids = ['tu', 'amigo', 'bot0', 'bot1', 'bot2']
  let g = L.startGame(ids, ['bot0', 'bot1', 'bot2'], 0, () => 0.99)
  for (const id of ids) g.players[id].role = id === 'bot0' ? 'impostor' : 'crew'
  g = L.tick(g, L.ROLE_MS + 1)
  const put = (id, x, y) => { g = { ...g, players: { ...g.players, [id]: { ...g.players[id], x, y } } } }
  // eu e um amigo juntos na Cozinha; o impostor no Refeitório pronto a matar; os outros bots longe
  put('tu', 3, 3); put('amigo', 4, 3); put('bot0', 13, 3); put('bot1', 28, 17); put('bot2', 27, 17)
  g = { ...g, players: { ...g.players, bot0: { ...g.players.bot0, killReady: 0, bot: { ...g.players.bot0.bot, nextHunt: 0 } } } }
  let now = L.ROLE_MS + 100
  g = L.tick(g, now)
  assert.equal(g.players.bot0.bot.target, null, 'não escolhe quem está acompanhado')
  // fico sozinho: passa a ser alvo
  put('amigo', 2, 17)
  now += 1100; g = L.tick(g, now)
  assert.equal(g.players.bot0.bot.target, 'tu')
  // o amigo volta para perto: desiste e deixa-me em paz um bocado
  put('amigo', 3, 4)
  now += 100; g = L.tick(g, now)
  assert.equal(g.players.bot0.bot.target, null)
  assert.equal(g.players.bot0.bot.skip.id, 'tu')
})
