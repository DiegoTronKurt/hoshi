/**
 * Registro de la sub-navegacion propia de la pantalla activa (Ejercicios,
 * Aprender, Jugar, Revisar, Perfil): que funcion "bajar un nivel" ejecutar
 * cuando corresponda, y cuantos niveles de profundidad local tiene ahora
 * mismo (para sumarlos a la profundidad de historial real en App.tsx).
 * Modulo aparte de backNav.ts (que no sabe nada de pantallas ni de React)
 * para que ese quede generico y facil de probar en aislamiento.
 */

type LocalBackHandler = () => boolean

let handler: LocalBackHandler | null = null
let depth = 0
let listener: ((depth: number) => void) | null = null

/** Llamado por App.tsx una sola vez, al montar, para enterarse de cada
 * cambio de profundidad local que reporte cualquier pantalla. */
export function subscribeLocalDepth(fn: (depth: number) => void): () => void {
  listener = fn
  fn(depth)
  return () => {
    if (listener === fn) listener = null
  }
}

/** Llamado por cada pantalla con sub-navegacion propia, cada vez que su
 * profundidad local cambia -- incluido al montar, si arranca ya un nivel
 * adentro (p.ej. Aprender abierto directo en una leccion desde Hoy), y al
 * desmontar (`reportLocalBack(null, 0)`) para no dejar un handler obsoleto
 * activo cuando el usuario cambia de pestana en vez de volver. */
export function reportLocalBack(nextHandler: LocalBackHandler | null, nextDepth: number): void {
  handler = nextHandler
  depth = nextDepth
  listener?.(depth)
}

/** Intenta bajar un nivel en la pantalla activa. true si lo hizo (el
 * resolver de App.tsx no debe hacer nada mas), false si no habia nada que
 * bajar localmente -- la pantalla activa no tiene sub-navegacion, o ya esta
 * en su raiz -- y el resolver debe seguir con su propio siguiente paso. */
export function tryLocalBack(): boolean {
  return handler ? handler() : false
}
