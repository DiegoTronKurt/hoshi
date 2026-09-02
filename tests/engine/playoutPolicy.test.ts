import { describe, expect, it } from 'vitest'
import { createBoard, toPoint } from '../../src/core/board'
import { applyMove, createGame, gameStateFromBoard } from '../../src/core/rules'
import { BLACK, WHITE } from '../../src/core/types'
import type { BoardState, Color, GameState } from '../../src/core/types'
import { findAtariSavingMoves, findCapturingMoves, isSimpleEye, resultsInSelfAtari } from '../../src/engine/playoutPolicy'

function place(board: BoardState, color: Color, points: Array<[number, number]>): void {
  for (const [x, y] of points) {
    board.stones[toPoint(board.width, x, y)] = color
  }
}

function play(state: GameState, x: number, y: number): GameState {
  const result = applyMove(state, toPoint(state.board.width, x, y))
  if (!result.legal || !result.state) {
    throw new Error(`Jugada ilegal en (${x},${y}): ${result.reason}`)
  }
  return result.state
}

describe('isSimpleEye', () => {
  it('un punto central rodeado por el mismo color, sin piedras rivales en diagonal, es un ojo simple', () => {
    const board = createBoard(5)
    place(board, BLACK, [[1, 2], [3, 2], [2, 1], [2, 3]])
    expect(isSimpleEye(board, toPoint(5, 2, 2), BLACK)).toBe(true)
  })

  it('un punto central con dos piedras rivales en diagonal es un ojo falso', () => {
    const board = createBoard(5)
    place(board, BLACK, [[1, 2], [3, 2], [2, 1], [2, 3]])
    place(board, WHITE, [[1, 1], [3, 3]])
    expect(isSimpleEye(board, toPoint(5, 2, 2), BLACK)).toBe(false)
  })

  it('un punto de borde no tolera ninguna piedra rival en diagonal', () => {
    const board = createBoard(5)
    place(board, BLACK, [[1, 2], [0, 1], [0, 3]])
    expect(isSimpleEye(board, toPoint(5, 0, 2), BLACK)).toBe(true)

    place(board, WHITE, [[1, 1]])
    expect(isSimpleEye(board, toPoint(5, 0, 2), BLACK)).toBe(false)
  })

  it('un punto ocupado nunca es un ojo', () => {
    const board = createBoard(5)
    place(board, BLACK, [[2, 2]])
    expect(isSimpleEye(board, toPoint(5, 2, 2), BLACK)).toBe(false)
  })
})

describe('findAtariSavingMoves', () => {
  it('encuentra la unica libertad de un grupo propio en atari', () => {
    let state = createGame(5, 5, 0)
    state = play(state, 2, 2) // B
    state = play(state, 1, 2) // W
    state = play(state, 4, 4) // B filler
    state = play(state, 3, 2) // W
    state = play(state, 0, 4) // B filler
    state = play(state, 2, 1) // W, deja a B(2,2) con una sola libertad: (2,3)

    expect(findAtariSavingMoves(state)).toEqual([toPoint(5, 2, 3)])
  })

  it('no reporta nada si ningun grupo propio esta en atari', () => {
    const state = createGame(5, 5, 0)
    expect(findAtariSavingMoves(state)).toEqual([])
  })
})

describe('findCapturingMoves', () => {
  it('encuentra el punto que capturaria un grupo rival en atari', () => {
    const board = createBoard(5)
    place(board, WHITE, [[2, 2]])
    place(board, BLACK, [[1, 2], [3, 2], [2, 1]])
    const state = gameStateFromBoard(board, BLACK)

    expect(findCapturingMoves(state)).toEqual([toPoint(5, 2, 3)])
  })

  it('no reporta nada si ningun grupo rival esta en atari', () => {
    const state = createGame(5, 5, 0)
    expect(findCapturingMoves(state)).toEqual([])
  })
})

describe('resultsInSelfAtari', () => {
  it('detecta que jugar en un punto deja al grupo propio con una sola libertad', () => {
    const board = createBoard(5)
    place(board, WHITE, [[1, 2], [3, 2], [2, 1]])
    board.stones[toPoint(5, 2, 2)] = BLACK
    expect(resultsInSelfAtari(board, toPoint(5, 2, 2))).toBe(true)
  })

  it('no reporta auto-atari cuando el grupo tiene mas de una libertad', () => {
    const board = createBoard(5)
    board.stones[toPoint(5, 2, 2)] = BLACK
    expect(resultsInSelfAtari(board, toPoint(5, 2, 2))).toBe(false)
  })
})
