import { chooseMove } from './mcts'
import type { GameState } from '../core/types'

export interface EngineRequest {
  requestId: number
  state: GameState
  playouts: number
  randomSeed?: number
  maxTimeMs?: number
}

export interface EngineResponse {
  requestId: number
  move: number | null
  visits: number
  winRate: number
  playoutsRun: number
}

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const { requestId, state, playouts, randomSeed, maxTimeMs } = event.data
  const result = chooseMove(state, { playouts, randomSeed, maxTimeMs })
  const response: EngineResponse = { requestId, ...result }
  postMessage(response)
}
