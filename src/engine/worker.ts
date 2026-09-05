import type { BotStyleId } from './botStyles'
import { chooseMove } from './mcts'
import type { GameState } from '../core/types'

export interface EngineRequest {
  requestId: number
  state: GameState
  playouts: number
  randomSeed?: number
  maxTimeMs?: number
  style?: BotStyleId
  /** Ver MctsOptions::rootPriors en engine/mcts.ts. */
  rootPriors?: Map<number | null, number>
}

export interface EngineResponse {
  requestId: number
  move: number | null
  visits: number
  winRate: number
  playoutsRun: number
}

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const { requestId, state, playouts, randomSeed, maxTimeMs, style, rootPriors } = event.data
  try {
    const result = chooseMove(state, { playouts, randomSeed, maxTimeMs, style, rootPriors })
    const response: EngineResponse = { requestId, ...result }
    postMessage(response)
  } catch (err) {
    postMessage({ requestId, error: err instanceof Error ? err.message : String(err) })
  }
}
