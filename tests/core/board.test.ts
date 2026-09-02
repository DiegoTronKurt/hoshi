import { describe, expect, it } from 'vitest'
import { applicableTransforms, BOARD_TRANSFORMS, createBoard, neighbors, toPoint, toXY, transformBoard, transformPoint } from '../../src/core/board'
import { BLACK } from '../../src/core/types'

describe('board', () => {
  it('crea un tablero vacio del tamano pedido', () => {
    const board = createBoard(9)
    expect(board.width).toBe(9)
    expect(board.height).toBe(9)
    expect(board.stones.length).toBe(81)
    expect(board.stones.every((v) => v === 0)).toBe(true)
  })

  it('crea un tablero rectangular cuando ancho y alto difieren', () => {
    const board = createBoard(9, 13)
    expect(board.width).toBe(9)
    expect(board.height).toBe(13)
    expect(board.stones.length).toBe(117)
  })

  it('convierte coordenadas ida y vuelta', () => {
    const point = toPoint(9, 3, 5)
    expect(toXY(9, point)).toEqual([3, 5])
  })

  it('un punto de esquina tiene dos vecinos', () => {
    expect(neighbors(9, 9, toPoint(9, 0, 0)).length).toBe(2)
  })

  it('un punto de borde tiene tres vecinos', () => {
    expect(neighbors(9, 9, toPoint(9, 0, 4)).length).toBe(3)
  })

  it('un punto central tiene cuatro vecinos', () => {
    expect(neighbors(9, 9, toPoint(9, 4, 4)).length).toBe(4)
  })

  it('las 8 transformaciones diedrales son cada una una biyeccion del tablero, en 9x9 y en los tamanos todavia bloqueados 13x13/19x19', () => {
    // v1.5 (roadmap maestro, seccion 8): esta simetria es matematicamente
    // solo para tablero cuadrado, y hasta ahora nunca se ejercito en un
    // tamano mas grande que 9 -- red de seguridad barata antes de que
    // Aprender/Jugar desbloqueen esos tamanos de verdad.
    for (const size of [9, 13, 19]) {
      for (const transform of BOARD_TRANSFORMS) {
        const seen = new Set<number>()
        for (let p = 0; p < size * size; p++) {
          const [x, y] = toXY(size, p)
          const [tx, ty] = transform.apply(x, y, size, size)
          expect(tx).toBeGreaterThanOrEqual(0)
          expect(tx).toBeLessThan(size)
          expect(ty).toBeGreaterThanOrEqual(0)
          expect(ty).toBeLessThan(size)
          seen.add(toPoint(size, tx, ty))
        }
        expect(seen.size).toBe(size * size)
      }
    }
  })

  it('transformBoard mueve las piedras de forma consistente con transformPoint, en 9x9 y en 13x13/19x19', () => {
    for (const size of [9, 13, 19]) {
      const board = createBoard(size)
      const corner = toPoint(size, 0, 0)
      board.stones[corner] = BLACK

      for (const transform of BOARD_TRANSFORMS) {
        const transformed = transformBoard(board, transform)
        const expectedPoint = transformPoint(size, size, corner, transform)
        expect(transformed.stones[expectedPoint]).toBe(BLACK)
        expect(transformed.stones.reduce((sum, v) => sum + (v !== 0 ? 1 : 0), 0)).toBe(1)
      }
    }
  })

  it('identidad y rotacion de 180 grados son sus propios ejemplos verificables a mano', () => {
    const size = 9
    expect(BOARD_TRANSFORMS[0].apply(3, 5, size, size)).toEqual([3, 5])
    expect(BOARD_TRANSFORMS[2].apply(3, 5, size, size)).toEqual([5, 3])
  })

  describe('tablero rectangular (9x13, nivel Forma)', () => {
    it('applicableTransforms deja solo las 4 que preservan la forma cuando ancho y alto difieren', () => {
      const transforms = applicableTransforms(9, 13)
      expect(transforms.length).toBe(4)
      expect(transforms.every((t) => !t.swapsAxes)).toBe(true)
    })

    it('applicableTransforms devuelve las 8 en un tablero cuadrado', () => {
      expect(applicableTransforms(9, 9).length).toBe(8)
    })

    it('las 4 transformaciones que preservan la forma son cada una una biyeccion del tablero 9x13', () => {
      const width = 9
      const height = 13
      for (const transform of applicableTransforms(width, height)) {
        const seen = new Set<number>()
        for (let p = 0; p < width * height; p++) {
          const [x, y] = toXY(width, p)
          const [tx, ty] = transform.apply(x, y, width, height)
          expect(tx).toBeGreaterThanOrEqual(0)
          expect(tx).toBeLessThan(width)
          expect(ty).toBeGreaterThanOrEqual(0)
          expect(ty).toBeLessThan(height)
          seen.add(toPoint(width, tx, ty))
        }
        expect(seen.size).toBe(width * height)
      }
    })

    it('transformBoard preserva ancho y alto para las transformaciones sin intercambio de ejes', () => {
      const board = createBoard(9, 13)
      board.stones[toPoint(9, 0, 0)] = BLACK
      for (const transform of applicableTransforms(9, 13)) {
        const transformed = transformBoard(board, transform)
        expect(transformed.width).toBe(9)
        expect(transformed.height).toBe(13)
      }
    })

    it('transformBoard intercambia ancho y alto para una transformacion que intercambia ejes', () => {
      const board = createBoard(9, 13)
      const corner = toPoint(9, 0, 0)
      board.stones[corner] = BLACK
      const rot90 = BOARD_TRANSFORMS[1]
      expect(rot90.swapsAxes).toBe(true)

      const transformed = transformBoard(board, rot90)
      expect(transformed.width).toBe(13)
      expect(transformed.height).toBe(9)
      const expectedPoint = transformPoint(9, 13, corner, rot90)
      expect(transformed.stones[expectedPoint]).toBe(BLACK)
      expect(transformed.stones.reduce((sum, v) => sum + (v !== 0 ? 1 : 0), 0)).toBe(1)
    })
  })
})
