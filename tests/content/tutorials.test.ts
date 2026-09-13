import { describe, expect, it } from 'vitest'
import { toPoint, toXY } from '../../src/core/board'
import { applyMove, createGame, gameStateFromBoard } from '../../src/core/rules'
import { BLACK, WHITE } from '../../src/core/types'
import type { GameState } from '../../src/core/types'
import { ALPHAGO_LEE_SEDOL_GAMES } from '../../src/content/historicGames'
import { rectangularDeSeis } from '../../src/content/seeds'
import { TUTORIALS } from '../../src/content/tutorials'
import { computeRegion } from '../../src/solver/region'
import { solve } from '../../src/solver/tsumego'
import type { RefutationNode } from '../../src/solver/tsumego'

function winningChild(root: RefutationNode, point: number): RefutationNode | undefined {
  return root.children.find((child) => child.move === point)
}

/**
 * A diferencia de joseki.ts/tesuji.ts, este tutorial no le pide a la red ni
 * al solucionador que confirme que la jugada 78 de la Partida 4 es "buena"
 * -- es un hecho historico (Lee Sedol la jugo de verdad, y gano esta
 * partida), no algo que este proyecto pueda demostrar. Lo que si hay que
 * verificar es que el tutorial reproduce esa historia CON EXACTITUD.
 */
describe('lee-sedol-wedge: fidelidad con la partida real', () => {
  it('la jugada del paso 1 es de verdad la jugada 78 (blanco) de la Partida 4', () => {
    const game = ALPHAGO_LEE_SEDOL_GAMES.find((g) => g.id === 'alphago-leesedol-4')!
    const move78 = game.moves[77]
    expect(move78.color).toBe(WHITE)

    const tutorial = TUTORIALS.find((t) => t.id === 'lee-sedol-wedge')!
    expect(tutorial.demo.steps[0].expectedPoints).toEqual([move78.point])
    expect(tutorial.demo.toMove).toBe(WHITE)

    const [x, y] = toXY(game.width, move78.point!)
    expect([x, y]).toEqual([10, 8])
  })

  it('los pasos 2 a 6 son las jugadas reales 79 a 83, en orden', () => {
    const game = ALPHAGO_LEE_SEDOL_GAMES.find((g) => g.id === 'alphago-leesedol-4')!
    const tutorial = TUTORIALS.find((t) => t.id === 'lee-sedol-wedge')!

    const autoSteps = tutorial.demo.steps.slice(1)
    const expectedMoveNumbers = [79, 80, 81, 82, 83]
    expect(autoSteps.length).toBe(expectedMoveNumbers.length)
    autoSteps.forEach((step, i) => {
      expect(step.auto).toBe(game.moves[expectedMoveNumbers[i] - 1].point)
    })
  })

  it('el tablero inicial de la demo coincide con reproducir las primeras 77 jugadas reales', () => {
    const game = ALPHAGO_LEE_SEDOL_GAMES.find((g) => g.id === 'alphago-leesedol-4')!
    let state: GameState = createGame(game.width, game.height, game.komi)
    for (let i = 0; i < 77; i++) {
      const applied = applyMove(state, game.moves[i].point)
      expect(applied.legal).toBe(true)
      state = applied.state as GameState
    }

    const tutorial = TUTORIALS.find((t) => t.id === 'lee-sedol-wedge')!
    expect(Array.from(tutorial.demo.initialStones)).toEqual(Array.from(state.board.stones))
    expect(tutorial.demo.toMove).toBe(state.toMove)
  })
})

/**
 * A diferencia del tutorial anterior, este es sintetico -- si le pide al
 * solucionador exhaustivo que confirme el resultado, mismo estandar que
 * Avanzado/Tesuji. El hallazgo central (el amague en la esquina rompe la
 * simetria miai de rectangularDeSeis) se verifica desde cero aca, no solo
 * se confia en el comentario de content/tutorials.ts.
 */
describe('rectangle-defense: verificacion con el solucionador', () => {
  it('tras el amague de blanco en la esquina, SOLO uno de los dos centros originales sigue salvando al grupo', () => {
    const { board, wallPoints } = rectangularDeSeis
    const feint = toPoint(board.width, 3, 4)
    const state = gameStateFromBoard(board, WHITE, 6.5)
    const afterFeint = applyMove(state, feint)
    expect(afterFeint.legal).toBe(true)

    const region = computeRegion((afterFeint.state as GameState).board, wallPoints, 1)
    const result = solve({
      board: (afterFeint.state as GameState).board,
      region,
      targetPoints: wallPoints,
      targetColor: BLACK,
      toMove: BLACK,
      objective: 'live',
      maxDepth: 8,
    })
    expect(result.solved).toBe(true)

    const survivingCenter = toPoint(board.width, 4, 4)
    const otherCenter = toPoint(board.width, 4, 5)
    expect(winningChild(result.root, survivingCenter)?.liveForDefender).toBe(true)
    expect(winningChild(result.root, otherCenter)?.liveForDefender).toBe(false)
  }, 30000)

  it('una vez que negro juega el punto que sobrevive, blanco ya no tiene ninguna jugada ganadora en el resto del espacio', () => {
    const { board, wallPoints } = rectangularDeSeis
    const feint = toPoint(board.width, 3, 4)
    const decisive = toPoint(board.width, 4, 4)
    let state = gameStateFromBoard(board, WHITE, 6.5)
    state = applyMove(state, feint).state as GameState
    state = applyMove(state, decisive).state as GameState

    const region = computeRegion(state.board, wallPoints, 1)
    const result = solve({
      board: state.board,
      region,
      targetPoints: wallPoints,
      targetColor: BLACK,
      toMove: WHITE,
      objective: 'kill',
      maxDepth: 8,
    })
    expect(result.solved).toBe(false)
  }, 30000)
})

describe('TUTORIALS', () => {
  for (const entry of TUTORIALS) {
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
