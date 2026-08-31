import { describe, expect, it } from 'vitest'
import { createBoard, toPoint } from '../../src/core/board'
import { BLACK, WHITE } from '../../src/core/types'
import type { BoardState, Color } from '../../src/core/types'
import { solveLadder } from '../../src/solver/ladder'

function place(board: BoardState, color: Color, points: Array<[number, number]>): void {
  for (const [x, y] of points) {
    board.stones[toPoint(board.size, x, y)] = color
  }
}

// Una piedra negra en atari, con dos libertades hacia la esquina superior
// izquierda. Sin nada mas en el tablero, perseguirla hacia la esquina la
// atrapa: cada vez que blanco reduce sus libertades, la unica extension
// posible la deja igual de acorralada, hasta que la esquina no le deja mas
// espacio.
describe('solucionador de escaleras', () => {
  it('captura al grupo que huye hacia la esquina cuando no hay rompedor', () => {
    const board = createBoard(9)
    place(board, BLACK, [[1, 1]])
    place(board, WHITE, [[2, 1], [1, 2]])

    const result = solveLadder({
      board,
      runnerPoint: toPoint(9, 1, 1),
      chaserColor: WHITE,
    })

    expect(result.captured).toBe(true)
    expect(result.reason).toBe('captured')
    expect(result.moves.length).toBeGreaterThan(0)
  })

  it('escapa si una piedra propia (rompedor) ya le da mas libertades', () => {
    const board = createBoard(9)
    place(board, BLACK, [[1, 1]])
    place(board, WHITE, [[2, 1], [1, 2]])
    place(board, BLACK, [[1, 0]]) // rompedor: se conecta de entrada y da una tercera libertad

    const result = solveLadder({
      board,
      runnerPoint: toPoint(9, 1, 1),
      chaserColor: WHITE,
    })

    expect(result.captured).toBe(false)
    expect(result.reason).toBe('escaped')
  })

  it('un grupo que ya tiene varias libertades no es una escalera forzable', () => {
    const board = createBoard(9)
    place(board, BLACK, [[4, 4]])
    place(board, WHITE, [[3, 4], [4, 3]])

    const result = solveLadder({
      board,
      runnerPoint: toPoint(9, 4, 4),
      chaserColor: WHITE,
      maxMoves: 30,
    })

    expect(result.captured).toBe(false)
  })
})
