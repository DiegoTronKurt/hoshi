import { describe, expect, it } from 'vitest'
import { createBoard, toPoint } from '../../src/core/board'
import { BLACK, WHITE } from '../../src/core/types'
import { doubleAtariProblemToSgf, sgfToDoubleAtariProblem } from '../../src/content/doubleAtariProblem'
import type { DoubleAtariProblem } from '../../src/content/doubleAtariProblem'
import { isDoubleAtariMove } from '../../src/solver/doubleAtari'

const SIZE = 9
const p = (x: number, y: number) => toPoint(SIZE, x, y)

function sampleProblem(): DoubleAtariProblem {
  const board = createBoard(SIZE)
  board.stones[p(2, 2)] = WHITE
  board.stones[p(1, 2)] = BLACK
  board.stones[p(2, 1)] = BLACK
  board.stones[p(4, 2)] = WHITE
  board.stones[p(5, 2)] = BLACK
  board.stones[p(4, 1)] = BLACK
  return { conceptId: 'DOBLE_ATARI', board, color: BLACK, expectedPoints: [p(3, 2)] }
}

describe('DoubleAtariProblem SGF', () => {
  it('ida y vuelta conserva el tablero, el color y los puntos esperados', () => {
    const original = sampleProblem()
    const restored = sgfToDoubleAtariProblem(doubleAtariProblemToSgf(original))

    expect(restored.conceptId).toBe('DOBLE_ATARI')
    expect(restored.color).toBe(original.color)
    expect(restored.expectedPoints).toEqual(original.expectedPoints)
    expect(Array.from(restored.board.stones)).toEqual(Array.from(original.board.stones))
  })

  it('el problema restaurado sigue siendo un doble atari valido', () => {
    const original = sampleProblem()
    const restored = sgfToDoubleAtariProblem(doubleAtariProblemToSgf(original))
    for (const point of restored.expectedPoints) {
      expect(isDoubleAtariMove(restored.board, point, restored.color)).toBe(true)
    }
  })
})
