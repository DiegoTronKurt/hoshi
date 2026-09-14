import type { EvalBackend } from './backend'
import type { EvalPosition } from './features'
import type { RawEvalOutput } from './model'
import { decodeRawEvalOutput, encodeEvalPosition } from './wireFormat'
import type { WireRawEvalOutput } from './wireFormat'
import type { MctsResult } from '../engine/mcts'

/** Respaldo del lado del cliente para detectar un servidor remoto colgado o
 * inalcanzable -- mismo espiritu que EVAL_TIMEOUT_MS en client.ts, pero mas
 * generoso: una red desconocida puede tener latencia mucho mayor que el
 * Worker local, que nunca sale del dispositivo. */
const REMOTE_EVAL_TIMEOUT_MS = 30000

/**
 * E3 del roadmap (inferencia remota opcional): mismo contrato que EvalClient
 * (EvalBackend), pero la evaluacion la hace un servidor HTTP externo en vez
 * del Worker local -- util para analisis mas rapido o mas profundo si la
 * persona corre (o tiene acceso a) un servidor con mas capacidad de computo
 * que su telefono. `baseUrl` es responsabilidad de la persona usuaria: esta
 * clase nunca elige, despliega ni paga un servidor, solo le habla al que
 * ya le dieron (ver tools/eval-server.ts para un servidor de referencia
 * que alguien puede correr y exponer por su cuenta).
 */
export class RemoteEvalClient implements EvalBackend {
  private baseUrl: string
  /** Siempre false: este backend es solo-evaluacion (un fetch por posicion,
   * sin modelo ni busqueda propia de este lado, ver el comentario de la
   * clase). Quien lo consuma debe revisar esto y ocultar el boton de
   * "analizar mas profundo" en vez de mostrarlo deshabilitado -- ver
   * EvalBackend::supportsDeepAnalysis. */
  readonly supportsDeepAnalysis = false

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`servidor remoto respondio ${response.status}`)
      return (await response.json()) as T
    } finally {
      clearTimeout(timeout)
    }
  }

  async evaluate(position: EvalPosition, timeoutMs = REMOTE_EVAL_TIMEOUT_MS): Promise<RawEvalOutput> {
    const wire = await this.post<WireRawEvalOutput>('/evaluate', encodeEvalPosition(position), timeoutMs)
    return decodeRawEvalOutput(wire)
  }

  async evaluateBatch(positions: EvalPosition[], timeoutMs = REMOTE_EVAL_TIMEOUT_MS): Promise<RawEvalOutput[]> {
    const wire = await this.post<WireRawEvalOutput[]>('/evaluateBatch', positions.map(encodeEvalPosition), timeoutMs)
    return wire.map(decodeRawEvalOutput)
  }

  /** Nunca deberia llamarse en la practica -- ver supportsDeepAnalysis. Tira
   * en vez de devolver un resultado inventado (p.ej. envolver evaluate() sin
   * busqueda real) porque eso violaria en silencio lo que EvalBackend
   * promete: analyzeDeeply es especificamente una busqueda, no una pasada
   * simple disfrazada. */
  async analyzeDeeply(): Promise<MctsResult> {
    throw new Error('RemoteEvalClient no soporta analisis profundo: revisa supportsDeepAnalysis antes de llamar.')
  }

  terminate(): void {
    // Sin Worker ni conexion persistente que cerrar -- cada llamada es un
    // fetch independiente. Presente solo para cumplir EvalBackend.
  }
}
