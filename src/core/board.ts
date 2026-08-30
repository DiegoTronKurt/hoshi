import type { BoardState } from './types'

export function createBoard(size: number): BoardState {
  return { size, stones: new Int8Array(size * size) }
}

export function cloneBoard(board: BoardState): BoardState {
  return { size: board.size, stones: board.stones.slice() }
}

export function toXY(size: number, point: number): [number, number] {
  return [point % size, Math.floor(point / size)]
}

export function toPoint(size: number, x: number, y: number): number {
  return y * size + x
}

export function inBounds(size: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < size && y < size
}

const neighborCache = new Map<number, number[][]>()

export function neighbors(size: number, point: number): number[] {
  let table = neighborCache.get(size)
  if (!table) {
    table = []
    for (let p = 0; p < size * size; p++) {
      const [x, y] = toXY(size, p)
      const result: number[] = []
      if (x > 0) result.push(toPoint(size, x - 1, y))
      if (x < size - 1) result.push(toPoint(size, x + 1, y))
      if (y > 0) result.push(toPoint(size, x, y - 1))
      if (y < size - 1) result.push(toPoint(size, x, y + 1))
      table.push(result)
    }
    neighborCache.set(size, table)
  }
  return table[point]
}

export function diagonals(size: number, point: number): number[] {
  const [x, y] = toXY(size, point)
  const result: number[] = []
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const nx = x + dx
    const ny = y + dy
    if (inBounds(size, nx, ny)) result.push(toPoint(size, nx, ny))
  }
  return result
}
