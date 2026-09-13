import { describe, expect, it } from 'vitest'
import { JOSEKI_ENTRIES } from '../../src/content/joseki'
import { applyMove, gameStateFromBoard } from '../../src/core/rules'
import type { GameState } from '../../src/core/types'

/**
 * Verificacion mecanica (no solo lectura de codigo): reproduce cada demo de
 * joseki paso a paso contra el motor de reglas real, igual criterio que
 * tests/content/lessons.test.ts aplica a las demos de Aprender. Un joseki no
 * tiene un resultado de vida/muerte que el solucionador pueda confirmar (ver
 * el comentario de content/joseki.ts) -- lo que si se puede y se debe
 * verificar mecanicamente es que la secuencia declarada sea real: cada
 * jugada legal, en el orden declarado, sin pisar una piedra existente ni
 * violar ninguna regla.
 */
describe('JOSEKI_ENTRIES', () => {
  for (const entry of JOSEKI_ENTRIES) {
    it(`${entry.id}: cada paso de la demo es una jugada legal, en el orden declarado`, () => {
      const { demo } = entry
      let state: GameState = gameStateFromBoard(
        { width: demo.width, height: demo.height, stones: demo.initialStones },
        demo.toMove,
      )

      for (const step of demo.steps) {
        if (step.auto !== undefined && step.auto !== false) {
          const point = step.auto === true ? null : step.auto
          const result = applyMove(state, point)
          expect(result.legal).toBe(true)
          state = result.state as GameState
          continue
        }

        expect(step.expectedPoints.length).toBeGreaterThan(0)
        for (const point of step.expectedPoints) {
          expect(applyMove(state, point).legal).toBe(true)
        }
        const result = applyMove(state, step.expectedPoints[0])
        state = result.state as GameState
      }
    })

    it(`${entry.id}: no repite dos veces el mismo id de traduccion entre sus pasos`, () => {
      const keys = entry.demo.steps.flatMap((step) => [step.promptKey, step.feedbackKey])
      expect(new Set(keys).size).toBe(keys.length)
    })
  }
})
