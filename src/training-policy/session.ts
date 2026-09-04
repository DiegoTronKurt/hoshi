import type { ConceptId } from '../analysis/concepts'
import { analyzeGame } from '../analysis/mistakes'
import type { BankEntry } from '../content/problemBank'
import { sgfToGameRecord } from '../core/sgf'
import { isDue } from '../learning/fsrs'
import { weakestConcepts } from '../learning/profile'
import type { ConceptProfile } from '../learning/profile'
import { gameHeight, gameWidth } from '../storage/db'
import type { AttemptRecord, SavedGameRecord, SrsCardRecord } from '../storage/db'

export const DEFAULT_SESSION_MINUTES = 10
/** Estimacion de cuanto tarda una persona en resolver un problema de este
 * banco (tsumegos chicos, 3 a 9 jugadas de profundidad). No hay datos reales
 * de tiempo todavia, asi que sirve solo para convertir minutos de sesion a
 * una cantidad de problemas; se puede ajustar sin tocar el resto del
 * planificador. */
const SECONDS_PER_PROBLEM = 45

/** Conversion inversa a la de sessionSize mas abajo: cuantos minutos toma
 * resolver `itemCount` problemas, segun la misma estimacion. La usa Hoy
 * para traducir la meta diaria (cantidad de problemas, ver
 * ui/settings/index.tsx) a los minutos que pide planSession. */
export function minutesForGoal(itemCount: number): number {
  return (itemCount * SECONDS_PER_PROBLEM) / 60
}

export type SessionReason = 'overdue' | 'weak' | 'new'

export interface SessionReasonDetail {
  /** Solo si reason === 'overdue': dias desde que la tarjeta SRS vencio. */
  overdueDays?: number
  /** Solo si reason === 'weak': puntaje 0-100 del concepto en el perfil. */
  conceptScore?: number
}

export interface SessionItem {
  entry: BankEntry
  reason: SessionReason
  reasonDetail?: SessionReasonDetail
}

export interface SessionPlan {
  items: SessionItem[]
  minutes: number
}

/**
 * Planificador de sesion diaria (documento de diseno, seccion 5.5):
 * 60% elementos vencidos de la cola SRS, 25% conceptos con peor puntaje de
 * perfil, 15% contenido nuevo (problemas nunca intentados). Si una
 * categoria no tiene suficientes candidatos (el banco todavia es chico),
 * el resto del cupo se completa con lo que quede disponible en vez de
 * entregar una sesion mas corta de lo necesario.
 */
export function planSession(
  entries: BankEntry[],
  srsCards: SrsCardRecord[],
  profiles: Record<ConceptId, ConceptProfile>,
  now: Date = new Date(),
  minutes: number = DEFAULT_SESSION_MINUTES,
): SessionPlan {
  const sessionSize = Math.max(1, Math.round((minutes * 60) / SECONDS_PER_PROBLEM))
  const overdueQuota = Math.round(sessionSize * 0.6)
  const weakQuota = Math.round(sessionSize * 0.25)

  const cardByProblemId = new Map(srsCards.map((c) => [c.problemId, c]))
  const entryById = new Map(entries.map((e) => [e.id, e]))
  const chosen = new Set<string>()
  const items: SessionItem[] = []

  function take(entry: BankEntry, reason: SessionReason, reasonDetail?: SessionReasonDetail) {
    if (chosen.has(entry.id)) return
    chosen.add(entry.id)
    items.push({ entry, reason, reasonDetail })
  }

  // 1. Vencidos: los mas atrasados primero.
  const overdue = srsCards
    .filter((c) => isDue(c.card, now))
    .sort((a, b) => a.card.due.getTime() - b.card.due.getTime())
  for (const card of overdue) {
    if (items.filter((i) => i.reason === 'overdue').length >= overdueQuota) break
    const entry = entryById.get(card.problemId)
    if (entry) {
      const overdueDays = Math.max(0, Math.floor((now.getTime() - card.card.due.getTime()) / 86_400_000))
      take(entry, 'overdue', { overdueDays })
    }
  }

  // 2. Conceptos mas debiles del perfil.
  const weakConcepts = weakestConcepts(profiles)
  const weakScoreById = new Map(weakConcepts.map((p) => [p.conceptId, p.score]))
  for (const entry of entries) {
    if (items.filter((i) => i.reason === 'weak').length >= weakQuota) break
    const conceptScore = weakScoreById.get(entry.conceptId)
    if (conceptScore !== undefined) take(entry, 'weak', { conceptScore })
  }

  // 3. Contenido nuevo: problemas sin tarjeta SRS todavia (nunca intentados).
  for (const entry of entries) {
    if (items.length >= sessionSize) break
    if (!cardByProblemId.has(entry.id)) take(entry, 'new')
  }

  // Si todavia queda cupo y hay problemas sin usar, se completa con lo que
  // quede (banco chico: mejor una sesion completa que una corta por
  // categoria vacia).
  for (const entry of entries) {
    if (items.length >= sessionSize) break
    take(entry, 'new')
  }

  return { items, minutes }
}

