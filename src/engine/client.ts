import type { GameState } from '../core/types'
import type { BotStyleId } from './botStyles'
import { createWorkerRpc } from '../workerRpc'
import type { EngineRequest, EngineResponse } from './worker'

export type EngineMoveResult = Omit<EngineResponse, 'requestId'>

/** Cota superior del propio motor si no se especifica maxTimeMs (ver
 * DEFAULT_MAX_TIME_MS en engine/mcts.ts), mas margen para el viaje del
 * mensaje. Si el motor tarda mas que esto, algo esta realmente colgado. */
const FALLBACK_TIMEOUT_MS = 15000
const TIMEOUT_GRACE_MS = 3000

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
  ): Promise<EngineMoveResult> {
    return this.rpc.call(
      { state, playouts, randomSeed, maxTimeMs, style },
      (maxTimeMs ?? FALLBACK_TIMEOUT_MS) + TIMEOUT_GRACE_MS,
    )
  }

  terminate(): void {
    this.rpc.terminate()
  }
}
