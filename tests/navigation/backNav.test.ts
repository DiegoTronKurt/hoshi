import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * backNav.ts habla directo con window.history (pushState/go) y con
 * popstate real -- en vez de depender del historial real de jsdom (dificil
 * de resetear entre tests, y no es lo que hay que probar aca), se simula un
 * historial propio y controlado: pushState/go quedan interceptados, go()
 * calcula el destino y despacha un popstate sintetico como lo haria el
 * navegador real (de forma asincronica, nunca sincronica -- ver el propio
 * modulo). Esto prueba la logica de reconciliacion en si, no la
 * implementacion de historial de jsdom.
 */
function installFakeHistory() {
  const stack: Array<{ navDepth: number } | null> = [null]
  let index = 0

  const pushState = vi.spyOn(window.history, 'pushState').mockImplementation((state) => {
    index++
    stack[index] = state as { navDepth: number } | null
  })

  const go = vi.spyOn(window.history, 'go').mockImplementation((delta?: number) => {
    const target = Math.max(0, Math.min(stack.length - 1, index + (delta ?? 0)))
    index = target
    queueMicrotask(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: stack[index] }))
    })
  })

  return { pushState, go, currentIndex: () => index }
}

describe('backNav', () => {
  let backNav: typeof import('../../src/navigation/backNav')
  let fakeHistory: ReturnType<typeof installFakeHistory>
  let uninstall: () => void

  beforeEach(async () => {
    vi.resetModules()
    fakeHistory = installFakeHistory()
    backNav = await import('../../src/navigation/backNav')
    // Sin esto, un popstate real (o el sintetico de installFakeHistory) no
    // tiene ningun listener escuchando -- installBackNavigation es lo que
    // App.tsx llama una sola vez al montar (ver src/App.tsx).
    uninstall = backNav.installBackNavigation()
  })

  afterEach(() => {
    uninstall()
    vi.restoreAllMocks()
  })

  it('setDesiredDepth crece empujando una entrada real por nivel', () => {
    backNav.setDesiredDepth(2)
    expect(fakeHistory.pushState).toHaveBeenCalledTimes(2)
    expect(fakeHistory.currentIndex()).toBe(2)
  })

  it('setDesiredDepth no hace nada si el destino ya es el actual', () => {
    backNav.setDesiredDepth(1)
    fakeHistory.pushState.mockClear()
    backNav.setDesiredDepth(1)
    expect(fakeHistory.pushState).not.toHaveBeenCalled()
    expect(fakeHistory.go).not.toHaveBeenCalled()
  })

  it('setDesiredDepth hacia abajo colapsa varios niveles en un solo history.go()', () => {
    backNav.setDesiredDepth(3)
    fakeHistory.go.mockClear()
    backNav.setDesiredDepth(1)
    expect(fakeHistory.go).toHaveBeenCalledTimes(1)
    expect(fakeHistory.go).toHaveBeenCalledWith(-2)
  })

  it('un pop real (boton fisico/gesto) dispara el callback registrado', async () => {
    backNav.setDesiredDepth(1)
    const onBack = vi.fn()
    backNav.onRealBack(onBack)

    window.dispatchEvent(new PopStateEvent('popstate', { state: { navDepth: 0 } }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('goBack() llama a history.back(), sin tocar estado directamente', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    backNav.goBack()
    expect(back).toHaveBeenCalledTimes(1)
  })

  // La carrera que encontro la segunda revision de diseno: un setDesiredDepth
  // que reduce profundidad (dispara history.go(), asincronico) seguido de
  // otro pedido antes de que el popstate del primero aterrice -- no debe
  // lanzar un segundo go() superpuesto, tiene que reconciliar contra el
  // pedido mas reciente una vez que el que esta en vuelo se resuelve.
  it('coalesce un pedido nuevo mientras un history.go() anterior sigue en vuelo, sin superponer llamadas', async () => {
    backNav.setDesiredDepth(3)
    fakeHistory.go.mockClear()

    backNav.setDesiredDepth(1) // dispara go(-2), en vuelo (popstate via queueMicrotask, todavia no aterrizo)
    backNav.setDesiredDepth(2) // pedido mas reciente ANTES de que el go() de arriba resuelva

    expect(fakeHistory.go).toHaveBeenCalledTimes(1) // no se lanzo un segundo go() superpuesto

    await Promise.resolve() // deja correr el queueMicrotask del go() en vuelo
    await Promise.resolve()

    // El primer go(-2) aterrizo en profundidad 1; el pedido coalescido (2)
    // todavia hace falta reconciliarlo con un push adicional.
    expect(fakeHistory.currentIndex()).toBe(2)
  })

  it('onRealBack(null) deja de invocar el callback anterior', () => {
    backNav.setDesiredDepth(1)
    const onBack = vi.fn()
    backNav.onRealBack(onBack)
    backNav.onRealBack(null)

    window.dispatchEvent(new PopStateEvent('popstate', { state: { navDepth: 0 } }))
    expect(onBack).not.toHaveBeenCalled()
  })
})
