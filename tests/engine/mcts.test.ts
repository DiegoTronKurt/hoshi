import { describe, expect, it } from 'vitest'
import { toPoint } from '../../src/core/board'
import { applyMove, createGame } from '../../src/core/rules'
import { EMPTY, WHITE } from '../../src/core/types'
import { chooseMove } from '../../src/engine/mcts'

describe('MCTS', () => {
  it('elige siempre una jugada legal en una posicion inicial', () => {
    const state = createGame(5, 5, 6.5)
    const result = chooseMove(state, { playouts: 60, randomSeed: 1 })

    expect(result.playoutsRun).toBe(60)
    if (result.move !== null) {
      expect(state.board.stones[result.move]).toBe(EMPTY)
    }
  })

  it('con la misma semilla y la misma posicion elige siempre la misma jugada', () => {
    const state = createGame(5, 5, 6.5)
    const first = chooseMove(state, { playouts: 80, randomSeed: 123 })
    const second = chooseMove(state, { playouts: 80, randomSeed: 123 })

    expect(second.move).toBe(first.move)
    expect(second.visits).toBe(first.visits)
  })

  it('no juega mas alla del final de la partida', () => {
    let state = createGame(5, 5, 6.5)
    state = applyMove(state, null).state! // B pasa
    state = applyMove(state, null).state! // W pasa, partida terminada

    const result = chooseMove(state, { playouts: 50, randomSeed: 1 })

    expect(result.move).toBeNull()
    expect(result.playoutsRun).toBe(0)
  })

  it('respeta el limite de tiempo si se agota antes de correr todas las simulaciones', () => {
    const state = createGame(9, 9, 6.5)
    const result = chooseMove(state, { playouts: 1_000_000, randomSeed: 1, maxTimeMs: 200 })

    expect(result.playoutsRun).toBeLessThan(1_000_000)
    expect(result.playoutsRun).toBeGreaterThan(0)
  })

  it('acepta pasar sin buscar si el rival acaba de pasar y ya va ganando', () => {
    let state = createGame(5, 5, 6.5)
    state = applyMove(state, null).state! // negro pasa en el primerisimo turno: blanco ya gana por komi

    const result = chooseMove(state, { playouts: 500, randomSeed: 1 })

    expect(result.move).toBeNull()
    expect(result.playoutsRun).toBe(0)
  })

  it('no acepta pasar si hay una captura gratis disponible, aunque el rival haya pasado', () => {
    let state = createGame(5, 5, 6.5)
    state = applyMove(state, 12).state! // B (2,2)
    state = applyMove(state, 11).state! // W (1,2)
    state = applyMove(state, 0).state! // B relleno, lejos
    state = applyMove(state, 7).state! // W (2,1)
    state = applyMove(state, 4).state! // B relleno, lejos
    state = applyMove(state, 13).state! // W (3,2): la piedra negra de 12 queda en atari, unica libertad en 17
    state = applyMove(state, null).state! // B pasa

    expect(state.consecutivePasses).toBe(1)
    expect(state.toMove).toBe(WHITE)

    const result = chooseMove(state, { playouts: 20, randomSeed: 1 })
    expect(result.playoutsRun).toBeGreaterThan(0) // no debe aceptar pasar habiendo una captura gratis
  })

  it('con pocos playouts (menos que puntos legales) y una prioridad de raiz muy sesgada, esa jugada termina siendo la elegida', () => {
    // Con 10 playouts y 25 puntos legales, ningun nodo alcanza a expandirse
    // dos veces -- exactamente el caso real de bajo presupuesto (nivel
    // "weak", ver strengthLevels.ts) donde el orden de expansion decide casi
    // todo, sin tiempo para que UCT lo corrija despues. Esquina (0,0) a
    // proposito: una jugada que el MCTS llano NO elige de forma consistente
    // sin ayuda (confirmado con el mismo escenario sin prior, mas abajo).
    const state = createGame(5, 5, 6.5)
    const favored = toPoint(5, 0, 0)
    const rootPriors = new Map<number | null, number>([[favored, 0.97]])

    for (const seed of [1, 7, 42, 99, 123]) {
      const result = chooseMove(state, { playouts: 10, randomSeed: seed, rootPriors })
      expect(result.move).toBe(favored)
    }
  })

  it('sin prioridad de raiz, el mismo escenario de pocos playouts NO converge siempre a la misma jugada', () => {
    const state = createGame(5, 5, 6.5)
    const moves = [1, 7, 42, 99, 123].map((seed) => chooseMove(state, { playouts: 10, randomSeed: seed }).move)

    expect(new Set(moves).size).toBeGreaterThan(1)
  })

  it('no acepta pasar si va perdiendo en el marcador, aunque el rival haya pasado', () => {
    const blackPoints = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]
    let state = createGame(5, 5, 6.5)
    for (let i = 0; i < blackPoints.length; i++) {
      state = applyMove(state, blackPoints[i]).state! // negro coloca una piedra
      // blanco pasa en todos sus turnos salvo el ultimo (una piedra real evita
      // terminar la partida por doble pase antes de llegar al pase final de negro)
      state = applyMove(state, i === blackPoints.length - 1 ? 24 : null).state!
    }
    state = applyMove(state, null).state! // negro pasa: 10 piedras propias contra 1+komi de blanco

    expect(state.consecutivePasses).toBe(1)
    expect(state.toMove).toBe(WHITE)

    const result = chooseMove(state, { playouts: 20, randomSeed: 1 })
    expect(result.playoutsRun).toBeGreaterThan(0) // no debe aceptar pasar yendo perdiendo
  })
})
