import { toPoint } from '../../core/board'

/**
 * Puntos de handicap (2-9 piedras) segun la convencion estandar de Go, por
 * tamano de tablero. A diferencia de getHoshiPoints (hoshiPoints.ts, que solo
 * da posiciones de puntos para dibujar, sin orden ni subconjuntos), esta
 * tabla si es sensible al orden: el tengen recien se suma en las cantidades
 * impares 5/7/9, nunca en 6 u 8, y 2/3 piedras usan esquinas especificas, no
 * "las primeras N" de cualquier lista.
 *
 * 9x9 y 13x13 solo llegan hasta 5 (4 esquinas + tengen: sus unicos 5 puntos
 * hoshi reales) -- inventar puntos 6-9 en esos tamanos no tendria respaldo en
 * ninguna convencion real de goban. Solo 19x19 llega al rango completo 2-9,
 * que coincide exactamente con sus 9 puntos hoshi reales.
 */
export function getHandicapPoints(width: number, height: number, count: number): number[] {
  if (width !== height) return []
  if (width === 9 || width === 13) return smallBoardHandicap(width, count)
  if (width === 19) return largeBoardHandicap(count)
  return []
}

function smallBoardHandicap(size: 9 | 13, count: number): number[] {
  const edge = size === 9 ? 2 : 3
  const far = size === 9 ? 6 : 9
  const center = size === 9 ? 4 : 6
  const tl = toPoint(size, edge, edge)
  const tr = toPoint(size, far, edge)
  const bl = toPoint(size, edge, far)
  const br = toPoint(size, far, far)
  const tengen = toPoint(size, center, center)

  switch (count) {
    case 2:
      return [tr, bl]
    case 3:
      return [tr, bl, tl]
    case 4:
      return [tr, bl, tl, br]
    case 5:
      return [tr, bl, tl, br, tengen]
    default:
      return []
  }
}

function largeBoardHandicap(count: number): number[] {
  const size = 19
  const tl = toPoint(size, 3, 3)
  const tr = toPoint(size, 15, 3)
  const bl = toPoint(size, 3, 15)
  const br = toPoint(size, 15, 15)
  const top = toPoint(size, 9, 3)
  const bottom = toPoint(size, 9, 15)
  const left = toPoint(size, 3, 9)
  const right = toPoint(size, 15, 9)
  const tengen = toPoint(size, 9, 9)

  switch (count) {
    case 2:
      return [tr, bl]
    case 3:
      return [tr, bl, tl]
    case 4:
      return [tr, bl, tl, br]
    case 5:
      return [tr, bl, tl, br, tengen]
    case 6:
      return [tr, bl, tl, br, left, right]
    case 7:
      return [tr, bl, tl, br, left, right, tengen]
    case 8:
      return [tr, bl, tl, br, top, bottom, left, right]
    case 9:
      return [tr, bl, tl, br, top, bottom, left, right, tengen]
    default:
      return []
  }
}
