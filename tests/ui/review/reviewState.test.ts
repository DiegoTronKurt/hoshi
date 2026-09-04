import { describe, expect, it } from 'vitest'
import { toPoint } from '../../../src/core/board'
import { BLACK, EMPTY, WHITE } from '../../../src/core/types'
import type { RecordedMove } from '../../../src/core/sgf'
import { stateAtMove } from '../../../src/ui/review/reviewState'

describe('stateAtMove', () => {
  it('moveNumber <= 0 devuelve el estado inicial sin tocar', () => {
    const moves: RecordedMove[] = [{ color: BLACK, point: toPoint(9, 4, 4) }]
    const state = stateAtMove(9, 9, 6.5, moves, 0)

    expect(state.moveNumber).toBe(0)
    expect(state.board.stones.every((s) => s === EMPTY)).toBe(true)
  })

  it('aplica moves[0..moveNumber-1] inclusive de moves[moveNumber-1]', () => {
    const moves: RecordedMove[] = [
      { color: BLACK, point: toPoint(9, 2, 2) },
      { color: WHITE, point: toPoint(9, 6, 6) },
      { color: BLACK, point: toPoint(9, 3, 3) },
    ]
    const state = stateAtMove(9, 9, 6.5, moves, 2)

    expect(state.board.stones[toPoint(9, 2, 2)]).toBe(BLACK)
    expect(state.board.stones[toPoint(9, 6, 6)]).toBe(WHITE)
    expect(state.board.stones[toPoint(9, 3, 3)]).toBe(EMPTY) // moves[2] todavia no se aplico
    expect(state.toMove).toBe(BLACK) // le toca al rival de quien jugo moves[1] (blanco)
  })

  it('tablero rectangular (9x13): width y height no se confunden entre si', () => {
    // (4, 12): valido solo si el tablero realmente mide 13 de alto -- en un
    // 9x9 este punto ni siquiera existe. Canario directo sobre el mismo
    // GameState devuelto, sin pasar por deteccion de errores.
    const point = toPoint(9, 4, 12)
    const moves: RecordedMove[] = [{ color: BLACK, point }]
    const state = stateAtMove(9, 13, 6.5, moves, 1)

    expect(state.board.width).toBe(9)
    expect(state.board.height).toBe(13)
    expect(state.board.stones.length).toBe(9 * 13)
    expect(state.board.stones[point]).toBe(BLACK)
  })

  it('una jugada ilegal corta la reproduccion ahi, sin lanzar', () => {
    const moves: RecordedMove[] = [
      { color: BLACK, point: toPoint(9, 2, 2) },
      { color: WHITE, point: toPoint(9, 2, 2) }, // punto ya ocupado: ilegal
      { color: BLACK, point: toPoint(9, 3, 3) },
    ]
    const state = stateAtMove(9, 9, 6.5, moves, 3)

    expect(state.board.stones[toPoint(9, 2, 2)]).toBe(BLACK) // moves[0] si se aplico
    expect(state.board.stones[toPoint(9, 3, 3)]).toBe(EMPTY) // nunca se llego a moves[2]
    expect(state.toMove).toBe(WHITE) // se corto justo despues de moves[0]
  })
})
