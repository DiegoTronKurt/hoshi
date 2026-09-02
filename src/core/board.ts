import type { BoardState } from './types'

export function createBoard(width: number, height: number = width): BoardState {
  return { width, height, stones: new Int8Array(width * height) }
}

export function cloneBoard(board: BoardState): BoardState {
  return { width: board.width, height: board.height, stones: board.stones.slice() }
}

export function toXY(width: number, point: number): [number, number] {
  return [point % width, Math.floor(point / width)]
}

export function toPoint(width: number, x: number, y: number): number {
  return y * width + x
}

export function inBounds(width: number, height: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height
}

const neighborCache = new Map<string, number[][]>()

export function neighbors(width: number, height: number, point: number): number[] {
  const key = `${width}x${height}`
  let table = neighborCache.get(key)
  if (!table) {
    table = []
    for (let p = 0; p < width * height; p++) {
      const [x, y] = toXY(width, p)
      const result: number[] = []
      if (x > 0) result.push(toPoint(width, x - 1, y))
      if (x < width - 1) result.push(toPoint(width, x + 1, y))
      if (y > 0) result.push(toPoint(width, x, y - 1))
      if (y < height - 1) result.push(toPoint(width, x, y + 1))
      table.push(result)
    }
    neighborCache.set(key, table)
  }
  return table[point]
}

export function diagonals(width: number, height: number, point: number): number[] {
  const [x, y] = toXY(width, point)
  const result: number[] = []
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const nx = x + dx
    const ny = y + dy
    if (inBounds(width, height, nx, ny)) result.push(toPoint(width, nx, ny))
  }
  return result
}

/**
 * Las 8 transformaciones diedrales de un rectangulo (identidad, 3
 * rotaciones, y sus 4 espejos). Se usan para multiplicar una posicion
 * plantilla ya verificada por el solucionador (p.ej. un geta o un snapback
 * hallado a mano) en varias posiciones distintas del banco de problemas sin
 * derivar geometria nueva cada vez. La transformacion no cambia la
 * legalidad de Go, pero cada variante igual se re-verifica con el
 * solucionador antes de aceptarse en el banco, nunca se asume.
 *
 * `swapsAxes` marca las 4 (las dos rotaciones de 90 grados y las dos
 * transposiciones diagonales) que intercambian ancho y alto: solo son
 * validas como transformacion "misma forma" cuando width===height. Las
 * otras 4 (identidad, 180 grados, y los dos espejos rectos) preservan la
 * forma siempre, incluso en un tablero rectangular. Ver
 * `applicableTransforms`.
 */
export interface BoardTransform {
  apply: (x: number, y: number, width: number, height: number) => [number, number]
  swapsAxes: boolean
}

export const BOARD_TRANSFORMS: BoardTransform[] = [
  { apply: (x, y) => [x, y], swapsAxes: false },
  { apply: (x, y, _w, h) => [h - 1 - y, x], swapsAxes: true },
  { apply: (x, y, w, h) => [w - 1 - x, h - 1 - y], swapsAxes: false },
  { apply: (x, y, w) => [y, w - 1 - x], swapsAxes: true },
  { apply: (x, y, w) => [w - 1 - x, y], swapsAxes: false },
  { apply: (x, y, _w, h) => [x, h - 1 - y], swapsAxes: false },
  { apply: (x, y) => [y, x], swapsAxes: true },
  { apply: (x, y, w, h) => [h - 1 - y, w - 1 - x], swapsAxes: true },
]

/**
 * Las transformaciones utilizables sobre un tablero de `width`x`height`:
 * las 8 si es cuadrado, solo las 4 que preservan la forma si no lo es (ver
 * el comentario de `BoardTransform`).
 */
export function applicableTransforms(width: number, height: number): BoardTransform[] {
  if (width === height) return BOARD_TRANSFORMS
  return BOARD_TRANSFORMS.filter((t) => !t.swapsAxes)
}

export function transformPoint(width: number, height: number, point: number, transform: BoardTransform): number {
  const [x, y] = toXY(width, point)
  const [tx, ty] = transform.apply(x, y, width, height)
  const outWidth = transform.swapsAxes ? height : width
  return toPoint(outWidth, tx, ty)
}

export function transformBoard(board: BoardState, transform: BoardTransform): BoardState {
  const outWidth = transform.swapsAxes ? board.height : board.width
  const outHeight = transform.swapsAxes ? board.width : board.height
  const result = createBoard(outWidth, outHeight)
  for (let p = 0; p < board.stones.length; p++) {
    result.stones[transformPoint(board.width, board.height, p, transform)] = board.stones[p]
  }
  return result
}
