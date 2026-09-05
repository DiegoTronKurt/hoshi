import { describe, expect, it } from 'vitest'
import { toPoint } from '../../../src/core/board'
import { getHandicapPoints } from '../../../src/ui/board/handicapPoints'

function sorted(points: number[]): number[] {
  return [...points].sort((a, b) => a - b)
}

describe('getHandicapPoints', () => {
  it('9x9: progresion 2 a 5, esquinas TR/BL primero y tengen recien en 5', () => {
    const tl = toPoint(9, 2, 2)
    const tr = toPoint(9, 6, 2)
    const bl = toPoint(9, 2, 6)
    const br = toPoint(9, 6, 6)
    const tengen = toPoint(9, 4, 4)

    expect(sorted(getHandicapPoints(9, 9, 2))).toEqual(sorted([tr, bl]))
    expect(sorted(getHandicapPoints(9, 9, 3))).toEqual(sorted([tr, bl, tl]))
    expect(sorted(getHandicapPoints(9, 9, 4))).toEqual(sorted([tr, bl, tl, br]))
    expect(sorted(getHandicapPoints(9, 9, 5))).toEqual(sorted([tr, bl, tl, br, tengen]))
  })

  it('9x9: sin convencion mas alla de 5 piedras (solo 5 puntos hoshi reales)', () => {
    expect(getHandicapPoints(9, 9, 6)).toEqual([])
    expect(getHandicapPoints(9, 9, 9)).toEqual([])
  })

  it('13x13: misma progresion 2 a 5 con sus propias esquinas', () => {
    const tl = toPoint(13, 3, 3)
    const tr = toPoint(13, 9, 3)
    const bl = toPoint(13, 3, 9)
    const br = toPoint(13, 9, 9)
    const tengen = toPoint(13, 6, 6)

    expect(sorted(getHandicapPoints(13, 13, 2))).toEqual(sorted([tr, bl]))
    expect(sorted(getHandicapPoints(13, 13, 5))).toEqual(sorted([tr, bl, tl, br, tengen]))
    expect(getHandicapPoints(13, 13, 6)).toEqual([])
  })

  it('19x19: rango completo 2 a 9, tengen solo en cantidades impares (5, 7, 9)', () => {
    const tl = toPoint(19, 3, 3)
    const tr = toPoint(19, 15, 3)
    const bl = toPoint(19, 3, 15)
    const br = toPoint(19, 15, 15)
    const top = toPoint(19, 9, 3)
    const bottom = toPoint(19, 9, 15)
    const left = toPoint(19, 3, 9)
    const right = toPoint(19, 15, 9)
    const tengen = toPoint(19, 9, 9)

    expect(sorted(getHandicapPoints(19, 19, 2))).toEqual(sorted([tr, bl]))
    expect(sorted(getHandicapPoints(19, 19, 3))).toEqual(sorted([tr, bl, tl]))
    expect(sorted(getHandicapPoints(19, 19, 4))).toEqual(sorted([tr, bl, tl, br]))
    expect(sorted(getHandicapPoints(19, 19, 5))).toEqual(sorted([tr, bl, tl, br, tengen]))
    expect(sorted(getHandicapPoints(19, 19, 6))).toEqual(sorted([tr, bl, tl, br, left, right]))
    expect(getHandicapPoints(19, 19, 6)).not.toContain(tengen)
    expect(sorted(getHandicapPoints(19, 19, 7))).toEqual(sorted([tr, bl, tl, br, left, right, tengen]))
    expect(sorted(getHandicapPoints(19, 19, 8))).toEqual(sorted([tr, bl, tl, br, top, bottom, left, right]))
    expect(getHandicapPoints(19, 19, 8)).not.toContain(tengen)
    expect(sorted(getHandicapPoints(19, 19, 9))).toEqual(
      sorted([tr, bl, tl, br, top, bottom, left, right, tengen]),
    )
  })

  it('cada cantidad soportada devuelve exactamente esa cantidad de puntos, sin repetidos', () => {
    for (const size of [9, 13] as const) {
      for (let count = 2; count <= 5; count++) {
        const points = getHandicapPoints(size, size, count)
        expect(points.length).toBe(count)
        expect(new Set(points).size).toBe(count)
      }
    }
    for (let count = 2; count <= 9; count++) {
      const points = getHandicapPoints(19, 19, count)
      expect(points.length).toBe(count)
      expect(new Set(points).size).toBe(count)
    }
  })

  it('tamanos sin convencion de handicap (5x5, 7x7, 9x13 rectangular) no inventan puntos', () => {
    expect(getHandicapPoints(5, 5, 2)).toEqual([])
    expect(getHandicapPoints(7, 7, 2)).toEqual([])
    expect(getHandicapPoints(9, 13, 2)).toEqual([])
  })

  it('cantidades fuera de rango (0, 1, 10) no devuelven puntos', () => {
    expect(getHandicapPoints(19, 19, 0)).toEqual([])
    expect(getHandicapPoints(19, 19, 1)).toEqual([])
    expect(getHandicapPoints(19, 19, 10)).toEqual([])
  })
})
