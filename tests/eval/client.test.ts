import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBoard } from '../../src/core/board'
import { gameStateFromBoard } from '../../src/core/rules'
import { BLACK } from '../../src/core/types'
import { EvalClient } from '../../src/eval/client'
import type { EvalRequest } from '../../src/eval/worker'
import type { MctsResult } from '../../src/engine/mcts'
import { NET_DEFAULT_MAX_TIME_MS } from '../../src/engine/mctsNet'

const FAKE_DEEP_RESULT: MctsResult = { move: 5, visits: 42, winRate: 0.73, playoutsRun: 300 }

/**
 * jsdom no implementa Worker de verdad (mismo motivo que el FakeWorker de
 * tests/eval/backend.test.ts), pero ese stub no responde ningun mensaje --
 * aca hace falta un round-trip real por createWorkerRpc (ver
 * src/workerRpc.ts) para probar analyzeDeeply de punta a punta: que
 * EvalClient arme la solicitud con los campos que eval/worker.ts espera
 * (deepAnalyzePosition/deepAnalyzePlayouts/modelUrl), y que devuelva el
 * MctsResult tal cual sin transformarlo.
 */
class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  lastMessage: EvalRequest | null = null

  constructor() {
    FakeWorker.instances.push(this)
  }

  postMessage(message: EvalRequest): void {
    this.lastMessage = message
    if (message.deepAnalyzePosition) {
      queueMicrotask(() => {
        this.onmessage?.({
          data: { requestId: message.requestId, deepAnalyzeResult: FAKE_DEEP_RESULT },
        } as MessageEvent)
      })
    }
  }

  terminate(): void {}
}

describe('EvalClient.analyzeDeeply', () => {
  beforeEach(() => {
    FakeWorker.instances = []
    vi.stubGlobal('Worker', FakeWorker)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('supportsDeepAnalysis es true (backend local, el Worker ya tiene el modelo cargado)', () => {
    const client = new EvalClient('https://modelo.example/model.json')
    expect(client.supportsDeepAnalysis).toBe(true)
    client.terminate()
  })

  it('envia la posicion, el presupuesto de playouts y modelUrl al Worker, y devuelve el MctsResult tal cual', async () => {
    const client = new EvalClient('https://modelo.example/model.json')
    const state = gameStateFromBoard(createBoard(9), BLACK, 6.5)

    const result = await client.analyzeDeeply({ state }, 300)

    const worker = FakeWorker.instances.at(-1)
    expect(worker?.lastMessage?.deepAnalyzePosition?.state).toBe(state)
    expect(worker?.lastMessage?.deepAnalyzePlayouts).toBe(300)
    expect(worker?.lastMessage?.modelUrl).toBe('https://modelo.example/model.json')
    expect(result).toEqual(FAKE_DEEP_RESULT)

    client.terminate()
  })

  it('sin timeoutMs explicito, usa NET_DEFAULT_MAX_TIME_MS como presupuesto de busqueda', async () => {
    const client = new EvalClient('https://modelo.example/model.json')
    const state = gameStateFromBoard(createBoard(9), BLACK, 6.5)

    await client.analyzeDeeply({ state }, 300)

    const worker = FakeWorker.instances.at(-1)
    expect(worker?.lastMessage?.deepAnalyzeMaxTimeMs).toBe(NET_DEFAULT_MAX_TIME_MS)

    client.terminate()
  })
})
