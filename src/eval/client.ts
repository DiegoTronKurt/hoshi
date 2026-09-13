import type { EvalBackend } from './backend'
import type { EvalPosition } from './features'
import { EVAL_MODEL_URL } from './modelUrl'
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
export class EvalClient implements EvalBackend {
  private rpc = createWorkerRpc<EvalRequest, EvalResponse>(
    () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
    EVAL_TIMEOUT_MS,
  )
  private modelUrl: string

  constructor(modelUrl: string) {
    this.modelUrl = modelUrl
  }

  /** `timeoutMs`: respaldo por defecto EVAL_TIMEOUT_MS (pensado para el
   * clic manual de Revisar, tolerante). PlayGameScreen pasa uno mucho mas
   * corto: ahi la evaluacion es una mejora invisible antes de que el bot
   * juegue, no debe poder colgar la partida por mucho tiempo si falla. */
  async evaluate(position: EvalPosition, timeoutMs?: number): Promise<RawEvalOutput> {
    const { result } = await this.rpc.call({ position, modelUrl: this.modelUrl }, timeoutMs)
    return result as RawEvalOutput
  }

  /** Una sola llamada al Worker (un solo executeAsync por dentro, ver
   * evaluatePositionsBatch) para N posiciones -- pensado para recorrer una
   * partida entera jugada a jugada (ver ui/review/fullGameReview.ts) sin
   * pagar el overhead fijo por llamada N veces. El llamador es quien decide
   * el tamano del lote; ~32 es el mayor tamano medido realmente contra el
   * modelo vendorizado (ver el comentario de evaluatePositionsBatch). */
  async evaluateBatch(positions: EvalPosition[], timeoutMs?: number): Promise<RawEvalOutput[]> {
    const { results } = await this.rpc.call({ positions, modelUrl: this.modelUrl }, timeoutMs)
    return results as RawEvalOutput[]
  }

  terminate(): void {
    this.rpc.terminate()
  }
}

/** Referencia estable (definida al nivel del modulo) para pasar a
 * useLazyWorkerClient sin disparar react-hooks/exhaustive-deps -- mismo
 * motivo que createSolverClient en solver/client.ts. Siempre con el modelo
 * vendorizado; quien necesite un modelUrl distinto sigue pudiendo llamar
 * `new EvalClient(otroUrl)` directo, sin pasar por este atajo. */
export function createEvalClient(): EvalClient {
  return new EvalClient(EVAL_MODEL_URL)
}
