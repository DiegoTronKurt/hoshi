import type { GameState } from '../core/types'
import type { EngineRequest, EngineResponse } from './worker'

export type EngineMoveResult = Omit<EngineResponse, 'requestId'>

export class EngineClient {
  private worker: Worker
  private nextRequestId = 1
  private pending = new Map<number, (result: EngineMoveResult) => void>()

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<EngineResponse>) => {
      const { requestId, ...result } = event.data
      const resolve = this.pending.get(requestId)
      if (resolve) {
        resolve(result)
        this.pending.delete(requestId)
      }
    }
  }

  chooseMove(state: GameState, playouts: number, randomSeed?: number, maxTimeMs?: number): Promise<EngineMoveResult> {
    const requestId = this.nextRequestId++
    const request: EngineRequest = { requestId, state, playouts, randomSeed, maxTimeMs }
    return new Promise((resolve) => {
      this.pending.set(requestId, resolve)
      this.worker.postMessage(request)
    })
  }

  terminate(): void {
    this.worker.terminate()
  }
}
