import { describe, expect, it } from 'vitest'
import { createBoard, toPoint } from '../../src/core/board'
import { BLACK, WHITE } from '../../src/core/types'
import { ladderProblemToSgf, sgfToLadderProblem } from '../../src/content/ladderProblem'
import type { LadderProblem } from '../../src/content/ladderProblem'
import { solveLadder } from '../../src/solver/ladder'

const SIZE = 9
const p = (x: number, y: number) => toPoint(SIZE, x, y)

function sampleProblem(): LadderProblem {
  const board = createBoard(SIZE)
  board.stones[p(1, 1)] = BLACK
  board.stones[p(2, 1)] = WHITE
  board.stones[p(1, 2)] = WHITE
  return { conceptId: 'ESCALERA', board, runnerPoint: p(1, 1), chaserColor: WHITE }
}

describe('LadderProblem SGF', () => {
  it('ida y vuelta conserva el tablero, el punto del que huye y el color perseguidor', () => {
    const original = sampleProblem()
    const sgf = ladderProblemToSgf(original)
    const restored = sgfToLadderProblem(sgf)

    expect(restored.conceptId).toBe('ESCALERA')
    expect(restored.runnerPoint).toBe(original.runnerPoint)
    expect(restored.chaserColor).toBe(original.chaserColor)
    expect(Array.from(restored.board.stones)).toEqual(Array.from(original.board.stones))
  })

  it('el problema restaurado sigue siendo una escalera valida segun solveLadder', () => {
    const original = sampleProblem()
    const restored = sgfToLadderProblem(ladderProblemToSgf(original))
    const result = solveLadder({
      board: restored.board,
      runnerPoint: restored.runnerPoint,
      chaserColor: restored.chaserColor,
    })
    expect(result.captured).toBe(true)
  })
})
