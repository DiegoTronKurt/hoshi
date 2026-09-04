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
}

export interface EngineResponse {
  requestId: number
  move: number | null
  visits: number
  winRate: number
  playoutsRun: number
}

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const { requestId, state, playouts, randomSeed, maxTimeMs, style } = event.data
  try {
    const result = chooseMove(state, { playouts, randomSeed, maxTimeMs, style })
    const response: EngineResponse = { requestId, ...result }
    postMessage(response)
  } catch (err) {
    postMessage({ requestId, error: err instanceof Error ? err.message : String(err) })
  }
}
