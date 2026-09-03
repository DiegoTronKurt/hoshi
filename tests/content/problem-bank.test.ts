import { describe, expect, it } from 'vitest'
import { entryKind, listBankEntries, loadProblem } from '../../src/content/problemBank'
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

  // useSolvableExercise.ts (la pantalla real de Ejercicios/Hoy) resuelve en
  // vivo con margin=1, mas angosto que el margin=2 de arriba (el que usa el
  // generador para aceptar un problema). Encontrado en produccion: 4
  // problemas DOS_OJOS (p57/p65/p71/p73, ya reemplazados) que el generador
  // aceptaba con margin=2 pero que el margin=1 en vivo declaraba
  // irresolubles, porque la region angosta le recortaba al defensor un punto
  // real que necesitaba para el segundo ojo. Este chequeo reproduce
  // exactamente ese regimen para que esta clase de bug no pueda volver a
  // colarse sin que CI lo note, sin importar si el problema se genero con
  // tools/generate-problems.ts o se edito el bank.json a mano.
  const tsumegoEntries = entries.filter((e) => entryKind(e) === 'tsumego')
  it.each(tsumegoEntries.map((e) => [e.id, e] as const))(
    '%s tambien resuelve con el margin=1 que usa Ejercicios/Hoy en vivo',
    (_id, entry) => {
      const problem = loadProblem(entry)
      const maxDepth = problem.conceptId === 'RED_GETA' || problem.conceptId === 'SNAPBACK' ? 5 : 8
      const region = computeRegion(problem.board, problem.targetPoints, 1)

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
