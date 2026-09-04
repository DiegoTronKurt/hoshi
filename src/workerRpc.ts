/**
 * Envoltorio compartido por los tres clientes de Worker (engine, solver,
 * eval): un Worker, un mapa de promesas pendientes por requestId, y ahora
 * ademas manejo de errores. Antes cada cliente reimplementaba el mismo mapa
 * sin reject ni timeout -- si el Worker tiraba una excepcion o se colgaba, la
 * promesa nunca se resolvia ni se rechazaba, y la pantalla que esperaba la
 * respuesta (el indicador de "pensando", el candado de un ejercicio) quedaba
 * trabada para siempre. Composicion en vez de una clase base: no hay ningun
 * otro patron de herencia en el proyecto (ver storage/db.ts,
 * training-policy/session.ts), asi que una jerarquia de clases nueva solo
 * para esto no encajaria con el resto del codigo.
 */

export interface RpcError {
  requestId: number
  error: string
}

interface PendingEntry<Res> {
  resolve: (result: Res) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export interface WorkerRpc<Req extends { requestId: number }, Res extends { requestId: number }> {
  call(request: Omit<Req, 'requestId'>, timeoutMs?: number): Promise<Omit<Res, 'requestId'>>
  terminate(): void
}

export function createWorkerRpc<Req extends { requestId: number }, Res extends { requestId: number }>(
  createWorker: () => Worker,
  defaultTimeoutMs: number,
): WorkerRpc<Req, Res> {
  const worker = createWorker()
  let nextRequestId = 1
  const pending = new Map<number, PendingEntry<Omit<Res, 'requestId'>>>()

  function settleError(requestId: number, message: string) {
    const entry = pending.get(requestId)
    if (!entry) return
    clearTimeout(entry.timeout)
    pending.delete(requestId)
    entry.reject(new Error(message))
  }

  worker.onmessage = (event: MessageEvent<Res | RpcError>) => {
    const data = event.data
    const entry = pending.get(data.requestId)
    if (!entry) return
    if ('error' in data) {
      settleError(data.requestId, data.error)
      return
    }
    clearTimeout(entry.timeout)
    pending.delete(data.requestId)
    const { requestId: _requestId, ...result } = data
    entry.resolve(result)
  }

  worker.onerror = (event: ErrorEvent) => {
    const message = event.message || 'Worker error'
    for (const requestId of [...pending.keys()]) settleError(requestId, message)
  }

  function call(request: Omit<Req, 'requestId'>, timeoutMs = defaultTimeoutMs): Promise<Omit<Res, 'requestId'>> {
    const requestId = nextRequestId++
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => settleError(requestId, 'Worker request timed out'), timeoutMs)
      pending.set(requestId, { resolve, reject, timeout })
      worker.postMessage({ ...request, requestId } as Req)
    })
  }

  function terminate(): void {
    worker.terminate()
  }

  return { call, terminate }
}
