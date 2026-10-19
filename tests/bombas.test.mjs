import test from 'node:test'
import assert from 'node:assert/strict'
import { W, H, FUSE_MS, FLAME_MS, ROUND_MS, idx, startGame, nextRound, advance, applyInput, blastCells, bombasOnline } from '../src/games/bombas/bombasLogic.js'

// Arena vazia (só paredes) para testes controlados.
function emptyArena(ids, at = 0) {
  const g = startGame(ids, [], at)
  const cells = g.grid.split('').map((c) => (c === '+' ? '.' : c))
  return { ...g, grid: cells.join(''), hidden: {}, powers: {} }
}
const setCell = (g, x, y, c) => ({ ...g, grid: g.grid.slice(0, idx(x, y)) + c + g.grid.slice(idx(x, y) + 1) })
const place = (g, id, x, y) => ({ ...g, players: { ...g.players, [id]: { ...g.players[id], x, y } } })

test('arena: bordas e pilares de pedra, cantos livres', () => {
  const g = startGame(['a', 'b', 'c', 'd'])
  assert.equal(g.grid.length, W * H)
  for (let x = 0; x < W; x++) assert.equal(g.grid[idx(x, 0)], '#')
  assert.equal(g.grid[idx(2, 2)], '#')
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [W - 2, H - 2], [W - 3, H - 2], [W - 2, H - 3]]) assert.equal(g.grid[idx(x, y)], '.')
  assert.deepEqual([g.players.a.x, g.players.a.y], [1, 1])
  assert.deepEqual([g.players.b.x, g.players.b.y], [W - 2, H - 2])
})

test('movimento: anda, para nas paredes e respeita a velocidade', () => {
  let g = emptyArena(['a', 'b'])
  g = applyInput(g, 'a', { type: 'dir', dir: 'r' }, 1000)
  assert.equal(g.players.a.x, 2)
  g = advance(g, 1050) // ainda não passou o tempo de um passo
  assert.equal(g.players.a.x, 2)
  g = advance(g, 1200)
  assert.equal(g.players.a.x, 3)
  g = applyInput(g, 'a', { type: 'dir', dir: 'd' }, 1400) // (3,2) é pilar? não: 3 é ímpar
  assert.equal(g.players.a.y, 2)
  g = applyInput(g, 'a', { type: 'dir', dir: 'l' }, 1700) // (2,2) é pilar
  assert.equal(g.players.a.x, 3)
})

test('bomba: rebenta a caixa, mostra o prémio e elimina quem apanhar', () => {
  let g = emptyArena(['a', 'b'])
  g = setCell(g, 3, 1, '+')
  g = { ...g, hidden: { [idx(3, 1)]: 'r' } }
  g = place(g, 'b', 1, 3)
  g = applyInput(g, 'a', { type: 'bomb' }, 0)
  assert.equal(g.bombs.length, 1)
  assert.equal(applyInput(g, 'a', { type: 'bomb' }, 10), g, 'só 1 bomba de cada vez')
  const cells = blastCells(g, g.bombs[0]).map(([x, y]) => `${x},${y}`)
  assert.ok(cells.includes('3,1') && !cells.includes('4,1'), 'para na caixa')
  g = advance(g, FUSE_MS + 1)
  assert.equal(g.grid[idx(3, 1)], '.')
  assert.equal(g.powers[idx(3, 1)], 'r')
  assert.equal(g.players.a.alive, false)
  assert.equal(g.players.b.alive, false)
  assert.equal(g.over, true)
  assert.equal(g.winner, 'draw')
})

test('prémio: apanhar aumenta o alcance', () => {
  let g = emptyArena(['a', 'b'])
  g = { ...g, powers: { [idx(2, 1)]: 'r' } }
  g = applyInput(g, 'a', { type: 'dir', dir: 'r' }, 0)
  assert.equal(g.players.a.range, 3)
  assert.equal(g.powers[idx(2, 1)], undefined)
})

