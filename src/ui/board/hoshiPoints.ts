import { toPoint } from '../../core/board'

/**
 * Puntos hoshi (marcadores de estrella) segun el tamano del tablero.
 * Son una convencion visual del goban, no una regla del juego.
 */
export function getHoshiPoints(size: number): number[] {
  const center = Math.floor(size / 2)
  if (size === 9) {
    return [2, 6].flatMap((y) => [2, 6].map((x) => toPoint(size, x, y))).concat(toPoint(size, center, center))
  }
  if (size === 13) {
    // Convencion estandar de goban: 4 esquinas mas tengen, sin los 4 puntos
    // intermedios de borde que si lleva un tablero de 19 (ver mas abajo).
    return [3, 9].flatMap((y) => [3, 9].map((x) => toPoint(size, x, y))).concat(toPoint(size, center, center))
  }
  if (size === 19) {
    return [3, 9, 15].flatMap((y) => [3, 9, 15].map((x) => toPoint(size, x, y)))
  }
  if (size === 5 || size === 7) {
    return [toPoint(size, center, center)]
  }
  return []
}
