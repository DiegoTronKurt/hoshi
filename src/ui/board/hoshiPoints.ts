import { toPoint } from '../../core/board'

/**
 * Puntos hoshi (marcadores de estrella) segun el tamano del tablero.
 * Son una convencion visual del goban, no una regla del juego. Un tablero
 * rectangular (9x13, nivel Forma) no reutiliza el layout de ningun tablero
 * cuadrado existente -- necesita su propia convencion, agregada cuando se
 * autora ese contenido, no antes.
 */
export function getHoshiPoints(width: number, height: number = width): number[] {
  const centerX = Math.floor(width / 2)
  const centerY = Math.floor(height / 2)
  if (width !== height) {
    // Nivel 4 (Forma) es el unico tablero rectangular real hoy: 9 de ancho
    // (mismas columnas hoshi 2/6 que el 9x9 cuadrado) por 13 de alto (mismas
    // filas hoshi 3/9 que el 13x13 cuadrado), mas el tengen en el centro real
    // del rectangulo. No es una convencion de goban fisico (los tableros
    // rectangulares no son estandar), es una extension consistente de las
    // dos convenciones cuadradas que ya existen mas abajo, documentada aca
    // por si un futuro tablero rectangular distinto necesita su propio caso.
    if (width === 9 && height === 13) {
      return [2, 6].flatMap((x) => [3, 9].map((y) => toPoint(width, x, y))).concat(toPoint(width, centerX, centerY))
    }
    return []
  }
  const size = width
  if (size === 9) {
    return [2, 6].flatMap((y) => [2, 6].map((x) => toPoint(size, x, y))).concat(toPoint(size, centerX, centerY))
  }
  if (size === 13) {
    // Convencion estandar de goban: 4 esquinas mas tengen, sin los 4 puntos
    // intermedios de borde que si lleva un tablero de 19 (ver mas abajo).
    return [3, 9].flatMap((y) => [3, 9].map((x) => toPoint(size, x, y))).concat(toPoint(size, centerX, centerY))
  }
  if (size === 19) {
    return [3, 9, 15].flatMap((y) => [3, 9, 15].map((x) => toPoint(size, x, y)))
  }
  if (size === 5 || size === 7) {
    return [toPoint(size, centerX, centerY)]
  }
  return []
}
