import { describe, expect, it } from 'vitest'
import { createBoard, toPoint } from '../../src/core/board'
import { computeAreaOwnership, computeAreaScore } from '../../src/core/scoring'
import { BLACK, EMPTY, WHITE } from '../../src/core/types'
import type { BoardState, Color } from '../../src/core/types'

function place(board: BoardState, color: Color, points: Array<[number, number]>): void {
  for (const [x, y] of points) {
    board.stones[toPoint(board.width, x, y)] = color
  }
}

describe('conteo de area', () => {
  it('cuenta piedras propias y territorio, y no reparte los puntos neutrales', () => {
    const board = createBoard(5)
    place(board, BLACK, [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
      [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
    ])
    place(board, WHITE, [
      [0, 3], [1, 3], [2, 3], [3, 3], [4, 3],
      [0, 4], [1, 4], [2, 4], [3, 4], [4, 4],
    ])
    // La fila y=2 queda vacia. Cada uno de sus puntos toca negro arriba y
    // blanco abajo, asi que es neutral (dame) y no cuenta para nadie.

    const score = computeAreaScore(board, 6.5)

    expect(score.black).toBe(10)
    expect(score.white).toBe(10 + 6.5)
  })

  it('las piedras marcadas como muertas se cuentan como territorio del rival', () => {
    const board = createBoard(5)
    const ring: Array<[number, number]> = []
    for (let x = 0; x < 5; x++) ring.push([x, 0], [x, 4])
    for (let y = 1; y < 4; y++) ring.push([0, y], [4, y])
    place(board, BLACK, ring) // anillo negro que rodea todo el tablero: 16 piedras

    place(board, WHITE, [[2, 2]]) // piedra blanca solitaria en el centro

    const withoutMarking = computeAreaScore(board, 0)
    expect(withoutMarking.black).toBe(16) // el interior toca blanco y negro: neutral
    expect(withoutMarking.white).toBe(1)

    const deadStones = new Set([toPoint(5, 2, 2)])
    const withMarking = computeAreaScore(board, 0, deadStones)
    expect(withMarking.black).toBe(25) // anillo (16) mas todo el interior (9)
    expect(withMarking.white).toBe(0)
  })
})

describe('computeAreaOwnership', () => {
  it('devuelve el dueno punto por punto, coherente con computeAreaScore agregado', () => {
    const board = createBoard(5)
    place(board, BLACK, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1]])
    place(board, WHITE, [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]])

    const owner = computeAreaOwnership(board)
    for (let x = 0; x < 5; x++) {
      expect(owner[toPoint(5, x, 0)]).toBe(BLACK)
      expect(owner[toPoint(5, x, 1)]).toBe(BLACK)
      expect(owner[toPoint(5, x, 2)]).toBe(EMPTY) // fila neutral (dame)
      expect(owner[toPoint(5, x, 3)]).toBe(WHITE)
      expect(owner[toPoint(5, x, 4)]).toBe(WHITE)
    }
  })
})