test('reação em cadeia e chamas que desaparecem', () => {
  let g = emptyArena(['a', 'b'])
  g = place(g, 'b', W - 2, H - 2)
  g = applyInput(g, 'a', { type: 'bomb' }, 0) // bomba em (1,1)
  g = place(g, 'a', 3, 1)
  g = { ...g, players: { ...g.players, a: { ...g.players.a, bombs: 2 } } }
  g = applyInput(g, 'a', { type: 'bomb' }, 2000) // bomba em (3,1), só explodiria em 4400
  g = place(g, 'a', 5, 3)
  g = advance(g, FUSE_MS + 1)
  assert.equal(g.bombs.length, 0, 'a segunda bomba rebentou em cadeia')
  assert.ok(g.flames.length > 0)
  assert.equal(g.players.a.alive, true)
  g = advance(g, FUSE_MS + FLAME_MS + 5)
  assert.equal(g.flames.length, 0)
})

test('fim de ronda: o último vivo ganha e soma ponto; nova ronda mantém o placar', () => {
  let g = emptyArena(['a', 'b'])
  g = place(g, 'b', 1, 2)
  g = place(g, 'a', 5, 5)
  g = { ...g, bombs: [{ id: 99, x: 1, y: 3, owner: 'a', at: 0, range: 2 }] }
  g = advance(g, 1)
  assert.equal(g.winner, 'a')
  assert.equal(g.score.a, 1)
  const r2 = nextRound(g, 5000)
  assert.equal(r2.round, 2)
  assert.equal(r2.score.a, 1)
  assert.equal(r2.over, false)
  assert.ok(Object.values(r2.players).every((p) => p.alive))
})

test('tempo esgotado com dois vivos é empate', () => {
  let g = emptyArena(['a', 'b'], 0)
  g = applyInput(g, 'a', { type: 'dir', dir: 'r' }, ROUND_MS + 1)
  g = advance(g, ROUND_MS + 2)
  assert.equal(g.over, true)
  assert.equal(g.winner, 'draw')
})

test('sala online: precisa de 2 (pessoas ou bots) e os bots entram na arena', () => {
  assert.throws(() => bombasOnline.start([{ id: 'h' }], { bots: 0 }, 0))
  const g = bombasOnline.start([{ id: 'h' }], { bots: 2 }, 0)
  assert.deepEqual(g.order, ['h', 'bot0', 'bot1'])
  assert.equal(g.players.bot0.bot, true)
  assert.equal(bombasOnline.reduce(g, { type: 'rematch' }, 'h', { now: 1 }), g, 'só depois do fim')
})

test('bots: partidas completas acabam e os bots não se matam logo', () => {
  let rounds = 0
  let survivalSum = 0
  for (let k = 0; k < 25; k++) {
    let g = startGame(['b0', 'b1', 'b2', 'b3'], ['b0', 'b1', 'b2', 'b3'], 0)
    let t = 0
    const deaths = {}
    while (!g.over && t <= ROUND_MS + 200) {
      t += 100
      g = advance(g, t)
      for (const id of g.order) if (!g.players[id].alive && deaths[id] == null) deaths[id] = t
    }
    assert.equal(g.over, true)
    rounds++
    const first = Math.min(...Object.values(deaths), t)
    survivalSum += first
  }
  const avgFirstDeath = survivalSum / rounds
  assert.ok(avgFirstDeath > 8000, `o primeiro bot morre em média aos ${Math.round(avgFirstDeath / 1000)} s`)
})

test('morte súbita: a arena fecha em espiral e esmaga quem lá estiver', async () => {
  const { SUDDEN_MS, DROP_MS } = await import('../src/games/bombas/bombasLogic.js')
  let g = emptyArena(['a', 'b'], 0)
  g = place(g, 'b', 6, 5)
  g = advance(g, SUDDEN_MS - 1)
  assert.equal(g.dropped, 0)
  g = advance(g, SUDDEN_MS + 1)
  assert.equal(g.grid[idx(1, 1)], '#', 'primeiro bloco cai no canto')
  assert.equal(g.players.a.alive, false, 'quem estava no canto foi esmagado')
  assert.equal(g.winner, 'b')
  let h = emptyArena(['a', 'b'], 0)
  h = place(h, 'a', 6, 5)
  h = place(h, 'b', 5, 5)
  h = advance(h, SUDDEN_MS + DROP_MS * 200)
  assert.equal(h.over, true)
})
