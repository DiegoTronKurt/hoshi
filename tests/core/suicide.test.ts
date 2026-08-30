import { describe, expect, it } from 'vitest'
import { toPoint } from '../../src/core/board'
import { applyMove, createGame } from '../../src/core/rules'
import type { GameState } from '../../src/core/types'

function play(state: GameState, x: number, y: number): GameState {
  const result = applyMove(state, toPoint(state.board.size, x, y))
  if (!result.legal || !result.state) {
    throw new Error(`Jugada ilegal en (${x},${y}): ${result.reason}`)
  }
  return result.state
}

describe('suicidio', () => {
  it('prohibe jugar en un punto que quedaria sin libertades y no captura nada', () => {
    let state = createGame(5, 0)
    state = play(state, 0, 0) // B filler
    state = play(state, 1, 2) // W
    state = play(state, 4, 4) // B filler
    state = play(state, 3, 2) // W
    state = play(state, 0, 4) // B filler
    state = play(state, 2, 1) // W
    state = play(state, 4, 0) // B filler
    state = play(state, 2, 3) // W

    // Ahora es turno de negro. Jugar en (2,2) quedaria sin libertades:
    // las cuatro piedras blancas vecinas conservan libertades propias.
    const result = applyMove(state, toPoint(5, 2, 2))

    expect(result.legal).toBe(false)
    expect(result.reason).toBe('suicide')
    expect(result.state).toBeUndefined()
  })

  it('permite una jugada que parece suicida si primero captura y libera una libertad', () => {
    let state = createGame(5, 0)
    state = play(state, 0, 2) // B, quita una libertad a la futura piedra blanca (1,2)
    state = play(state, 1, 2) // W, unica libertad restante sera (2,2)
    state = play(state, 1, 1) // B, quita otra libertad a (1,2)
    state = play(state, 3, 2) // W
    state = play(state, 1, 3) // B, deja a (1,2) con una sola libertad: (2,2)
    state = play(state, 2, 1) // W
    state = play(state, 4, 4) // B filler
    state = play(state, 2, 3) // W

    // Negro juega en el centro: captura la piedra blanca (1,2), que se queda
    // sin libertades, y el punto capturado le da su unica libertad.
    const result = applyMove(state, toPoint(5, 2, 2))

    expect(result.legal).toBe(true)
    expect(result.captured).toEqual([toPoint(5, 1, 2)])
  })
})
