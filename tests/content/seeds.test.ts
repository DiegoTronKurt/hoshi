import { describe, expect, it } from 'vitest'
import { buildSeedProblems } from '../../src/content/seeds'
import { problemToSgf, sgfToProblem } from '../../src/content/problemSgf'
import { computeRegion } from '../../src/solver/region'
import { solve } from '../../src/solver/tsumego'

describe('posiciones semilla', () => {
  it('produce al menos una posicion semilla verificada por el solucionador', () => {
    const problems = buildSeedProblems()
    expect(problems.length).toBeGreaterThan(0)
  })

  it('cada semilla sobrevive el round trip a SGF y se vuelve a verificar igual (invariante del generador)', () => {
    const problems = buildSeedProblems()

    for (const problem of problems) {
      const sgf = problemToSgf(problem)
      const reloaded = sgfToProblem(sgf)

      expect(Array.from(reloaded.board.stones)).toEqual(Array.from(problem.board.stones))
      expect(reloaded.objective).toBe(problem.objective)
      expect(reloaded.toMove).toBe(problem.toMove)
      expect(reloaded.conceptId).toBe(problem.conceptId)

      const region = computeRegion(reloaded.board, reloaded.targetPoints, 1)
      const result = solve({
        board: reloaded.board,
        region,
        targetPoints: reloaded.targetPoints,
        targetColor: reloaded.targetColor,
        toMove: reloaded.toMove,
        objective: reloaded.objective,
        maxDepth: 6,
      })

      expect(result.solved).toBe(true)
    }
  })
})
