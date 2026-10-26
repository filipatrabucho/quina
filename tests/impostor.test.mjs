import test from 'node:test'
import assert from 'node:assert/strict'
import { GRID, W, H, isFloor, STATIONS, BUTTON, ROOMS, startGame, applyAction, tick, actionsFor, taskProgress, impostorCount, impostorOnline } from '../src/games/impostor/impostorLogic.js'

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
