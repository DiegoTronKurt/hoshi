import { describe, expect, it } from 'vitest'
import { listBankEntries, loadProblem } from '../../src/content/problemBank'
import { computeRegion } from '../../src/solver/region'
import { solve } from '../../src/solver/tsumego'

describe('banco de problemas: invariante del generador', () => {
  const entries = listBankEntries()

  it('el banco no esta vacio', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  it.each(entries.map((e) => [e.id, e] as const))(
    '%s se vuelve a resolver igual que cuando se genero',
    (_id, entry) => {
      const problem = loadProblem(entry)
      const region = computeRegion(problem.board, problem.targetPoints, 1)

      const result = solve({
        board: problem.board,
        region,
        targetPoints: problem.targetPoints,
        targetColor: problem.targetColor,
        toMove: problem.toMove,
        objective: problem.objective,
        maxDepth: 8,
      })

      expect(result.solved).toBe(true)
    },
    30000,
  )
})
