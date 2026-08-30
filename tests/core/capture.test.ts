import { describe, expect, it } from 'vitest'
import { toPoint } from '../../src/core/board'
import { applyMove, createGame } from '../../src/core/rules'
import { EMPTY } from '../../src/core/types'
import type { GameState } from '../../src/core/types'

function play(state: GameState, x: number, y: number): GameState {
  const result = applyMove(state, toPoint(state.board.size, x, y))
  if (!result.legal || !result.state) {
    throw new Error(`Jugada ilegal en (${x},${y}): ${result.reason}`)
  }
  return result.state
}

describe('captura simple', () => {
  it('retira una piedra rival sin libertades', () => {
    let state = createGame(5, 0)
    state = play(state, 1, 2) // B
    state = play(state, 2, 2) // W, piedra que sera capturada
    state = play(state, 3, 2) // B
    state = play(state, 0, 0) // W filler
    state = play(state, 2, 1) // B
    state = play(state, 4, 0) // W filler

    const capturingMove = toPoint(5, 2, 3)
    const result = applyMove(state, capturingMove) // B captura

    expect(result.legal).toBe(true)
    expect(result.captured).toEqual([toPoint(5, 2, 2)])
    expect(result.state?.board.stones[toPoint(5, 2, 2)]).toBe(EMPTY)
    expect(result.state?.captures.black).toBe(1)
  })
})

describe('captura multiple', () => {
  it('retira un grupo de dos piedras conectadas cuando pierde su ultima libertad', () => {
    let state = createGame(5, 0)
    state = play(state, 1, 1) // B
    state = play(state, 2, 1) // W, primera piedra del grupo
    state = play(state, 3, 1) // B
    state = play(state, 2, 2) // W, conecta y forma el grupo de dos piedras
    state = play(state, 2, 0) // B
    state = play(state, 0, 0) // W filler
    state = play(state, 1, 2) // B
    state = play(state, 4, 0) // W filler
    state = play(state, 3, 2) // B
    state = play(state, 0, 4) // W filler

    const capturingMove = toPoint(5, 2, 3)
    const result = applyMove(state, capturingMove) // B captura el grupo

    expect(result.legal).toBe(true)
    const capturedSet = new Set(result.captured)
    expect(capturedSet).toEqual(new Set([toPoint(5, 2, 1), toPoint(5, 2, 2)]))
    expect(result.state?.board.stones[toPoint(5, 2, 1)]).toBe(EMPTY)
    expect(result.state?.board.stones[toPoint(5, 2, 2)]).toBe(EMPTY)
    expect(result.state?.captures.black).toBe(2)
  })
})
