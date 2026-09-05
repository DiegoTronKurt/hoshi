/**
 * Reconciliacion de profundidad real de historial (WebView/navegador) contra
 * una profundidad logica deseada, para que el boton fisico "atras" de
 * Android navegue la app en vez de cerrarla de un salto. hoshi-flutter's
 * PopScope (lib/main.dart) ya hace lo correcto -- goBack() si
 * controller.canGoBack(), si no SystemNavigator.pop() -- pero canGoBack()
 * esta siempre en false porque nada empujaba historial real todavia: este
 * modulo es la unica pieza que falta, entero del lado web.
 *
 * Deliberadamente NO guarda "que deshacer" por cada nivel (un closure
 * grabado por una pantalla que despues se desmonta -- el usuario salta de
 * pestana en vez de volver -- quedaria obsoleto y silenciaria una futura
 * pulsacion de atras sin efecto visible, ver NOTAS.md). En cambio,
 * `setDesiredDepth` empuja o colapsa historial real para igualar un numero
 * recalculado en vivo cada vez (ver src/App.tsx), y cada pop real dispara el
 * callback registrado con `onRealBack`, que decide que hacer preguntando el
 * estado actual, nunca reproduciendo una grabacion.
 */

let realDepth = 0
/** Profundidad pedida mientras un `history.go()` esta en curso -- si llega
 * un pedido nuevo antes de que su popstate aterrice, se guarda aca en vez de
 * lanzar otro `go()` superpuesto: `history.go()` resuelve contra el indice
 * vigente en el momento en que efectivamente corre, no en el momento en que
 * se llama, asi que dos llamadas superpuestas competirian entre si. */
let pendingTarget: number | null = null

function applyDelta(target: number): void {
  const delta = target - realDepth
  if (delta === 0) return

  if (delta > 0) {
    for (let i = 0; i < delta; i++) {
      realDepth++
      window.history.pushState({ navDepth: realDepth }, '')
    }
    return
  }

  pendingTarget = target
  window.history.go(delta)
}

/** Reconcilia el historial real para que su profundidad iguale `target`.
 * Coalesce pedidos que llegan mientras un `history.go()` anterior sigue en
 * vuelo (ver `pendingTarget` arriba) en vez de superponer llamadas. */
export function setDesiredDepth(target: number): void {
  if (pendingTarget !== null) {
    pendingTarget = target
    return
  }
  applyDelta(target)
}

/** Atajo para toda accion de "volver" en la interfaz (botones de encabezado,
 * cancelar un dialogo, etc.): nunca deben tocar su propio estado local
 * directamente, siempre pasan por aca para que el pop real dispare el mismo
 * resolver que atiende al boton fisico de Android. */
export function goBack(): void {
  window.history.back()
}

let backCallback: (() => void) | null = null

function onPopState(event: PopStateEvent): void {
  if (pendingTarget !== null) {
    const target = pendingTarget
    pendingTarget = null
    realDepth = (event.state?.navDepth as number | undefined) ?? target
    if (realDepth !== target) setDesiredDepth(target) // el objetivo pedido cambio mientras el go() estaba en curso
    return
  }

  // Pop real: boton fisico, gesto del SO, o goBack() de arriba -- nunca se
  // reproduce una accion grabada, se avisa al resolver registrado para que
  // decida mirando el estado actual.
  realDepth = Math.max(0, realDepth - 1)
  backCallback?.()
}

/** Instala el listener de popstate una sola vez (llamar desde un efecto de
 * montaje en App.tsx). Devuelve la funcion de limpieza. */
export function installBackNavigation(): () => void {
  window.addEventListener('popstate', onPopState)
  return () => window.removeEventListener('popstate', onPopState)
}

/** Reemplaza la funcion a llamar en cada pop real. App.tsx la vuelve a
 * registrar cada vez que cambian los valores que necesita leer (pantalla
 * activa, dialogo de confirmacion), para no cerrar sobre estado viejo --
 * nunca hace falta desinstalar y reinstalar el listener de popstate en si
 * por esto, solo reemplazar cual funcion atiende. */
export function onRealBack(callback: (() => void) | null): void {
  backCallback = callback
}
