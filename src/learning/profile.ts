import { ALL_CONCEPT_IDS } from '../analysis/concepts'
import type { ConceptId } from '../analysis/concepts'
import { analyzeGame } from '../analysis/mistakes'
import type { ConceptOccurrence, OccurrenceContext } from '../analysis/mistakes'
import { sgfToGameRecord } from '../core/sgf'
import type { AttemptRecord, SavedGameRecord } from '../storage/db'

const MIN_EXERCISE_ATTEMPTS = 5
const MIN_GAMES = 3
/** Cuantos puntos de puntaje resta cada error de este concepto por cada 100
 * jugadas totales. 10 se eligio para que la escala sea legible: un concepto
 * con un error cada 10 jugadas (bastante seguido) ya deja ese componente en
 * 0, y uno con un error cada 100 jugadas (ocasional) lo deja en 90. No sale
 * del documento de diseno, que deja "factor" sin especificar. */
const ERROR_RATE_FACTOR = 10

export interface ConceptProfile {
  conceptId: ConceptId
  /** 0-100, o null si no hay evidencia suficiente todavia ("sin datos"). */
  score: number | null
  observationCount: number
  correctCount: number
  incorrectCount: number
  lastPracticedAt: string | null
  byContext: Record<OccurrenceContext, { correct: number; incorrect: number }>
}

interface ConceptAggregate {
  observationCount: number
  correctCount: number
  incorrectCount: number
  lastPracticedAt: string | null
  byContext: Record<OccurrenceContext, { correct: number; incorrect: number }>
}

function emptyAggregate(): ConceptAggregate {
  return {
    observationCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    lastPracticedAt: null,
    byContext: { exercise: { correct: 0, incorrect: 0 }, game: { correct: 0, incorrect: 0 } },
  }
}

function applyOccurrence(agg: ConceptAggregate, occurrence: ConceptOccurrence, at: string) {
  agg.observationCount++
  if (occurrence.result === 'correct') {
    agg.correctCount++
    agg.byContext[occurrence.context].correct++
  } else if (occurrence.result === 'incorrect') {
    agg.incorrectCount++
    agg.byContext[occurrence.context].incorrect++
  }
  if (agg.lastPracticedAt === null || at > agg.lastPracticedAt) {
    agg.lastPracticedAt = at
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Perfil de habilidad por concepto (documento de diseno, seccion 5.5):
 * puntaje = 0.6 * aciertoEjercicios + 0.4 * (100 - erroresPor100Jugadas * factor).
 * Si falta una de las dos fuentes de evidencia para un concepto (por
 * ejemplo, nunca se genero un ejercicio de ese concepto, o nunca disparo un
 * detector en una partida), se usa solo la fuente disponible en vez de
 * inventarle un valor neutro a la que falta. La formula sigue basandose
 * solo en aciertos/errores, no en el resto de ConceptOccurrence todavia
 * (tendencia, tiempo de respuesta): esos ejes quedan sin estimador por
 * ahora, ver seccion 1.2 del roadmap post-v1.
 */
export function computeProfiles(attempts: AttemptRecord[], games: SavedGameRecord[]): Record<ConceptId, ConceptProfile> {
  const aggregates = new Map<ConceptId, ConceptAggregate>()
  function aggregateFor(conceptId: ConceptId): ConceptAggregate {
    let agg = aggregates.get(conceptId)
    if (!agg) {
      agg = emptyAggregate()
      aggregates.set(conceptId, agg)
    }
    return agg
  }

  for (const attempt of attempts) {
    const occurrence: ConceptOccurrence = {
      conceptId: attempt.conceptId,
      context: 'exercise',
      result: attempt.solved ? 'correct' : 'incorrect',
      responseTimeMs: attempt.responseTimeMs,
      point: null,
    }
    applyOccurrence(aggregateFor(attempt.conceptId), occurrence, attempt.createdAt)
  }

  let totalMoves = 0
  for (const game of games) {
    const { moves } = sgfToGameRecord(game.sgf)
    totalMoves += moves.length
    const occurrences = analyzeGame(game.size, game.komi, moves)
    for (const occurrence of occurrences) {
      applyOccurrence(aggregateFor(occurrence.conceptId), occurrence, game.createdAt)
    }
  }

  const profiles = {} as Record<ConceptId, ConceptProfile>

  for (const conceptId of ALL_CONCEPT_IDS) {
    const agg = aggregates.get(conceptId) ?? emptyAggregate()
    const exerciseAttempts = agg.byContext.exercise.correct + agg.byContext.exercise.incorrect
    const exerciseAccuracy = exerciseAttempts > 0 ? (agg.byContext.exercise.correct / exerciseAttempts) * 100 : null
    const gameMistakeCount = agg.byContext.game.incorrect

    const hasEvidence = exerciseAttempts >= MIN_EXERCISE_ATTEMPTS || games.length >= MIN_GAMES
    if (!hasEvidence) {
      profiles[conceptId] = { conceptId, score: null, ...agg }
      continue
    }

    const errorPenaltyScore =
      games.length > 0 ? clamp(100 - (gameMistakeCount / Math.max(totalMoves, 1)) * 100 * ERROR_RATE_FACTOR, 0, 100) : null

    let score: number
    if (exerciseAccuracy !== null && errorPenaltyScore !== null) {
      score = 0.6 * exerciseAccuracy + 0.4 * errorPenaltyScore
    } else if (exerciseAccuracy !== null) {
      score = exerciseAccuracy
    } else if (errorPenaltyScore !== null) {
      score = errorPenaltyScore
    } else {
      score = 100 // no debiera pasar: hasEvidence exige uno de los dos, pero se cubre por completitud
    }

    profiles[conceptId] = { conceptId, score, ...agg }
  }

  return profiles
}

/** Los conceptos con peor puntaje, dejando afuera los que todavia no tienen datos. */
export function weakestConcepts(
  profiles: Record<ConceptId, ConceptProfile>,
  count = 5,
): Array<ConceptProfile & { score: number }> {
  return ALL_CONCEPT_IDS.map((id) => profiles[id])
    .filter((p): p is ConceptProfile & { score: number } => p !== undefined && p.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
}
