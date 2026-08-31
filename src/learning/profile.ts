import { ALL_CONCEPT_IDS } from '../analysis/concepts'
import type { ConceptId } from '../analysis/concepts'
import { analyzeGame } from '../analysis/mistakes'
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
  exerciseAttempts: number
  exerciseAccuracy: number | null
  gameMistakeCount: number
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
 * inventarle un valor neutro a la que falta.
 */
export function computeProfiles(attempts: AttemptRecord[], games: SavedGameRecord[]): Record<ConceptId, ConceptProfile> {
  const mistakesByConcept = new Map<ConceptId, number>()
  let totalMoves = 0

  for (const game of games) {
    const { moves } = sgfToGameRecord(game.sgf)
    totalMoves += moves.length
    const events = analyzeGame(game.size, game.komi, moves)
    for (const event of events) {
      mistakesByConcept.set(event.conceptId, (mistakesByConcept.get(event.conceptId) ?? 0) + 1)
    }
  }

  const profiles = {} as Record<ConceptId, ConceptProfile>

  for (const conceptId of ALL_CONCEPT_IDS) {
    const conceptAttempts = attempts.filter((a) => a.conceptId === conceptId)
    const exerciseAttempts = conceptAttempts.length
    const exerciseAccuracy =
      exerciseAttempts > 0 ? (conceptAttempts.filter((a) => a.solved).length / exerciseAttempts) * 100 : null
    const gameMistakeCount = mistakesByConcept.get(conceptId) ?? 0

    const hasEvidence = exerciseAttempts >= MIN_EXERCISE_ATTEMPTS || games.length >= MIN_GAMES
    if (!hasEvidence) {
      profiles[conceptId] = { conceptId, score: null, exerciseAttempts, exerciseAccuracy, gameMistakeCount }
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

    profiles[conceptId] = { conceptId, score, exerciseAttempts, exerciseAccuracy, gameMistakeCount }
  }

  return profiles
}

/** Los conceptos con peor puntaje, dejando afuera los que todavia no tienen datos. */
export function weakestConcepts(profiles: Record<ConceptId, ConceptProfile>, count = 5): ConceptProfile[] {
  return ALL_CONCEPT_IDS.map((id) => profiles[id])
    .filter((p): p is ConceptProfile & { score: number } => p !== undefined && p.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
}
