import { describe, expect, it } from 'vitest'
import { createBoard, toPoint } from '../../src/core/board'
import { applyMove, gameStateFromBoard } from '../../src/core/rules'
import { BLACK, WHITE } from '../../src/core/types'
import type { GameState } from '../../src/core/types'
import type { EvalPosition } from '../../src/eval/features'
import type { RawEvalOutput } from '../../src/eval/model'
import {
  decodeEvalPosition,
  decodeRawEvalOutput,
  encodeEvalPosition,
  encodeRawEvalOutput,
} from '../../src/eval/wireFormat'

// El chequeo real de superko recorre state.history entero (historyContains
// en core/rules.ts) -- por eso el round-trip tiene que preservar la cadena
// COMPLETA de hashes, no solo el mas reciente. Jugar de verdad unas jugadas
// (en vez de armar un HistoryNode a mano) es la unica forma de tener una
// cadena de mas de un nodo con hashes reales, no inventados.
function playRealMoves(state: GameState, points: (number | null)[]): GameState {
  let current = state
  for (const point of points) {
    const result = applyMove(current, point)
    if (!result.legal || !result.state) throw new Error('jugada de prueba invalida')
    current = result.state
  }
  return current
}

describe('encodeEvalPosition / decodeEvalPosition (round-trip)', () => {
  it('preserva un estado fresco (historial de un solo nodo)', () => {
    const state = gameStateFromBoard(createBoard(9), BLACK, 6.5)
    const position: EvalPosition = { state }

    const decoded = decodeEvalPosition(encodeEvalPosition(position))

    expect(decoded.state.board.width).toBe(9)
    expect(Array.from(decoded.state.board.stones)).toEqual(Array.from(state.board.stones))
    expect(decoded.state.toMove).toBe(BLACK)
    expect(decoded.state.komi).toBe(6.5)
    expect(decoded.state.history.hash).toBe(state.history.hash)
    expect(decoded.state.history.prev).toBeNull()
  })

  it('preserva la cadena de historial completa (varios nodos, hashes reales) -- el chequeo de superko depende de esto', () => {
    const width = 9
    let state = gameStateFromBoard(createBoard(width), BLACK, 6.5)
    state = playRealMoves(state, [toPoint(width, 2, 2), toPoint(width, 3, 2), toPoint(width, 4, 4), null])

    const decoded = decodeEvalPosition(encodeEvalPosition({ state })).state

    const originalHashes: bigint[] = []
    for (let n: typeof state.history | null = state.history; n; n = n.prev) originalHashes.push(n.hash)
    const decodedHashes: bigint[] = []
    for (let n: typeof decoded.history | null = decoded.history; n; n = n.prev) decodedHashes.push(n.hash)

    expect(decodedHashes).toEqual(originalHashes)
    expect(decodedHashes.length).toBeGreaterThan(1)
  })

  it('preserva recentMoves y priorBoards cuando estan presentes', () => {
    const width = 9
    const state = gameStateFromBoard(createBoard(width), WHITE, 6.5)
    const position: EvalPosition = {
      state,
      recentMoves: [
        { color: BLACK, point: toPoint(width, 0, 0) },
        { color: WHITE, point: null },
      ],
      priorBoards: [createBoard(width), createBoard(width)],
    }

    const decoded = decodeEvalPosition(encodeEvalPosition(position))

    expect(decoded.recentMoves).toEqual(position.recentMoves)
    expect(decoded.priorBoards?.length).toBe(2)
    expect(Array.from(decoded.priorBoards![0].stones)).toEqual(Array.from(position.priorBoards![0].stones))
  })

  it('un estado sin recentMoves/priorBoards decodifica sin esos campos (no los inventa como arreglos vacios)', () => {
    const state = gameStateFromBoard(createBoard(9), BLACK, 6.5)
    const decoded = decodeEvalPosition(encodeEvalPosition({ state }))
    expect(decoded.recentMoves).toBeUndefined()
    expect(decoded.priorBoards).toBeUndefined()
  })
})

describe('encodeRawEvalOutput / decodeRawEvalOutput (round-trip)', () => {
  it('preserva policy/value/ownership', () => {
    const policy = new Float32Array(362)
    policy[5] = 0.7
    policy[361] = 0.3
    const ownership = new Float32Array(81).fill(-1)
    ownership[0] = 1
    const output: RawEvalOutput = { policy, value: [0.6, 0.3, 0.1], ownership }

    const decoded = decodeRawEvalOutput(encodeRawEvalOutput(output))

    expect(Array.from(decoded.policy)).toEqual(Array.from(policy))
    expect(decoded.value).toEqual([0.6, 0.3, 0.1])
    expect(Array.from(decoded.ownership)).toEqual(Array.from(ownership))
  })
})
