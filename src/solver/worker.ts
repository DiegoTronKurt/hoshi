import { solve } from './tsumego'
import type { SolveRequest, SolveResult } from './tsumego'

export interface SolverRequest extends SolveRequest {
  requestId: number
}

export type SolverResponse = SolveResult & { requestId: number }

self.onmessage = (event: MessageEvent<SolverRequest>) => {
  const { requestId, ...request } = event.data
  const result = solve(request)
  const response: SolverResponse = { requestId, ...result }
  postMessage(response)
}
