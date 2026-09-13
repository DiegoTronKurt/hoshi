import { encodeInput } from './features'
import type { EvalPosition } from './features'
import { evaluatePosition, evaluatePositionsBatch, loadModel } from './model'
import type { RawEvalOutput } from './model'

/**
 * `position` (una sola) y `positions` (varias) conviven en la misma forma
 * plana en vez de una union discriminada: `createWorkerRpc` es generico
 * sobre un unico tipo Req/Res, y `Omit<Req,'requestId'>` sobre una union
 * colapsa las variantes a sus claves comunes (pierde `position`/`positions`
 * por completo) porque `Pick`/`Omit` no se distribuyen sobre uniones en
 * TypeScript. Una sola llamada por lote (ver evaluatePositionsBatch) es
 * exactamente lo que Review necesita para no pagar el overhead fijo de
 * ~8ms/llamada N veces al analizar una partida entera jugada a jugada.
 */
export interface EvalRequest {
  requestId: number
  position?: EvalPosition
  positions?: EvalPosition[]
  modelUrl: string
}

export interface EvalResponse {
  requestId: number
  result?: RawEvalOutput
  results?: RawEvalOutput[]
}

self.onmessage = async (event: MessageEvent<EvalRequest>) => {
  const { requestId, position, positions, modelUrl } = event.data
  try {
    const model = await loadModel(modelUrl)
    if (positions) {
      const results = await evaluatePositionsBatch(model, positions.map(encodeInput))
      postMessage({ requestId, results } satisfies EvalResponse)
      return
    }
    const result = await evaluatePosition(model, encodeInput(position as EvalPosition))
    postMessage({ requestId, result } satisfies EvalResponse)
  } catch (err) {
    postMessage({ requestId, error: err instanceof Error ? err.message : String(err) })
  }
}
