export const SIZE = 10
export const SHIPS = [
  { key: 'porta-avioes', name: 'Porta-aviões', size: 5 },
  { key: 'couracado', name: 'Couraçado', size: 4 },
  { key: 'cruzador', name: 'Cruzador', size: 3 },
  { key: 'submarino', name: 'Submarino', size: 3 },
  { key: 'contratorpedeiro', name: 'Contratorpedeiro', size: 2 },
]
export const TOTAL_CELLS = SHIPS.reduce((a, s) => a + s.size, 0)

export const rc = (i) => [Math.floor(i / SIZE), i % SIZE]
export const idx = (r, c) => r * SIZE + c

export function shipCells(start, size, horizontal) {
  const [r, c] = rc(start)
  const cells = []
  for (let k = 0; k < size; k++) {
    const rr = horizontal ? r : r + k
    const cc = horizontal ? c + k : c
    if (rr >= SIZE || cc >= SIZE) return null
    cells.push(idx(rr, cc))
  }
  return cells
}

// Os navios não se podem tocar (nem na diagonal).
function blockedCells(fleet) {
  const blocked = new Set()
  for (const ship of fleet) {
    for (const cell of ship.cells) {
      const [r, c] = rc(cell)
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr
          const cc = c + dc
          if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) blocked.add(idx(rr, cc))
        }
      }
    }
  }
  return blocked
}

export function canPlace(fleet, size, start, horizontal) {
  const cells = shipCells(start, size, horizontal)
  if (!cells) return null
  const blocked = blockedCells(fleet)
  return cells.some((c) => blocked.has(c)) ? null : cells
}

export function randomFleet(rand = Math.random) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const fleet = []
    let ok = true
    for (const ship of SHIPS) {
      let placed = false
      for (let t = 0; t < 300 && !placed; t++) {
        const horizontal = rand() < 0.5
        const start = Math.floor(rand() * SIZE * SIZE)
        const cells = canPlace(fleet, ship.size, start, horizontal)
        if (cells) {
          fleet.push({ key: ship.key, cells })
          placed = true
        }
      }
      if (!placed) {
        ok = false
        break
      }
    }
    if (ok) return fleet
  }
  throw new Error('Não foi possível gerar a frota.')
}

export function validateFleet(fleet) {
  if (!Array.isArray(fleet) || fleet.length !== SHIPS.length) return false
  const placed = []
  for (const ship of SHIPS) {
    const f = fleet.find((x) => x.key === ship.key)
    if (!f || !Array.isArray(f.cells) || f.cells.length !== ship.size) return false
    const sorted = [...f.cells].sort((a, b) => a - b)
    const horizontal = sorted.length < 2 || sorted[1] - sorted[0] === 1
    const cells = canPlace(placed, ship.size, sorted[0], horizontal)
    if (!cells || cells.join() !== sorted.join()) return false
    placed.push({ key: ship.key, cells })
  }
  return true
}

// Resultado de um tiro: { hit, sunk: key|null, allSunk }
export function fire(fleet, shots, cell) {
  const ship = fleet.find((s) => s.cells.includes(cell))
  if (!ship) return { hit: false, sunk: null, allSunk: false }
  const hitSet = new Set([...shots.filter((s) => s.hit).map((s) => s.i), cell])
  const sunk = ship.cells.every((c) => hitSet.has(c)) ? ship.key : null
  const allSunk = fleet.every((s) => s.cells.every((c) => hitSet.has(c)))
  return { hit: true, sunk, allSunk }
}

