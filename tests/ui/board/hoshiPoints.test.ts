import { describe, expect, it } from 'vitest'
import { toPoint } from '../../../src/core/board'
import { getHoshiPoints } from '../../../src/ui/board/hoshiPoints'

describe('getHoshiPoints', () => {
  it('9x9: 4 esquinas mas tengen', () => {
    const points = getHoshiPoints(9).sort((a, b) => a - b)
    const expected = [
      toPoint(9, 2, 2),
      toPoint(9, 6, 2),
      toPoint(9, 2, 6),
      toPoint(9, 6, 6),
      toPoint(9, 4, 4),
    ].sort((a, b) => a - b)
    expect(points).toEqual(expected)
  })

  it('13x13: 4 esquinas mas tengen, sin puntos de borde intermedios', () => {
    const points = getHoshiPoints(13).sort((a, b) => a - b)
    const expected = [
      toPoint(13, 3, 3),
      toPoint(13, 9, 3),
      toPoint(13, 3, 9),
      toPoint(13, 9, 9),
      toPoint(13, 6, 6),
    ].sort((a, b) => a - b)
    expect(points).toEqual(expected)
  })

  it('19x19: 9 puntos, incluidos los 4 de borde intermedio', () => {
    const points = getHoshiPoints(19).sort((a, b) => a - b)
    const expected = [3, 9, 15]
      .flatMap((y) => [3, 9, 15].map((x) => toPoint(19, x, y)))
      .sort((a, b) => a - b)
    expect(points).toEqual(expected)
    expect(points).toContain(toPoint(19, 9, 9)) // tengen
  })

  it('todos los puntos hoshi caen dentro del tablero, para cualquier tamano soportado', () => {
    for (const size of [5, 7, 9, 13, 19]) {
      for (const p of getHoshiPoints(size)) {
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThan(size * size)
      }
    }
  })

  it('un tamano sin convencion definida no inventa puntos', () => {
    expect(getHoshiPoints(11)).toEqual([])
  })
})
