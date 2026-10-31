export const SIZE = 20
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' }

export function placeFood(snake, rand = Math.random) {
  const taken = new Set(snake.map(([x, y]) => `${x},${y}`))
  const free = []
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (!taken.has(`${x},${y}`)) free.push([x, y])
  return free.length ? free[Math.floor(rand() * free.length)] : null
}

// O recorde é o tamanho da cobra: começa com 3 e cresce 1 por cada comida.
export const START_LENGTH = 3
export const lengthOf = (score) => START_LENGTH + (Number(score) || 0)

export function newGame(walls = true, rand = Math.random) {
  const snake = [[9, 10], [8, 10], [7, 10]]
  return { snake, dir: 'right', queue: [], food: placeFood(snake, rand), score: 0, over: false, walls }
}

// Guarda as viragens (até 2) para não se perderem teclas rápidas.
export function turn(state, dir) {
  if (state.over || !DIRS[dir]) return state
  const last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir
  if (dir === last || dir === OPPOSITE[last] || state.queue.length >= 2) return state
  return { ...state, queue: [...state.queue, dir] }
}

export function step(state, rand = Math.random) {
  if (state.over) return state
  const [dir, ...queue] = state.queue.length ? state.queue : [state.dir]
  const [dx, dy] = DIRS[dir]
  let [x, y] = state.snake[0]
  x += dx
  y += dy
  if (!state.walls) {
    x = (x + SIZE) % SIZE
    y = (y + SIZE) % SIZE
  } else if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) {
    return { ...state, dir, queue, over: true }
  }
  const eats = state.food && x === state.food[0] && y === state.food[1]
  const body = eats ? state.snake : state.snake.slice(0, -1)
  if (body.some(([bx, by]) => bx === x && by === y)) return { ...state, dir, queue, over: true }
  const snake = [[x, y], ...body]
  if (!eats) return { ...state, snake, dir, queue }
  const food = placeFood(snake, rand)
  return { ...state, snake, dir, queue, food, score: state.score + 1, over: !food }
}

// Fica mais rápida à medida que come.
export const speedFor = (score) => Math.max(65, 140 - score * 3)
