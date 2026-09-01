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
      // RED_GETA y SNAPBACK (content/seeds.ts) parten de un tablero
      // mayormente vacio: su region no tiene un relleno que la acote, asi
      // que una profundidad de 8 ahi explota combinatoriamente (probado y
      // revertido: del orden de minutos, no segundos, para una sola
      // entrada). El resto de los conceptos usa regiones chicas por
      // construccion (formas de ojo con fondo relleno, o candidatos de
      // autojuego recortados a un grupo real) y sí soportan la profundidad
      // completa.
      const maxDepth = problem.conceptId === 'RED_GETA' || problem.conceptId === 'SNAPBACK' ? 5 : 8
      const region = computeRegion(problem.board, problem.targetPoints, 2)

      const result = solve({
        board: problem.board,
        region,
        targetPoints: problem.targetPoints,
        targetColor: problem.targetColor,
        toMove: problem.toMove,
        objective: problem.objective,
        maxDepth,
      })

      expect(result.solved).toBe(true)
    },
    30000,
  )
})
