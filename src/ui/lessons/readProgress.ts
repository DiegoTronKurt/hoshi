import type { ConceptId } from '../../analysis/concepts'

const STORAGE_KEY = 'hoshi-lessons-read'
const REOPENED_STORAGE_KEY = 'hoshi-lessons-reopened'

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
    if (!set.has(lessonId)) {
      set.add(lessonId)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
    }
  } catch {
    // sin persistencia disponible, el progreso de lectura no se guarda para la proxima sesion
  }
  clearReopen(lessonId)
}

function markLessonUnread(lessonId: string): void {
  try {
    const set = readSet()
    if (!set.has(lessonId)) return
    set.delete(lessonId)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // sin persistencia disponible, no se puede reabrir la leccion para la proxima sesion
  }
}

/**
 * Lecciones reabiertas por training-policy/session.ts::findConceptsToReopen
 * (3+ errores del mismo concepto en las ultimas 5 partidas), con el
 * concepto que lo disparo -- para que Hoy pueda mostrar por que. Separado
 * del set de lectura: "no leida" por si sola no distingue "todavia no
 * llegue" de "ya la lei pero sigo fallando en partidas", y esa distincion
 * es justo el punto del aviso.
 */
function readReopenedMap(): Record<string, ConceptId> {
  try {
    const raw = window.localStorage.getItem(REOPENED_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, ConceptId>
  } catch {
    return {}
  }
}

function writeReopenedMap(map: Record<string, ConceptId>): void {
  try {
    window.localStorage.setItem(REOPENED_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // sin persistencia disponible, el aviso de reapertura no se guarda para la proxima sesion
  }
}

export function reopenLesson(lessonId: string, conceptId: ConceptId): void {
  markLessonUnread(lessonId)
  const map = readReopenedMap()
  if (map[lessonId] === conceptId) return
  writeReopenedMap({ ...map, [lessonId]: conceptId })
}

export function getReopenedLessons(): Array<{ lessonId: string; conceptId: ConceptId }> {
  return Object.entries(readReopenedMap()).map(([lessonId, conceptId]) => ({ lessonId, conceptId }))
}

function clearReopen(lessonId: string): void {
  const map = readReopenedMap()
  if (!(lessonId in map)) return
  const { [lessonId]: _removed, ...rest } = map
  writeReopenedMap(rest)
}
