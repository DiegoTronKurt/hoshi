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
