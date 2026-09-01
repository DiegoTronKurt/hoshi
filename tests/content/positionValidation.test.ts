import { describe, expect, it } from 'vitest'
import { createBoard, toPoint } from '../../src/core/board'
import { BLACK, WHITE } from '../../src/core/types'
import { hasNoZeroLibertyGroups, isSingleGroup } from '../../src/content/positionValidation'

describe('isSingleGroup', () => {
  it('un tablero vacio de un color cuenta como un solo grupo (vacuamente)', () => {
    const board = createBoard(9)
    expect(isSingleGroup(board, BLACK)).toBe(true)
  })

  it('piedras del mismo color conectadas ortogonalmente forman un solo grupo', () => {
    const board = createBoard(9)
    board.stones[toPoint(9, 2, 2)] = BLACK
    board.stones[toPoint(9, 3, 2)] = BLACK
    board.stones[toPoint(9, 3, 3)] = BLACK
    expect(isSingleGroup(board, BLACK)).toBe(true)
  })

  it('dos piedras del mismo color sin conexion ortogonal son dos grupos, no uno', () => {
    const board = createBoard(9)
    board.stones[toPoint(9, 2, 2)] = BLACK
    board.stones[toPoint(9, 5, 5)] = BLACK
    expect(isSingleGroup(board, BLACK)).toBe(false)
  })

  it('una conexion solo diagonal no cuenta como conectada', () => {
    const board = createBoard(9)
    board.stones[toPoint(9, 2, 2)] = BLACK
    board.stones[toPoint(9, 3, 3)] = BLACK
    expect(isSingleGroup(board, BLACK)).toBe(false)
  })
})

describe('hasNoZeroLibertyGroups', () => {
  it('un tablero vacio es legal', () => {
    const board = createBoard(9)
    expect(hasNoZeroLibertyGroups(board)).toBe(true)
  })

  it('una piedra con libertades es legal', () => {
    const board = createBoard(9)
    board.stones[toPoint(9, 4, 4)] = BLACK
    expect(hasNoZeroLibertyGroups(board)).toBe(true)
  })

  it('detecta un grupo rodeado sin ninguna libertad', () => {
    const board = createBoard(9)
    // Negro en (0,0), rodeado por blanco en sus dos unicos vecinos.
    board.stones[toPoint(9, 0, 0)] = BLACK
    board.stones[toPoint(9, 1, 0)] = WHITE
    board.stones[toPoint(9, 0, 1)] = WHITE
    expect(hasNoZeroLibertyGroups(board)).toBe(false)
  })
})
