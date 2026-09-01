import { createBoard, toPoint, toXY } from '../../core/board'
import { BLACK, WHITE } from '../../core/types'
import type { BoardState } from '../../core/types'

/** Arma un Int8Array de posiciones para diagramas y demos de lecciones a partir de coordenadas (x, y) legibles. */
export function board(size: number, black: Array<[number, number]>, white: Array<[number, number]> = []): Int8Array {
  const b = createBoard(size)
  for (const [x, y] of black) b.stones[toPoint(size, x, y)] = BLACK
  for (const [x, y] of white) b.stones[toPoint(size, x, y)] = WHITE
  return b.stones
}

export function point(size: number, x: number, y: number): number {
  return toPoint(size, x, y)
}

export interface CroppedShape {
  size: number
  stones: Int8Array
  offsetX: number
  offsetY: number
}

/**
 * Recorta un tablero grande (como los de src/content/seeds.ts, pensados para
 * el solucionador: todo el resto del tablero relleno de un color para acotar
 * la region) a una vista local cuadrada alrededor de `wallPoints`, con un
 * margen. Es seguro para juego real: las piedras "de relleno" fuera del
 * recorte son funcionalmente identicas a que esas celdas queden fuera del
 * tablero (ninguna de las dos cuenta como libertad), asi que recortar no
 * cambia libertades ni capturas, solo la vista.
 */
export function cropShape(original: { board: BoardState; wallPoints: number[] }, margin = 1): CroppedShape {
  const { board: origBoard, wallPoints } = original
  const coords = wallPoints.map((p) => toXY(origBoard.size, p))
  const minX = Math.min(...coords.map(([x]) => x))
  const maxX = Math.max(...coords.map(([x]) => x))
  const minY = Math.min(...coords.map(([, y]) => y))
  const maxY = Math.max(...coords.map(([, y]) => y))
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  const size = Math.min(origBoard.size, Math.max(w, h) + margin * 2)

  const clamp = (value: number) => Math.max(0, Math.min(origBoard.size - size, value))
  const offsetX = clamp(minX - Math.floor((size - w) / 2))
  const offsetY = clamp(minY - Math.floor((size - h) / 2))

  const stones = new Int8Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      stones[y * size + x] = origBoard.stones[(offsetY + y) * origBoard.size + (offsetX + x)]
    }
  }
  return { size, stones, offsetX, offsetY }
}

/** Traduce una coordenada del tablero original a un punto dentro de la vista recortada de `cropShape`. */
export function cropPoint(crop: CroppedShape, x: number, y: number): number {
  return point(crop.size, x - crop.offsetX, y - crop.offsetY)
}
