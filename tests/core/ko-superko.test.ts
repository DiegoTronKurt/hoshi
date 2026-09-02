import { describe, expect, it } from 'vitest'
import { toPoint } from '../../src/core/board'
import { applyMove, createGame } from '../../src/core/rules'
import type { GameState } from '../../src/core/types'

function play(state: GameState, x: number, y: number): GameState {
  const result = applyMove(state, toPoint(state.board.width, x, y))
  if (!result.legal || !result.state) {
    throw new Error(`Jugada ilegal en (${x},${y}): ${result.reason}`)
  }
  return result.state
}

// Forma clasica de ko: una piedra blanca en atari cuya unica libertad, al ser
// capturada por negro, deja una piedra negra tambien en atari sobre el mismo
// punto que acaba de vaciarse.
function setUpKo(): GameState {
  let state = createGame(5, 5, 0)
  state = play(state, 1, 2) // B, reduce libertades de Y
  state = play(state, 2, 2) // W = Y, la piedra que quedara en atari
  state = play(state, 2, 1) // B, reduce libertades de Y
  state = play(state, 4, 2) // W, vecino de X con libertad propia
  state = play(state, 2, 3) // B, deja a Y con una sola libertad: X=(3,2)
  state = play(state, 3, 1) // W, vecino de X con libertad propia
  state = play(state, 0, 0) // B filler
  state = play(state, 3, 3) // W, vecino de X con libertad propia
  return state
}

describe('ko y superko posicional', () => {
  it('prohibe la recaptura inmediata que reproduce la posicion anterior', () => {
    const before = setUpKo()

    const capture = applyMove(before, toPoint(5, 3, 2)) // B captura Y=(2,2)
    expect(capture.legal).toBe(true)
    expect(capture.captured).toEqual([toPoint(5, 2, 2)])

    const recapture = applyMove(capture.state as GameState, toPoint(5, 2, 2)) // W intenta recapturar
    expect(recapture.legal).toBe(false)
    expect(recapture.reason).toBe('superko')
  })

  it('permite recapturar una vez que una jugada intermedia cambia la posicion', () => {
    const before = setUpKo()
    const capture = applyMove(before, toPoint(5, 3, 2)) // B captura Y=(2,2)
    let state = capture.state as GameState

    state = play(state, 0, 4) // W juega una amenaza de ko en otro lugar
    state = play(state, 4, 4) // B responde en otro lugar

    // La posicion ya no es identica a ninguna anterior: ahora es legal.
    const recapture = applyMove(state, toPoint(5, 2, 2))
    expect(recapture.legal).toBe(true)
    expect(recapture.captured).toEqual([toPoint(5, 3, 2)])
  })
})
