import type { BotStyleId } from './botStyles'
import { chooseMove } from './mcts'
import { chooseMoveWithNet } from './mctsNet'
import { loadModel } from '../eval/model'
import type { EvalMove } from '../eval/features'
import type { BoardState, GameState } from '../core/types'

export interface EngineRequest {
  requestId: number
  state: GameState
  playouts: number
  randomSeed?: number
  maxTimeMs?: number
  style?: BotStyleId
  /** Ver MctsOptions::rootPriors en engine/mcts.ts. */
  rootPriors?: Map<number | null, number>
  /** Presente: usa la busqueda guiada por red (engine/mctsNet.ts) en vez
   * del MCTS clasico de arriba -- randomSeed/style/rootPriors no aplican en
   * ese modo (mctsNet no tiene rollout aleatorio ni estilo de juego, y
   * calcula su propia prioridad de raiz con la misma llamada a la red que
   * usa para el resto del arbol). */
  net?: { modelUrl: string; recentMoves?: EvalMove[]; priorBoards?: BoardState[] }
}

export interface EngineResponse {
  requestId: number
  move: number | null
  visits: number
  winRate: number
  playoutsRun: number
}

self.onmessage = async (event: MessageEvent<EngineRequest>) => {
  const { requestId, state, playouts, randomSeed, maxTimeMs, style, rootPriors, net } = event.data
  try {
    const result = net
      ? await chooseMoveWithNet(state, await loadModel(net.modelUrl), {
          playouts,
          maxTimeMs,
          recentMoves: net.recentMoves,
          priorBoards: net.priorBoards,
        })
      : chooseMove(state, { playouts, randomSeed, maxTimeMs, style, rootPriors })
    const response: EngineResponse = { requestId, ...result }
    postMessage(response)
  } catch (err) {
    postMessage({ requestId, error: err instanceof Error ? err.message : String(err) })
  }
}
