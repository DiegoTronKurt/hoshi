/** Ejercicios/Ejercicios de Hoy comparten este selector para que un banco
 * chico (8-15 problemas) no se sienta repetitivo: excluye los ids mostrados
 * recientemente (ver RECENT_WINDOW en cada pantalla) antes de elegir al
 * azar, y solo vuelve al pool completo si la exclusion lo dejaria vacio. */
export function pickWithoutRepeat<T extends { id: string }>(entries: T[], recentIds: readonly string[]): T | null {
  if (entries.length === 0) return null
  const pool = entries.filter((entry) => !recentIds.includes(entry.id))
  const source = pool.length > 0 ? pool : entries
  return source[Math.floor(Math.random() * source.length)]
}

/** Ventana de exclusion para un pool dado: nunca excluye el pool entero, asi
 * que un banco de 2-3 problemas sigue rotando en vez de degenerar a "excluir
 * todo, elegir cualquiera" en cada intento. */
export function recentWindowSize(poolSize: number, maxWindow: number): number {
  return Math.max(0, Math.min(maxWindow, poolSize - 1))
}

/** Elige un elemento de un pool agrupado por concepto en dos pasos: primero
 * un concepto al azar (evitando recentConceptIds), despues un elemento de
 * ese concepto (evitando recentIds). Usado por "todos los conceptos" en
 * Ejercicios (ver ExercisePracticeScreen.tsx): un sorteo directo sobre el
 * pool plano dejaria los conceptos chicos (4-16 problemas, ej. OJO_FALSO)
 * practicamente invisibles frente a los grandes (200-369, ej. PASE_PREMATURO),
 * porque la probabilidad de tocar un concepto seria proporcional a su
 * tamano de pool en vez de pareja entre conceptos. */
export function pickStratifiedByConcept<T extends { id: string }>(
  groups: ReadonlyMap<string, readonly T[]>,
  recentIds: readonly string[],
  recentConceptIds: readonly string[],
): { item: T; conceptId: string } | null {
  const conceptChoices = [...groups.keys()].map((id) => ({ id }))
  const pickedConcept = pickWithoutRepeat(conceptChoices, recentConceptIds)
  if (!pickedConcept) return null
  const conceptPool = groups.get(pickedConcept.id) ?? []
  const item = pickWithoutRepeat(conceptPool as T[], recentIds)
  return item ? { item, conceptId: pickedConcept.id } : null
}
