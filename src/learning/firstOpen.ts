const FIRST_OPEN_STORAGE_KEY = 'hoshi-first-open-at'

/**
 * Se llama una sola vez al montar la app (ver App.tsx): si todavia no hay
 * fecha guardada, registra "ahora" como la primera apertura. Idempotente en
 * cualquier apertura siguiente. Es la unica pieza de este calculo que no se
 * puede derivar de partidas/intentos ya guardados (documento de diseno,
 * seccion 11.3): no hay ningun otro registro de "cuando se abrio la app por
 * primera vez", asi que hace falta este localStorage puntual.
 */
export function recordFirstOpenIfNeeded(now: Date = new Date()): void {
  try {
    if (!window.localStorage.getItem(FIRST_OPEN_STORAGE_KEY)) {
      window.localStorage.setItem(FIRST_OPEN_STORAGE_KEY, now.toISOString())
    }
  } catch {
    // sin persistencia disponible, la metrica de "tiempo hasta la primera victoria" no se puede calcular
  }
}

export function getFirstOpenAt(): string | null {
  try {
    return window.localStorage.getItem(FIRST_OPEN_STORAGE_KEY)
  } catch {
    return null
  }
}
