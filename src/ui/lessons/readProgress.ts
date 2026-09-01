const STORAGE_KEY = 'hoshi-lessons-read'

/**
 * Progreso de lectura de lecciones: solo "leida / no leida", en localStorage,
 * no en IndexedDB. No es un dato de aprendizaje evaluable (no alimenta el
 * perfil de habilidad ni FSRS), asi que no necesita el almacen de intentos.
 */
function readSet(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

export function isLessonRead(lessonId: string): boolean {
  return readSet().has(lessonId)
}

export function markLessonRead(lessonId: string): void {
  try {
    const set = readSet()
    if (set.has(lessonId)) return
    set.add(lessonId)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // sin persistencia disponible, el progreso de lectura no se guarda para la proxima sesion
  }
}
