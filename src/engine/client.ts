import type { BoardState, GameState } from '../core/types'
import type { BotStyleId } from './botStyles'
import { NET_DEFAULT_MAX_TIME_MS } from './mctsNet'
import type { EvalMove } from '../eval/features'
import { createWorkerRpc } from '../workerRpc'
import type { EngineRequest, EngineResponse } from './worker'

export type EngineMoveResult = Omit<EngineResponse, 'requestId'>

/** Cota superior del propio motor si no se especifica maxTimeMs (ver
 * DEFAULT_MAX_TIME_MS en engine/mcts.ts), mas margen para el viaje del
 * mensaje. Si el motor tarda mas que esto, algo esta realmente colgado. */
const FALLBACK_TIMEOUT_MS = 15000
const TIMEOUT_GRACE_MS = 3000

export interface EngineNetOptions {
  modelUrl: string
  recentMoves?: EvalMove[]
  priorBoards?: BoardState[]
  maxTimeMs?: number
}

export class EngineClient {
  private rpc = createWorkerRpc<EngineRequest, EngineResponse>(
    () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
    FALLBACK_TIMEOUT_MS + TIMEOUT_GRACE_MS,
  )

  chooseMove(
    state: GameState,
    playouts: number,
    randomSeed?: number,
    maxTimeMs?: number,
    style?: BotStyleId,
    rootPriors?: Map<number | null, number>,
  ): Promise<EngineMoveResult> {
    return this.rpc.call(
      { state, playouts, randomSeed, maxTimeMs, style, rootPriors },
      (maxTimeMs ?? FALLBACK_TIMEOUT_MS) + TIMEOUT_GRACE_MS,
    )
  }

  /** Ver engine/mctsNet.ts -- busqueda guiada por red en cada nodo, no solo
   * en la raiz. Metodo aparte en vez de mas parametros opcionales en
   * chooseMove: son dos motores con opciones que no se solapan (este no
   * tiene randomSeed/style/rootPriors, mctsNet no los usa). */
  chooseMoveWithNet(state: GameState, playouts: number, options: EngineNetOptions): Promise<EngineMoveResult> {
    const maxTimeMs = options.maxTimeMs ?? NET_DEFAULT_MAX_TIME_MS
    return this.rpc.call(
      {
        state,
        playouts,
        maxTimeMs: options.maxTimeMs,
        net: { modelUrl: options.modelUrl, recentMoves: options.recentMoves, priorBoards: options.priorBoards },
      },
      maxTimeMs + TIMEOUT_GRACE_MS,
    )
  }

  terminate(): void {
    this.rpc.terminate()
  }
}
