import { describe, expect, it } from 'vitest'
import { createBoard, toPoint, toXY } from '../../src/core/board'
import { BLACK } from '../../src/core/types'
import { computeRegion, countEmptyPoints } from '../../src/solver/region'

describe('computeRegion', () => {
  it('recorta el margen a los bordes del tablero, en 9x9 y en 13x13/19x19', () => {
    // v1.5 (roadmap maestro, seccion 8): el recorte usa el mismo `size` para
    // ambos ejes (solo tablero cuadrado) -- red de seguridad barata a
    // tamanos todavia sin ejercitar antes de que se desbloqueen de verdad.
    for (const size of [9, 13, 19]) {
      const board = createBoard(size)
      const corner = toPoint(size, 0, 0)
      const region = computeRegion(board, [corner], 2)

      for (const p of region) {
        const [x, y] = toXY(size, p)
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(2)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(2)
      }
      expect(region.length).toBe(9) // cuadrado de 3x3, recortado por la esquina
    }
  })

  it('un objetivo lejos de cualquier borde da un cuadrado completo de (2*margin+1) lado', () => {
    for (const size of [13, 19]) {
      const board = createBoard(size)
      const center = toPoint(size, Math.floor(size / 2), Math.floor(size / 2))
      const region = computeRegion(board, [center], 2)
      expect(region.length).toBe(5 * 5)
    }
  })

  it('countEmptyPoints cuenta solo los puntos vacios dentro de la region', () => {
    const size = 13
    const board = createBoard(size)
    const region = computeRegion(board, [toPoint(size, 0, 0)], 1)
    expect(countEmptyPoints(board, region)).toBe(region.length)

    board.stones[toPoint(size, 0, 0)] = BLACK
    expect(countEmptyPoints(board, region)).toBe(region.length - 1)
  })
})
