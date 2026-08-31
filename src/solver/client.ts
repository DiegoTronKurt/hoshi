import type { SolveRequest, SolveResult } from './tsumego'
import type { SolverRequest, SolverResponse } from './worker'

/**
 * El solucionador de vida-muerte puede tardar varios segundos en posiciones
 * dificiles. Se ejecuta en un Web Worker (igual que el motor MCTS) para que
 * la interfaz no se congele mientras calcula la respuesta del rival.
 */
export class SolverClient {
  private worker: Worker
  private nextRequestId = 1
  private pending = new Map<number, (result: SolveResult) => void>()

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<SolverResponse>) => {
      const { requestId, ...result } = event.data
      const resolve = this.pending.get(requestId)
      if (resolve) {
        resolve(result)
        this.pending.delete(requestId)
      }
    }
  }

  solve(request: SolveRequest): Promise<SolveResult> {
    const requestId = this.nextRequestId++
    const message: SolverRequest = { requestId, ...request }
    return new Promise((resolve) => {
      this.pending.set(requestId, resolve)
      this.worker.postMessage(message)
    })
  }

  terminate(): void {
    this.worker.terminate()
  }
}
