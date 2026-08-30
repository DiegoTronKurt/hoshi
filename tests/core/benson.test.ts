import { describe, expect, it } from 'vitest'
import { createBoard, toPoint } from '../../src/core/board'
import { bensonPassAlive } from '../../src/core/benson'
import { BLACK, WHITE } from '../../src/core/types'
import type { BoardState, Color } from '../../src/core/types'

function place(board: BoardState, color: Color, points: Array<[number, number]>): void {
  for (const [x, y] of points) {
    board.stones[toPoint(board.size, x, y)] = color
  }
}

describe('algoritmo de Benson', () => {
  it('una cadena con dos ojos separados es pass-alive', () => {
    const board = createBoard(5)
    const black: Array<[number, number]> = []
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const isEye = (x === 1 && y === 2) || (x === 3 && y === 2)
        if (!isEye) black.push([x, y])
      }
    }
    place(board, BLACK, black)

    const result = bensonPassAlive(board, BLACK)

    expect(result.chains.length).toBe(1)
    expect(result.chains[0].length).toBe(black.length)
    expect(new Set(result.territoryPoints)).toEqual(
      new Set([toPoint(5, 1, 2), toPoint(5, 3, 2)]),
    )
  })

  it('una cadena con un solo ojo no es pass-alive', () => {
    const board = createBoard(5)
    place(board, BLACK, [
      [1, 1], [2, 1], [3, 1],
      [1, 2], [3, 2],
      [1, 3], [2, 3], [3, 3],
    ])
    // Una piedra blanca lejana hace que la region exterior toque al rival,
    // asi que no cuenta como segundo ojo sano para la cadena negra.
    place(board, WHITE, [[0, 0]])

    const result = bensonPassAlive(board, BLACK)

    expect(result.chains.length).toBe(0)
    expect(result.territoryPoints).toEqual([])
  })
})
