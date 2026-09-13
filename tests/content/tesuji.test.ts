import { describe, expect, it } from 'vitest'
import { toPoint } from '../../src/core/board'
import { getaSeed2 } from '../../src/content/seeds'
import { TESUJI_ENTRIES } from '../../src/content/tesuji'
import { applyMove, gameStateFromBoard } from '../../src/core/rules'
import { BLACK, WHITE } from '../../src/core/types'
import type { GameState } from '../../src/core/types'
import { computeRegion } from '../../src/solver/region'
import { solve } from '../../src/solver/tsumego'
import type { RefutationNode } from '../../src/solver/tsumego'

function winningChild(root: RefutationNode, point: number): RefutationNode | undefined {
  return root.children.find((child) => child.move === point)
}

/**
 * A diferencia de joseki.ts (convencion sin verificacion matematica
 * posible, corroborada solo con la politica de la red), una red (geta) SI
 * tiene un resultado verificable con certeza por el solucionador
 * exhaustivo -- Principio 1 aplica sin excepcion, igual que el resto del
 * contenido de vida y muerte de Aprender/Avanzado. getaSeed2 ya esta
 * reverificada por buildSeedProblems() (tests/content/seeds.test.ts); este
 * archivo confirma ademas, punto por punto, que la secuencia concreta que
 * muestra el demo guiado (content/tesuji.ts) es la que de verdad prueba el
 * punto: las dos libertades de blanco pierden por igual tras la red, y tras
 * la rama que elige mostrar el demo, el grupo queda sin escape.
 */
describe('redGeta: verificacion con el solucionador', () => {
  it('la red en la diagonal ya deja a blanco sin escape, sin importar por cual libertad intente extenderse', () => {
    const { board, targetPoints } = getaSeed2
    const region = computeRegion(board, targetPoints, 2)
    const result = solve({
      board,
      region,
      targetPoints,
      targetColor: WHITE,
      toMove: BLACK,
      objective: 'kill',
      maxDepth: 4,
    })
    expect(result.solved).toBe(true)

    const netted = winningChild(result.root, toPoint(board.width, 0, 0))
    expect(netted?.liveForDefender).toBe(false)

    const escapeUp = netted?.children.find((c) => c.move === toPoint(board.width, 1, 0))
    const escapeLeft = netted?.children.find((c) => c.move === toPoint(board.width, 0, 1))
    expect(escapeUp?.liveForDefender).toBe(false)
    expect(escapeLeft?.liveForDefender).toBe(false)
  }, 30000)

  it('tras la rama que muestra el demo (blanco arriba, negro cierra), el grupo ya no tiene escape', () => {
    const { board, targetPoints } = getaSeed2
    const state = gameStateFromBoard(board, BLACK, 6.5)
    const netted = applyMove(state, toPoint(board.width, 0, 0))
    expect(netted.legal).toBe(true)
    const escaped = applyMove(netted.state as GameState, toPoint(board.width, 1, 0))
    expect(escaped.legal).toBe(true)

    const region = computeRegion(board, targetPoints, 2)
    const result = solve({
      board: (escaped.state as GameState).board,
      region,
      targetPoints,
      targetColor: WHITE,
      toMove: BLACK,
      objective: 'kill',
      maxDepth: 4,
    })
    expect(result.solved).toBe(true)

    const closed = winningChild(result.root, toPoint(board.width, 2, 0))
    expect(closed?.liveForDefender).toBe(false)
    for (const grandchild of closed?.children ?? []) {
      expect(grandchild.liveForDefender).toBe(false)
    }
  }, 30000)
})

describe('TESUJI_ENTRIES', () => {
  for (const entry of TESUJI_ENTRIES) {
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
