import type { ConceptId } from '../analysis/concepts'
import type { BankEntry } from '../content/problemBank'
import { isDue } from '../learning/fsrs'
import { weakestConcepts } from '../learning/profile'
import type { ConceptProfile } from '../learning/profile'
import type { SrsCardRecord } from '../storage/db'

export const DEFAULT_SESSION_MINUTES = 10
/** Estimacion de cuanto tarda una persona en resolver un problema de este
 * banco (tsumegos chicos, 3 a 9 jugadas de profundidad). No hay datos reales
 * de tiempo todavia, asi que sirve solo para convertir minutos de sesion a
 * una cantidad de problemas; se puede ajustar sin tocar el resto del
 * planificador. */
const SECONDS_PER_PROBLEM = 45

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
