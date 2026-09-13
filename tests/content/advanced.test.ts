import { describe, expect, it } from 'vitest'
import { toPoint } from '../../src/core/board'
import { cruzDeCinco, rectangularDeSeis } from '../../src/content/seeds'
import { ADVANCED_ENTRIES } from '../../src/content/advanced'
import { applyMove, gameStateFromBoard } from '../../src/core/rules'
import { BLACK, WHITE } from '../../src/core/types'
import type { GameState } from '../../src/core/types'
import { computeRegion } from '../../src/solver/region'
import { solve } from '../../src/solver/tsumego'
import type { RefutationNode } from '../../src/solver/tsumego'

/**
 * Misma disciplina que tests/content/lessons.test.ts para el Nivel 2:
 * Principio 1, ninguna afirmacion de vida/muerte a mano sin el solucionador
 * detras. cruzDeCinco es mas grande (5 espacios) que cualquier forma de
 * Nivel 2 (todas de 3 o 4) -- es exactamente el contenido de la seccion
 * Avanzado, no un reemplazo de esas lecciones.
 */
describe('cruzDeCinco: verificacion con el solucionador', () => {
  it('negro vive si juega primero en el centro', () => {
    const { board, wallPoints } = cruzDeCinco
    const region = computeRegion(board, wallPoints, 1)
    const result = solve({
      board,
      region,
      targetPoints: wallPoints,
      targetColor: BLACK,
      toMove: BLACK,
      objective: 'live',
      maxDepth: 10,
    })
    expect(result.solved).toBe(true)
  })

  // Region mas grande (5 espacios de ojo) que cualquier forma de Nivel 2 --
  // el lado 'kill' explora bastante mas que el 'live' de arriba, ~25-30s en
  // esta maquina, muy por encima del timeout por defecto de vitest.
  it('blanco mata si juega primero en el centro', () => {
    const { board, wallPoints } = cruzDeCinco
    const region = computeRegion(board, wallPoints, 1)
    const result = solve({
      board,
      region,
      targetPoints: wallPoints,
      targetColor: BLACK,
      toMove: WHITE,
      objective: 'kill',
      maxDepth: 10,
    })
    expect(result.solved).toBe(true)
  }, 60000)
})

/**
 * A diferencia de cruzDeCinco (un unico punto vital), rectangularDeSeis
 * tiene DOS puntos miai equivalentes -- no alcanza con `result.solved`
 * (que solo confirma que EL solucionador encontro una jugada ganadora, sin
 * decir cual): hay que revisar los hijos del arbol para confirmar que
 * AMBOS puntos que la demo acepta son de verdad ganadores, no solo uno de
 * los dos con el otro colado por el comentario.
 */
function winningChild(root: RefutationNode, point: number): RefutationNode | undefined {
  return root.children.find((child) => child.move === point)
}

describe('rectangularDeSeis: verificacion con el solucionador', () => {
  const centerTop = toPoint(9, 4, 4)
  const centerBottom = toPoint(9, 4, 5)

  it('negro vive si juega primero en cualquiera de los dos puntos centrales', () => {
    const { board, wallPoints } = rectangularDeSeis
    const region = computeRegion(board, wallPoints, 1)
    const result = solve({
      board,
      region,
      targetPoints: wallPoints,
      targetColor: BLACK,
      toMove: BLACK,
      objective: 'live',
      maxDepth: 10,
    })
    expect(result.solved).toBe(true)
    expect(winningChild(result.root, centerTop)?.liveForDefender).toBe(true)
    expect(winningChild(result.root, centerBottom)?.liveForDefender).toBe(true)
  }, 60000)

  it('blanco mata si juega primero en cualquiera de los dos puntos centrales', () => {
    const { board, wallPoints } = rectangularDeSeis
    const region = computeRegion(board, wallPoints, 1)
    const result = solve({
      board,
      region,
      targetPoints: wallPoints,
      targetColor: BLACK,
      toMove: WHITE,
      objective: 'kill',
      maxDepth: 10,
    })
    expect(result.solved).toBe(true)
    expect(winningChild(result.root, centerTop)?.liveForDefender).toBe(false)
    expect(winningChild(result.root, centerBottom)?.liveForDefender).toBe(false)
  }, 60000)
})

describe('ADVANCED_ENTRIES', () => {
  for (const entry of ADVANCED_ENTRIES) {
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
  }
})
