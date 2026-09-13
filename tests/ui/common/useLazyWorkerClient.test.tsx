import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useLazyWorkerClient } from '../../../src/ui/common/useLazyWorkerClient'

class FakeClient {
  terminate = vi.fn()
}

describe('useLazyWorkerClient', () => {
  it('devuelve el cliente real, construido por factory, tras el mount', async () => {
    const { result } = renderHook(() => useLazyWorkerClient(() => new FakeClient()))
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current).toBeInstanceOf(FakeClient)
  })

  it('llama factory una sola vez aunque el componente se re-renderice con una factory nueva', async () => {
    const factory = vi.fn(() => new FakeClient())
    const { result, rerender } = renderHook(() => useLazyWorkerClient(factory))
    await waitFor(() => expect(result.current).not.toBeNull())
    const first = result.current

    rerender()
    rerender()

    expect(factory).toHaveBeenCalledTimes(1)
    expect(result.current).toBe(first)
  })

  it('termina el cliente al desmontar', async () => {
    const { result, unmount } = renderHook(() => useLazyWorkerClient(() => new FakeClient()))
    await waitFor(() => expect(result.current).not.toBeNull())
    const client = result.current as FakeClient

    unmount()

    expect(client.terminate).toHaveBeenCalledTimes(1)
  })
})
