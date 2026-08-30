import { describe, expect, it } from 'vitest'
import { createBoard, neighbors, toPoint, toXY } from '../../src/core/board'

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
})
