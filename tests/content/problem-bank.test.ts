import { describe, expect, it } from 'vitest'
import { entryKind, listBankEntries, loadEntry, loadProblem } from '../../src/content/problemBank'
import { computeRegion } from '../../src/solver/region'
import { solve } from '../../src/solver/tsumego'
import { bestAreaMove, isOwnTerritory } from '../../src/solver/areaValue'
import { raceBehindColor, sharedLibertiesOf } from '../../src/solver/semeai'

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

  // areaValue (PASE_PREMATURO/RELLENO_TERRITORIO_PROPIO/EL_FINAL_TAMBIEN_ES_
  // GRANDE/COMPARAR_VALOR_REAL) y semeaiLiberty no tenian ningun re-chequeo
  // al cargar, a diferencia de tsumego arriba -- llenando ese hueco con el
  // mismo patron: re-verificar cada entrada con la MISMA funcion que la
  // valida en vivo (useSolvableExercise.ts), para que un problema mal
  // generado no pueda colarse sin que esto lo note.
  const areaValueEntries = entries.filter((e) => entryKind(e) === 'areaValue')
  it.each(areaValueEntries.map((e) => [e.id, e] as const))('%s sigue siendo un problema de valor de area valido', (_id, entry) => {
    const loaded = loadEntry(entry)
    if (loaded.kind !== 'areaValue') throw new Error('entryKind/loadEntry en desacuerdo')
    const { board, toMove, conceptId } = loaded.problem
    const best = bestAreaMove(board, toMove)

    if (conceptId === 'RELLENO_TERRITORIO_PROPIO') {
      expect(best).toBeNull()
      // La trampa de este concepto es jugar dentro del propio territorio ya
      // sellado: tiene que existir de verdad, si no el ejercicio no ensena
      // nada especifico (mismo criterio que el generador).
      let hasOwnTerritory = false
      for (let p = 0; p < board.stones.length; p++) {
        if (isOwnTerritory(board, p, toMove)) {
          hasOwnTerritory = true
          break
        }
      }
      expect(hasOwnTerritory).toBe(true)
    } else {
      // PASE_PREMATURO, EL_FINAL_TAMBIEN_ES_GRANDE, COMPARAR_VALOR_REAL: las
      // tres afirman que hay una jugada real que vale la pena.
      expect(best).not.toBeNull()
    }
  })

  const semeaiLibertyEntries = entries.filter((e) => entryKind(e) === 'semeaiLiberty')
  it.each(semeaiLibertyEntries.map((e) => [e.id, e] as const))('%s sigue siendo un problema de libertades de semeai valido', (_id, entry) => {
    const loaded = loadEntry(entry)
    if (loaded.kind !== 'semeaiLiberty') throw new Error('entryKind/loadEntry en desacuerdo')
    const { board, conceptId, groupAPoint, groupBPoint } = loaded.problem

    if (conceptId === 'CONTAR_LIBERTADES_ANTES_DE_JUGAR') {
      expect(raceBehindColor(board, groupAPoint, groupBPoint)).not.toBeNull()
    } else {
      const shared = sharedLibertiesOf(board, groupAPoint, groupBPoint)
      expect(shared).not.toBeNull()
      expect(shared?.size).toBeGreaterThan(0)
    }
  })
})
