import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBoard } from '../../src/core/board'
import { gameStateFromBoard } from '../../src/core/rules'
import { BLACK } from '../../src/core/types'
import { RemoteEvalClient } from '../../src/eval/remoteClient'
import { encodeEvalPosition } from '../../src/eval/wireFormat'
import type { WireRawEvalOutput } from '../../src/eval/wireFormat'

function fakeWireOutput(): WireRawEvalOutput {
  const policy = new Array(362).fill(0)
  policy[5] = 1
  return { policy, value: [0.6, 0.3, 0.1], ownership: new Array(81).fill(0) }
}

describe('RemoteEvalClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('evaluate() postea la posicion codificada al endpoint /evaluate y decodifica la respuesta', async () => {
    const wireOutput = fakeWireOutput()
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => wireOutput }))
    vi.stubGlobal('fetch', fetchMock)

    const client = new RemoteEvalClient('https://mi-servidor.example')
    const state = gameStateFromBoard(createBoard(9), BLACK, 6.5)
    const result = await client.evaluate({ state })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://mi-servidor.example/evaluate')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual(encodeEvalPosition({ state }))
    expect(result.value).toEqual([0.6, 0.3, 0.1])
    expect(result.policy[5]).toBe(1)
  })

  it('quita la barra final de baseUrl para no duplicarla en la ruta', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => fakeWireOutput() }))
    vi.stubGlobal('fetch', fetchMock)

    const client = new RemoteEvalClient('https://mi-servidor.example/')
    const state = gameStateFromBoard(createBoard(9), BLACK, 6.5)
    await client.evaluate({ state })

    expect(fetchMock.mock.calls[0][0]).toBe('https://mi-servidor.example/evaluate')
  })

  it('evaluateBatch() postea al endpoint /evaluateBatch y decodifica un arreglo', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [fakeWireOutput(), fakeWireOutput()] }))
    vi.stubGlobal('fetch', fetchMock)

    const client = new RemoteEvalClient('https://mi-servidor.example')
    const state = gameStateFromBoard(createBoard(9), BLACK, 6.5)
    const results = await client.evaluateBatch([{ state }, { state }])

    expect(fetchMock.mock.calls[0][0]).toBe('https://mi-servidor.example/evaluateBatch')
    expect(results.length).toBe(2)
  })

  it('lanza si el servidor responde con un status de error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })))

    const client = new RemoteEvalClient('https://mi-servidor.example')
    const state = gameStateFromBoard(createBoard(9), BLACK, 6.5)

    await expect(client.evaluate({ state })).rejects.toThrow()
  })
})
