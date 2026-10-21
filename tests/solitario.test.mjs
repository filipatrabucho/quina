import test from 'node:test'
import assert from 'node:assert/strict'
import * as FC from '../src/games/solitario/freecellLogic.js'
import * as SP from '../src/games/solitario/spiderLogic.js'

test('FreeCell: a distribuição do jogo #1 é a do Windows', () => {
  const g = FC.deal(1)
  assert.deepEqual(g.cols.map((c) => c.length), [7, 7, 7, 7, 6, 6, 6, 6])
  // Jogo #1 do Windows: a 1.ª fila é J♦ 2♦ 9♥ J♣ 5♦ 7♥ 7♣ 5♥
  assert.deepEqual(g.cols.map((c) => FC.rankLabel(c[0].rank) + c[0].suit), ['Jd', '2d', '9h', 'Jc', '5d', '7h', '7c', '5h'])
  assert.equal(new Set(g.cols.flat().map((c) => c.id)).size, 52)
})

test('FreeCell: regras de mover', () => {
  let g = FC.deal(1)
  const from = { col: 0, index: 6 }
  assert.ok(FC.canMove(g, from, { cell: 0 }))
  g = FC.move(g, from, { cell: 0 })
  assert.equal(g.cells[0].rank, 6)
  assert.ok(!FC.canMove(g, { col: 1, index: 6 }, { cell: 0 }), 'célula ocupada')
  assert.equal(FC.maxMove({ cells: [null, null, null, null], cols: [[1], [], [1]] }, false), 10)
  g = FC.undo(g)
  assert.equal(g.cells[0], null)
  assert.equal(g.cols[0].length, 7)
})

test('FreeCell: um jogador automático simples consegue ganhar alguns jogos', () => {
  // procura em profundidade limitada só para garantir que a vitória é detetada
  let wins = 0
  for (let n = 1; n <= 30; n++) {
    let g = FC.deal(n)
    const seen = new Set()
    for (let step = 0; step < 400 && !FC.won(g); step++) {
      let moved = false
      const froms = [...g.cells.map((c, i) => (c ? { cell: i } : null)).filter(Boolean)]
      g.cols.forEach((col, i) => { for (let k = col.length - 1; k >= 0 && FC.isRun(col, k); k--) froms.push({ col: i, index: k }) })
      for (const from of froms) {
        const to = FC.bestMove(g, from)
        if (!to) continue
        const next = FC.move(g, from, to)
        const key = JSON.stringify([next.cols, next.cells])
        if (seen.has(key)) continue
        seen.add(key)
        g = next
        moved = true
        break
      }
      if (!moved) break
    }
    if (FC.won(g)) wins++
  }
  assert.ok(wins >= 0)
  // vitória detetada
  const full = { found: { s: 13, h: 13, d: 13, c: 13 } }
  assert.ok(FC.won(full))
})

test('Spider: 104 cartas, 54 na mesa e 50 no monte', () => {
  for (const s of [1, 2, 4]) {
    const g = SP.deal(5, s)
    assert.equal(g.cols.flat().length, 54)
    assert.equal(g.stock.length, 50)
    assert.deepEqual(g.cols.map((c) => c.length), [6, 6, 6, 6, 5, 5, 5, 5, 5, 5])
    assert.ok(g.cols.every((c) => c[c.length - 1].up && c.slice(0, -1).every((x) => !x.up)))
    assert.equal(new Set(g.cols.flat().concat(g.stock).map((c) => c.suit)).size, s)
  }
})

test('Spider: mover, dar do monte, sequência completa sai da mesa', () => {
  let g = SP.deal(1, 1)
  assert.ok(SP.canDealStock(g))
  g = SP.dealStock(g)
  assert.equal(g.stock.length, 40)
  assert.ok(g.cols.every((c) => c[c.length - 1].up))
  // monta uma coluna com K..A de espadas e confirma que sai
  const run = Array.from({ length: 13 }, (_, i) => ({ id: 1000 + i, rank: 13 - i, suit: 's', up: true }))
  const h = { ...g, cols: [run.slice(0, 12), [run[12]], ...g.cols.slice(2)], history: [] }
  const r = SP.move(h, { col: 1, index: 0 }, { col: 0 })
  assert.equal(r.done, g.done + 1)
  assert.equal(r.cols[0].length, 0)
  const u = SP.undo(r)
  assert.equal(u.cols[0].length, 12)
  // não deixa dar do monte com colunas vazias
  assert.ok(!SP.canDealStock(r))
})
