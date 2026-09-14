import { encodeInput } from './features'
import type { EvalPosition } from './features'
import { evaluatePosition, evaluatePositionsBatch, loadModel } from './model'
import type { RawEvalOutput } from './model'
import { chooseMoveWithNet, NET_DEFAULT_MAX_TIME_MS } from '../engine/mctsNet'
import type { MctsResult } from '../engine/mcts'

/**
 * `position`/`positions`/`deepAnalyze*` conviven en la misma forma plana en
 * vez de una union discriminada: `createWorkerRpc` es generico sobre un
 * unico tipo Req/Res, y `Omit<Req,'requestId'>` sobre una union colapsa las
 * variantes a sus claves comunes (pierde los campos especificos de cada una
 * por completo) porque `Pick`/`Omit` no se distribuyen sobre uniones en
 * TypeScript. Una sola llamada por lote (ver evaluatePositionsBatch) es
 * exactamente lo que Review necesita para no pagar el overhead fijo de
 * ~8ms/llamada N veces al analizar una partida entera jugada a jugada.
 *
 * `deepAnalyzePosition` importa engine/mctsNet.ts (busqueda PUCT real, Fase
 * 4 del plan de contenido) directo en este Worker en vez de levantar un
 * EngineClient/Worker aparte (que ya existe y hace exactamente esto para
 * elegir la jugada del bot en Jugar, ver engine/worker.ts): el modelo ya
 * esta cargado aca (loadModel cachea por proceso, ver model.ts), asi que
 * reusar este Worker evita una segunda carga del modelo (~11.5MB) y un
 * segundo contexto WebGL en un telefono ya justo de recursos -- exactamente
 * la razon documentada en el plan para esta decision. mctsNet.ts ya
 * depende de eval/model.ts y eval/features.ts (para poder llamar a la red
 * en cada nodo que expande), asi que importarlo aca no crea un ciclo: nada
 * en eval/ importa de vuelta este archivo (los Workers se cargan por URL,
 * nunca por import de modulo).
 */
export interface EvalRequest {
  requestId: number
  position?: EvalPosition
  positions?: EvalPosition[]
  deepAnalyzePosition?: EvalPosition
  deepAnalyzePlayouts?: number
  deepAnalyzeMaxTimeMs?: number
  modelUrl: string
}

export interface EvalResponse {
  requestId: number
  result?: RawEvalOutput
  results?: RawEvalOutput[]
  deepAnalyzeResult?: MctsResult
}

self.onmessage = async (event: MessageEvent<EvalRequest>) => {
  const { requestId, position, positions, deepAnalyzePosition, deepAnalyzePlayouts, deepAnalyzeMaxTimeMs, modelUrl } =
    event.data
  try {
    const model = await loadModel(modelUrl)
    if (deepAnalyzePosition) {
      const deepAnalyzeResult = await chooseMoveWithNet(deepAnalyzePosition.state, model, {
        playouts: deepAnalyzePlayouts ?? 300,
        maxTimeMs: deepAnalyzeMaxTimeMs ?? NET_DEFAULT_MAX_TIME_MS,
        recentMoves: deepAnalyzePosition.recentMoves,
        priorBoards: deepAnalyzePosition.priorBoards,
      })
      postMessage({ requestId, deepAnalyzeResult } satisfies EvalResponse)
      return
    }
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