// ---- Bot: procura ao acaso (em xadrez) e, depois de acertar, persegue o navio.
export function botShot(shots, rand = Math.random) {
  const done = new Set(shots.map((s) => s.i))
  const sunkCells = new Set(shots.filter((s) => s.sunkCells).flatMap((s) => s.sunkCells))
  const openHits = shots.filter((s) => s.hit && !sunkCells.has(s.i)).map((s) => s.i)
  const free = (i) => i >= 0 && i < SIZE * SIZE && !done.has(i)
  if (openHits.length) {
    const neighbours = (i) => {
      const [r, c] = rc(i)
      return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([rr, cc]) => rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE)
        .map(([rr, cc]) => idx(rr, cc))
    }
    if (openHits.length >= 2) {
      const sorted = [...openHits].sort((a, b) => a - b)
      const horizontal = rc(sorted[0])[0] === rc(sorted[1])[0]
      const step = horizontal ? 1 : SIZE
      const before = sorted[0] - step
      const after = sorted[sorted.length - 1] + step
      const sameLine = (a, b) => (horizontal ? rc(a)[0] === rc(b)[0] : true)
      const options = [before, after].filter((i) => free(i) && sameLine(i, sorted[0]))
      if (options.length) return options[Math.floor(rand() * options.length)]
    }
    const options = openHits.flatMap(neighbours).filter(free)
    if (options.length) return options[Math.floor(rand() * options.length)]
  }
  const parity = []
  const any = []
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (!free(i)) continue
    any.push(i)
    const [r, c] = rc(i)
    if ((r + c) % 2 === 0) parity.push(i)
  }
  const pool = parity.length ? parity : any
  return pool[Math.floor(rand() * pool.length)]
}

// Aplica um tiro de `shooter` (contra `targetFleet`) à lista de tiros dele.
export function applyShot(shots, targetFleet, cell) {
  if (shots.some((s) => s.i === cell)) throw new Error('Já disparaste nessa casa.')
  const res = fire(targetFleet, shots, cell)
  const shot = { i: cell, hit: res.hit }
  if (res.sunk) {
    shot.sunk = res.sunk
    shot.sunkCells = targetFleet.find((s) => s.key === res.sunk).cells
  }
  return { shots: [...shots, shot], ...res }
}

// ---- Multiplayer (corre no anfitrião) ----
export const navalOnline = {
  minPlayers: 2,
  maxPlayers: 2,
  start(players) {
    const ids = players.map((p) => p.id)
    return {
      phase: 'colocar',
      ids,
      fleets: { [ids[0]]: null, [ids[1]]: null },
      shots: { [ids[0]]: [], [ids[1]]: [] },
      turn: ids[0],
      winner: null,
      round: 1,
      score: { [ids[0]]: 0, [ids[1]]: 0 },
      lastShot: null,
    }
  },
  reduce(game, action, fromId) {
    if (!game.ids.includes(fromId)) throw new Error('Não estás a jogar.')
    const other = game.ids.find((id) => id !== fromId)
    switch (action.type) {
      case 'fleet': {
        if (game.phase !== 'colocar') throw new Error('Os navios já estão posicionados.')
        if (!validateFleet(action.fleet)) throw new Error('Posição dos navios inválida.')
        const fleets = { ...game.fleets, [fromId]: action.fleet }
        const ready = game.ids.every((id) => fleets[id])
        return { ...game, fleets, phase: ready ? 'jogar' : 'colocar' }
      }
      case 'unready': {
        if (game.phase !== 'colocar') return game
        return { ...game, fleets: { ...game.fleets, [fromId]: null } }
      }
      case 'shoot': {
        if (game.phase !== 'jogar') throw new Error('O jogo não está em curso.')
        if (game.turn !== fromId) throw new Error('Não é a tua vez.')
        const cell = action.cell
        if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE) throw new Error('Casa inválida.')
        const res = applyShot(game.shots[fromId], game.fleets[other], cell)
        const next = {
          ...game,
          shots: { ...game.shots, [fromId]: res.shots },
          lastShot: { by: fromId, i: cell, hit: res.hit, sunk: res.sunk },
        }
        if (res.allSunk) return { ...next, phase: 'fim', winner: fromId, score: { ...game.score, [fromId]: game.score[fromId] + 1 } }
        // Ataques alternados: depois de cada tiro, a vez passa ao adversário.
        return { ...next, turn: other }
      }
      case 'rematch': {
        if (game.phase !== 'fim') return game
        const loser = game.ids.find((id) => id !== game.winner)
        return {
          ...game,
          phase: 'colocar',
          fleets: { [game.ids[0]]: null, [game.ids[1]]: null },
          shots: { [game.ids[0]]: [], [game.ids[1]]: [] },
          turn: loser,
          winner: null,
          lastShot: null,
          round: game.round + 1,
        }
      }
      default:
        throw new Error('Ação desconhecida.')
    }
  },
}