export const REOPEN_WINDOW_GAMES = 5
export const REOPEN_MISTAKE_THRESHOLD = 3

/**
 * Conceptos cuya leccion conviene reabrir: aparecieron con al menos un
 * error real (context: 'game', result: 'incorrect') en 3 o mas de las
 * ultimas 5 partidas jugadas. Cuenta partidas con el error, no ocurrencias
 * totales -- un solo error repetido muchas veces dentro de una misma
 * partida corta (p.ej. PRIMERA_LINEA_TEMPRANA) no deberia pesar lo mismo
 * que el mismo patron volviendo a aparecer en partidas distintas de
 * verdad. Si el jugador todavia tiene menos de 5 partidas guardadas, usa
 * las que haya -- la ventana es un techo, no un minimo para empezar a
 * contar.
 */
export function findConceptsToReopen(games: SavedGameRecord[]): ConceptId[] {
  const recent = games
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, REOPEN_WINDOW_GAMES)

  const gamesWithMistake = new Map<ConceptId, number>()
  for (const game of recent) {
    const moves = sgfToGameRecord(game.sgf).moves
    const conceptsInThisGame = new Set(
      analyzeGame(gameWidth(game), gameHeight(game), game.komi, moves)
        .filter((occ) => occ.result === 'incorrect')
        .map((occ) => occ.conceptId),
    )
    for (const conceptId of conceptsInThisGame) {
      gamesWithMistake.set(conceptId, (gamesWithMistake.get(conceptId) ?? 0) + 1)
    }
  }

  return [...gamesWithMistake.entries()].filter(([, count]) => count >= REOPEN_MISTAKE_THRESHOLD).map(([conceptId]) => conceptId)
}

export const REOPEN_EXERCISE_WINDOW = 5
export const REOPEN_EXERCISE_THRESHOLD = 3

/**
 * Mismo criterio que findConceptsToReopen, pero con intentos de ejercicio
 * como evidencia en vez de partidas: de los ultimos REOPEN_EXERCISE_WINDOW
 * intentos DE CADA CONCEPTO (no del total general), cuenta cuantos no se
 * resolvieron (attempt.solved === false, el mismo booleano que ya usa
 * computeProfiles para "incorrecto"). >= REOPEN_EXERCISE_THRESHOLD reabre
 * la leccion. A diferencia de una partida, un intento de ejercicio ya viene
 * etiquetado con su concepto de antemano (BankEntry.conceptId) -- no hace
 * falta un detector ni volver a analizar nada, solo agrupar y contar. Cubre
 * el hueco real que dejaba findConceptsToReopen: alguien que falla el mismo
 * concepto una y otra vez en Ejercicios o en Hoy, sin jugar nunca una
 * partida completa donde ese error tambien aparezca, hoy no recibe ningun
 * aviso de volver a leer la leccion.
 */
export function findConceptsToReopenFromExercises(attempts: AttemptRecord[]): ConceptId[] {
  const byConceptId = new Map<ConceptId, AttemptRecord[]>()
  for (const attempt of attempts) {
    const list = byConceptId.get(attempt.conceptId)
    if (list) list.push(attempt)
    else byConceptId.set(attempt.conceptId, [attempt])
  }

  const toReopen: ConceptId[] = []
  for (const [conceptId, conceptAttempts] of byConceptId) {
    const recent = conceptAttempts
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, REOPEN_EXERCISE_WINDOW)
    const failures = recent.filter((a) => !a.solved).length
    if (failures >= REOPEN_EXERCISE_THRESHOLD) toReopen.push(conceptId)
  }

  return toReopen
}
