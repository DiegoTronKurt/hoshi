import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEvalBackend } from '../../src/eval/backend'
import { EvalClient } from '../../src/eval/client'
import { RemoteEvalClient } from '../../src/eval/remoteClient'

// jsdom no implementa Worker -- EvalClient construye uno real en su
// inicializador de campo (rpc = createWorkerRpc(...)), asi que hace falta
// un stub minimo (los 4 miembros que workerRpc.ts realmente usa) para poder
// construirlo bajo vitest. No prueba nada del Worker en si (eso ya lo cubre
// tests/eval/model.test.ts contra el modelo real), solo que
// createEvalBackend elige la clase correcta.
class FakeWorker {
  onmessage: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  postMessage(): void {}
  terminate(): void {}
}

describe('createEvalBackend', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sin URL configurada, usa el cliente local (Worker + modelo vendorizado)', () => {
    vi.stubGlobal('Worker', FakeWorker)
    const backend = createEvalBackend(null)
    expect(backend).toBeInstanceOf(EvalClient)
    backend.terminate()
  })

  it('con una URL configurada, usa el cliente remoto', () => {
    const backend = createEvalBackend('https://mi-servidor.example')
    expect(backend).toBeInstanceOf(RemoteEvalClient)
    backend.terminate()
  })
})
