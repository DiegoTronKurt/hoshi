import type { EvalPosition } from './features'
import type { RawEvalOutput } from './model'
import type { EvalRequest, EvalResponse } from './worker'

/**
 * Mismo patron que engine/client.ts: un Worker, un mapa de promesas
 * pendientes por requestId. La unica diferencia real es que ademas hay que
 * decirle al Worker donde esta el modelo (`modelUrl`), porque el Worker no
 * tiene acceso directo a `import.meta.env.BASE_URL` del hilo principal.
 */
export class EvalClient {
  private worker: Worker
  private nextRequestId = 1
  private pending = new Map<number, (result: RawEvalOutput) => void>()
  private modelUrl: string

  constructor(modelUrl: string) {
    this.modelUrl = modelUrl
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<EvalResponse>) => {
      const { requestId, result } = event.data
      const resolve = this.pending.get(requestId)
      if (resolve) {
        resolve(result)
        this.pending.delete(requestId)
      }
    }
  }

  evaluate(position: EvalPosition): Promise<RawEvalOutput> {
    const requestId = this.nextRequestId++
    const request: EvalRequest = { requestId, position, modelUrl: this.modelUrl }
    return new Promise((resolve) => {
      this.pending.set(requestId, resolve)
      this.worker.postMessage(request)
    })
  }

  terminate(): void {
    this.worker.terminate()
  }
}
