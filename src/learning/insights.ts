import type { ConceptId } from '../analysis/concepts'
import type { ConceptProfile } from './profile'

/** Minimo de observaciones en cada contexto antes de mostrar una comparacion:
 * con menos, un solo intento suerte/mala suerte domina el porcentaje. */
const MIN_SAMPLES_PER_CONTEXT = 3
/** Diferencia en puntos porcentuales a partir de la cual vale la pena
 * llamar la atencion sobre la brecha, en vez de mostrarla como "similar". */
const NOTABLE_GAP = 15

export type InsightKind = 'knowsNotApplies' | 'consistent' | 'appliesBetterThanKnows'

export interface KnowledgeApplicationInsight {
  conceptId: ConceptId
  exercisePct: number
  gamePct: number
  gap: number
  kind: InsightKind
}

/**
 * Compara, por concepto, el acierto en ejercicios (contexto controlado,
 * "conocimiento") contra el acierto en partidas reales (contexto libre,
 * "aplicacion"). Los datos ya existen en ConceptProfile.byContext (Fase B);
 * esto es solo la agregacion a porcentaje y la clasificacion de la brecha.
 *
 * Cobertura real hoy: la mayoria de los detectores de partida solo emiten
 * el caso "incorrecto" (ver analysis/mistakes.ts), asi que gamePct sale en
 * 0% en cuanto hay un solo error de ese concepto en una partida, salvo para
 * ATARI_IGNORADO y ESCALERA (los unicos con caso "correcto" implementado).
 * Es una limitacion de cobertura ya documentada, no un bug de esta funcion.
 */
export function computeKnowledgeApplicationInsights(
  profiles: Record<ConceptId, ConceptProfile>,
): KnowledgeApplicationInsight[] {
  const insights: KnowledgeApplicationInsight[] = []

  for (const conceptId of Object.keys(profiles) as ConceptId[]) {
    const profile = profiles[conceptId]
    const exercise = profile.byContext.exercise
    const game = profile.byContext.game
    const exerciseTotal = exercise.correct + exercise.incorrect
    const gameTotal = game.correct + game.incorrect
    if (exerciseTotal < MIN_SAMPLES_PER_CONTEXT || gameTotal < MIN_SAMPLES_PER_CONTEXT) continue

    const exercisePct = (exercise.correct / exerciseTotal) * 100
    const gamePct = (game.correct / gameTotal) * 100
    const gap = exercisePct - gamePct

    let kind: InsightKind = 'consistent'
    if (gap >= NOTABLE_GAP) kind = 'knowsNotApplies'
    else if (gap <= -NOTABLE_GAP) kind = 'appliesBetterThanKnows'

    insights.push({ conceptId, exercisePct, gamePct, gap, kind })
  }

  return insights.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
}
