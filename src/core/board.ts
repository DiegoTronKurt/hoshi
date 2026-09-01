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

/**
 * Las 8 transformaciones diedrales de un tablero cuadrado (identidad, 3
 * rotaciones, y sus 4 espejos). Se usan para multiplicar una posicion
 * plantilla ya verificada por el solucionador (p.ej. un geta o un snapback
 * hallado a mano) en varias posiciones distintas del banco de problemas sin
 * derivar geometria nueva cada vez. La transformacion no cambia la
 * legalidad de Go, pero cada variante igual se re-verifica con el
 * solucionador antes de aceptarse en el banco, nunca se asume.
 */
export type BoardTransform = (x: number, y: number, size: number) => [number, number]

export const BOARD_TRANSFORMS: BoardTransform[] = [
  (x, y) => [x, y],
  (x, y, size) => [size - 1 - y, x],
  (x, y, size) => [size - 1 - x, size - 1 - y],
  (x, y, size) => [y, size - 1 - x],
  (x, y, size) => [size - 1 - x, y],
  (x, y, size) => [x, size - 1 - y],
  (x, y) => [y, x],
  (x, y, size) => [size - 1 - y, size - 1 - x],
]

export function transformPoint(size: number, point: number, transform: BoardTransform): number {
  const [x, y] = toXY(size, point)
  const [tx, ty] = transform(x, y, size)
  return toPoint(size, tx, ty)
}

export function transformBoard(board: BoardState, transform: BoardTransform): BoardState {
  const result = createBoard(board.size)
  for (let p = 0; p < board.stones.length; p++) {
    result.stones[transformPoint(board.size, p, transform)] = board.stones[p]
  }
  return result
}
