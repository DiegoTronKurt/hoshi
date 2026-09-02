import { beforeAll, describe, expect, it } from 'vitest'
import { buildSeedProblems } from '../../src/content/seeds'
import { problemToSgf, sgfToProblem } from '../../src/content/problemSgf'
import { computeRegion } from '../../src/solver/region'
import { solve } from '../../src/solver/tsumego'
import type { Problem } from '../../src/content/problemSgf'

// buildSeedProblems() reverifica cada variante (plantilla x 8 transformaciones
// diedrales) con el solucionador antes de aceptarla, asi que es lenta a
// proposito (geta y snapback en particular, con regiones mas abiertas que
// las formas de ojo). Se calcula una sola vez para las dos pruebas de este
// archivo en vez de duplicar el costo.
let problems: Problem[]
beforeAll(() => {
  problems = buildSeedProblems()
}, 120000)

describe('posiciones semilla', () => {
  it('produce al menos una posicion semilla verificada por el solucionador', () => {
    expect(problems.length).toBeGreaterThan(0)
  })

  it('cada semilla sobrevive el round trip a SGF y se vuelve a verificar igual (invariante del generador)', () => {
    for (const problem of problems) {
      const sgf = problemToSgf(problem)
      const reloaded = sgfToProblem(sgf)

      expect(Array.from(reloaded.board.stones)).toEqual(Array.from(problem.board.stones))
      expect(reloaded.objective).toBe(problem.objective)
      expect(reloaded.toMove).toBe(problem.toMove)
      expect(reloaded.conceptId).toBe(problem.conceptId)

      // Margen y profundidad iguales a los mas exigentes usados en la
      // generacion (geta/snapback, ver content/seeds.ts): las formas de ojo
      // no necesitan tanto (su region ya queda chica por el relleno de
      // blanco), pero usar el mismo valor para todas mantiene esta
      // reverificacion honesta con lo que de verdad se genero, en vez de
      // adivinar un numero distinto por tipo de problema.
      const region = computeRegion(reloaded.board, reloaded.targetPoints, 2)
      const result = solve({
        board: reloaded.board,
        region,
        targetPoints: reloaded.targetPoints,
        targetColor: reloaded.targetColor,
        toMove: reloaded.toMove,
        objective: reloaded.objective,
        maxDepth: 5,
      })

      expect(result.solved).toBe(true)
    }
  }, 180000)
})
