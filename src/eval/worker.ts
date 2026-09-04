import { encodeInput } from './features'
import type { EvalPosition } from './features'
import { evaluatePosition, loadModel } from './model'
import type { RawEvalOutput } from './model'

export interface EvalRequest {
  requestId: number
  position: EvalPosition
  modelUrl: string
}

export interface EvalResponse {
  requestId: number
  result: RawEvalOutput
}

self.onmessage = async (event: MessageEvent<EvalRequest>) => {
  const { requestId, position, modelUrl } = event.data
  try {
    const model = await loadModel(modelUrl)
    const input = encodeInput(position)
    const result = await evaluatePosition(model, input)
    const response: EvalResponse = { requestId, result }
    postMessage(response)
  } catch (err) {
    postMessage({ requestId, error: err instanceof Error ? err.message : String(err) })
  }
}
