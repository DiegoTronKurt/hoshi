import type { EvalPosition } from './features'
import type { RawEvalOutput } from './model'
import { createWorkerRpc } from '../workerRpc'
import type { EvalRequest, EvalResponse } from './worker'

/** Carga del modelo incluida (loadModel dentro del Worker), asi que el
 * primer llamado puede tardar bastante mas que uno posterior con el modelo
 * ya en cache -- ver eval/worker.ts. Respaldo generoso del lado del
 * cliente para detectar un Worker realmente colgado, no una medicion de
 * cuanto deberia tardar una evaluacion normal. */
const EVAL_TIMEOUT_MS = 20000

/**
 * Mismo patron que engine/client.ts y solver/client.ts: un Worker, un mapa
 * de promesas pendientes por requestId. La unica diferencia real es que
 * ademas hay que decirle al Worker donde esta el modelo (`modelUrl`),
 * porque el Worker no tiene acceso directo a `import.meta.env.BASE_URL`
 * del hilo principal.
 */
export class EvalClient {
  private rpc = createWorkerRpc<EvalRequest, EvalResponse>(
    () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
    EVAL_TIMEOUT_MS,
  )
  private modelUrl: string

  constructor(modelUrl: string) {
    this.modelUrl = modelUrl
  }

  async evaluate(position: EvalPosition): Promise<RawEvalOutput> {
    const { result } = await this.rpc.call({ position, modelUrl: this.modelUrl })
    return result
  }

  terminate(): void {
    this.rpc.terminate()
  }
}
