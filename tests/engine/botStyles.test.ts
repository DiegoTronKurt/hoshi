import { describe, expect, it } from 'vitest'
import { createBoard, toPoint } from '../../src/core/board'
import { BLACK, WHITE } from '../../src/core/types'
import { prepareStyleContext, styleWeight } from '../../src/engine/botStyles'

describe('styleWeight', () => {
  it('estandar da el mismo peso a cualquier punto, sin sesgo', () => {
    const board = createBoard(9)
    const ctx = prepareStyleContext('standard', board, BLACK)
    const center = toPoint(9, 4, 4)
    const corner = toPoint(9, 0, 0)
    expect(styleWeight(ctx, board, center)).toBe(styleWeight(ctx, board, corner))
  })

  it('territorial prefiere segunda/tercera linea por sobre la primera linea', () => {
    const board = createBoard(9)
    const ctx = prepareStyleContext('territorial', board, BLACK)
    const firstLine = toPoint(9, 0, 4)
    const thirdLine = toPoint(9, 2, 4)
    expect(styleWeight(ctx, board, thirdLine)).toBeGreaterThan(styleWeight(ctx, board, firstLine))
  })

  it('territorial prefiere segunda/tercera linea por sobre el centro profundo', () => {
    const board = createBoard(9)
    const ctx = prepareStyleContext('territorial', board, BLACK)
    const deepCenter = toPoint(9, 4, 4)
    const thirdLine = toPoint(9, 2, 4)
    expect(styleWeight(ctx, board, thirdLine)).toBeGreaterThan(styleWeight(ctx, board, deepCenter))
  })

  it('influencia prefiere puntos abiertos sobre puntos cerca de piedras existentes, a igual distancia de borde', () => {
    const board = createBoard(9)
    board.stones[toPoint(9, 2, 2)] = BLACK
    const ctx = prepareStyleContext('influence', board, BLACK)
    const nearStone = toPoint(9, 2, 3)
    const farOpen = toPoint(9, 6, 6)
    expect(styleWeight(ctx, board, farOpen)).toBeGreaterThan(styleWeight(ctx, board, nearStone))
  })

  it('combativo prefiere contacto directo junto a una piedra rival', () => {
    const board = createBoard(9)
    board.stones[toPoint(9, 4, 4)] = WHITE
    const ctx = prepareStyleContext('combative', board, BLACK)
    const adjacent = toPoint(9, 4, 5)
    const far = toPoint(9, 0, 0)
    expect(styleWeight(ctx, board, adjacent)).toBeGreaterThan(styleWeight(ctx, board, far))
  })

  it('combativo mide distancia a piedras rivales, no propias', () => {
    const board = createBoard(9)
    board.stones[toPoint(9, 4, 4)] = BLACK
    const ctx = prepareStyleContext('combative', board, BLACK)
    const adjacentToOwnStone = toPoint(9, 4, 5)
    const far = toPoint(9, 0, 0)
    expect(styleWeight(ctx, board, adjacentToOwnStone)).toBe(styleWeight(ctx, board, far))
  })
})
