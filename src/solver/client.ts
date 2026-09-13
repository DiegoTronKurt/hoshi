import type { SolveRequest, SolveResult } from './tsumego'
import { createWorkerRpc } from '../workerRpc'
import type { SolverRequest, SolverResponse } from './worker'

/** solve() no tiene cota de tiempo propia (solo maxDepth, ver
 * solver/tsumego.ts), asi que este timeout es puramente un respaldo del
 * lado del cliente para detectar un Worker realmente colgado. */
const SOLVER_TIMEOUT_MS = 20000

/**
 * El solucionador de vida-muerte puede tardar varios segundos en posiciones
 * dificiles. Se ejecuta en un Web Worker (igual que el motor MCTS) para que
 * la interfaz no se congele mientras calcula la respuesta del rival.
 */
export class SolverClient {
  private rpc = createWorkerRpc<SolverRequest, SolverResponse>(
    () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
    SOLVER_TIMEOUT_MS,
  )

  solve(request: SolveRequest): Promise<SolveResult> {
    return this.rpc.call(request)
  }

  terminate(): void {
    this.rpc.terminate()
  }
}

/** Referencia estable (definida al nivel del modulo, no dentro de un
 * componente) para pasar a useLazyWorkerClient sin disparar
 * react-hooks/exhaustive-deps: una funcion inline nueva en cada render
 * forzaria a listarla como dependencia, y eso reconstruiria el cliente -- y
 * recargaria el Worker -- en cada render. */
export function createSolverClient(): SolverClient {
  return new SolverClient()
}
