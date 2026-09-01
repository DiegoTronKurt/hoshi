import { describe, expect, it } from 'vitest'
import { BOARD_TRANSFORMS, createBoard, neighbors, toPoint, toXY, transformBoard, transformPoint } from '../../src/core/board'
import { BLACK } from '../../src/core/types'

describe('board', () => {
  it('crea un tablero vacio del tamano pedido', () => {
    const board = createBoard(9)
    expect(board.size).toBe(9)
    expect(board.stones.length).toBe(81)
    expect(board.stones.every((v) => v === 0)).toBe(true)
  })

  it('convierte coordenadas ida y vuelta', () => {
    const point = toPoint(9, 3, 5)
    expect(toXY(9, point)).toEqual([3, 5])
  })

  it('un punto de esquina tiene dos vecinos', () => {
    expect(neighbors(9, toPoint(9, 0, 0)).length).toBe(2)
  })

  it('un punto de borde tiene tres vecinos', () => {
    expect(neighbors(9, toPoint(9, 0, 4)).length).toBe(3)
  })

  it('un punto central tiene cuatro vecinos', () => {
    expect(neighbors(9, toPoint(9, 4, 4)).length).toBe(4)
  })

  it('las 8 transformaciones diedrales son cada una una biyeccion del tablero', () => {
    const size = 9
    for (const transform of BOARD_TRANSFORMS) {
      const seen = new Set<number>()
      for (let p = 0; p < size * size; p++) {
        const [x, y] = toXY(size, p)
        const [tx, ty] = transform(x, y, size)
        expect(tx).toBeGreaterThanOrEqual(0)
        expect(tx).toBeLessThan(size)
        expect(ty).toBeGreaterThanOrEqual(0)
        expect(ty).toBeLessThan(size)
        seen.add(toPoint(size, tx, ty))
      }
      expect(seen.size).toBe(size * size)
    }
  })

  it('transformBoard mueve las piedras de forma consistente con transformPoint', () => {
    const size = 9
    const board = createBoard(size)
    const corner = toPoint(size, 0, 0)
    board.stones[corner] = BLACK

    for (const transform of BOARD_TRANSFORMS) {
      const transformed = transformBoard(board, transform)
      const expectedPoint = transformPoint(size, corner, transform)
      expect(transformed.stones[expectedPoint]).toBe(BLACK)
      expect(transformed.stones.reduce((sum, v) => sum + (v !== 0 ? 1 : 0), 0)).toBe(1)
    }
  })

  it('identidad y rotacion de 180 grados son sus propios ejemplos verificables a mano', () => {
    const size = 9
    expect(BOARD_TRANSFORMS[0](3, 5, size)).toEqual([3, 5])
    expect(BOARD_TRANSFORMS[2](3, 5, size)).toEqual([5, 3])
  })
})
