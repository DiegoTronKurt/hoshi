import { describe, expect, it } from 'vitest'
import { createBoard, toPoint } from '../../src/core/board'
import { BLACK, WHITE } from '../../src/core/types'
import { findDoubleAtariMoves, isDoubleAtariMove } from '../../src/solver/doubleAtari'

const SIZE = 9
const p = (x: number, y: number) => toPoint(SIZE, x, y)

describe('doble atari', () => {
  it('detecta una jugada que deja a dos grupos rivales distintos en atari a la vez', () => {
    const board = createBoard(SIZE)
    board.stones[p(2, 2)] = WHITE
    board.stones[p(1, 2)] = BLACK
    board.stones[p(2, 1)] = BLACK
    board.stones[p(4, 2)] = WHITE
    board.stones[p(5, 2)] = BLACK
    board.stones[p(4, 1)] = BLACK

    expect(isDoubleAtariMove(board, p(3, 2), BLACK)).toBe(true)
    expect(findDoubleAtariMoves(board, BLACK)).toContain(p(3, 2))
  })

  it('no cuenta si solo un grupo queda en atari', () => {
    const board = createBoard(SIZE)
    board.stones[p(2, 2)] = WHITE
    board.stones[p(1, 2)] = BLACK
    board.stones[p(2, 1)] = BLACK

    expect(isDoubleAtariMove(board, p(3, 2), BLACK)).toBe(false)
  })

  it('no cuenta un grupo que ya estaba en atari antes de la jugada', () => {
    const board = createBoard(SIZE)
    // Grupo A ya en atari de antemano (una sola libertad: (3,2)).
    board.stones[p(2, 2)] = WHITE
    board.stones[p(1, 2)] = BLACK
    board.stones[p(2, 1)] = BLACK
    board.stones[p(2, 3)] = BLACK
    // Grupo B con dos libertades, una de ellas tambien (3,2).
    board.stones[p(4, 2)] = WHITE
    board.stones[p(5, 2)] = BLACK
    board.stones[p(4, 1)] = BLACK

    // Jugar (3,2) captura al grupo A (ya sin libertades), asi que no es un
    // doble atari real: solo produce un atari nuevo (el del grupo B).
    expect(isDoubleAtariMove(board, p(3, 2), BLACK)).toBe(false)
  })
})
