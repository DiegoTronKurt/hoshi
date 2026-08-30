import { describe, expect, it } from 'vitest'
import { applyMove, createGame } from '../../src/core/rules'
import { EMPTY } from '../../src/core/types'
import { chooseMove } from '../../src/engine/mcts'

describe('MCTS', () => {
  it('elige siempre una jugada legal en una posicion inicial', () => {
    const state = createGame(5, 6.5)
    const result = chooseMove(state, { playouts: 60, randomSeed: 1 })

    expect(result.playoutsRun).toBe(60)
    if (result.move !== null) {
      expect(state.board.stones[result.move]).toBe(EMPTY)
    }
  })

  it('con la misma semilla y la misma posicion elige siempre la misma jugada', () => {
    const state = createGame(5, 6.5)
    const first = chooseMove(state, { playouts: 80, randomSeed: 123 })
    const second = chooseMove(state, { playouts: 80, randomSeed: 123 })

    expect(second.move).toBe(first.move)
    expect(second.visits).toBe(first.visits)
  })

  it('no juega mas alla del final de la partida', () => {
    let state = createGame(5, 6.5)
    state = applyMove(state, null).state! // B pasa
    state = applyMove(state, null).state! // W pasa, partida terminada

    const result = chooseMove(state, { playouts: 50, randomSeed: 1 })

    expect(result.move).toBeNull()
    expect(result.playoutsRun).toBe(0)
  })

  it('respeta el limite de tiempo si se agota antes de correr todas las simulaciones', () => {
    const state = createGame(9, 6.5)
    const result = chooseMove(state, { playouts: 1_000_000, randomSeed: 1, maxTimeMs: 200 })

    expect(result.playoutsRun).toBeLessThan(1_000_000)
    expect(result.playoutsRun).toBeGreaterThan(0)
  })
})
