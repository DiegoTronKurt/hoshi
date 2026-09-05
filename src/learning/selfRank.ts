import type { ConceptId } from '../analysis/concepts'
import { computeAxisScores } from '../analysis/axes'
import type { SavedGameRecord } from '../storage/db'
import { approxKyuForStrengthId, STRENGTH_LEVELS } from '../ui/play/strengthLevels'
import { ADAPTIVE_MIN_GAMES, computeAdaptiveStrength } from './adaptiveDifficulty'
import type { ConceptProfile } from './profile'

// Extremos de la misma escala de kyu ESTIMADA que ya usa strengthLevels.ts
// (mas bajo = mas fuerte), derivados de ahi en vez de repetidos a mano para
// no poder desalinearse si esos numeros cambian.
const WEAKEST_KYU = Math.max(...STRENGTH_LEVELS.map((level) => level.approxKyu))
const STRONGEST_KYU = Math.min(...STRENGTH_LEVELS.map((level) => level.approxKyu))

export interface SelfRankResult {
  kyu: number | null
  /** 'blended': ambas senales disponibles. 'low': solo una de las dos.
   * 'none': ninguna (sin partidas contra el bot ni conceptos con evidencia
   * todavia). */
  confidence: 'blended' | 'low' | 'none'
}

/** Kyu estimado a partir del promedio de los ejes con datos (radar de
 * Perfil), interpolado linealmente sobre la misma escala 10-25 de
 * strengthLevels.ts: puntaje 100 -> STRONGEST_KYU, puntaje 0 -> WEAKEST_KYU.
 * Null si ningun eje tiene evidencia todavia. */
function masteryKyu(profiles: Record<ConceptId, ConceptProfile>): number | null {
  const scores = computeAxisScores(profiles)
    .map((axis) => axis.score)
    .filter((score): score is number => score !== null)
  if (scores.length === 0) return null
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
  return WEAKEST_KYU - (average / 100) * (WEAKEST_KYU - STRONGEST_KYU)
}

/**
 * Estimacion de rango propio para la pantalla Perfil: combina dominio de
 * conceptos (radar) con tasa de victoria real contra el bot
 * (computeAdaptiveStrength, la misma funcion que ya usa PlayConfigScreen
 * para sugerir dificultad -- una sola fuente de verdad, no dos calculos de
 * tasa de victoria por separado). "Calcular, no guardar", mismo patron que
 * computeProfiles()/computeAdaptiveStrength(). Ambos numeros son ESTIMADOS,
 * no calibrados contra rangos reales -- mismo aviso que ya lleva approxKyu
 * en strengthLevels.ts.
 */
export function computeSelfRankKyu(
  profiles: Record<ConceptId, ConceptProfile>,
  games: SavedGameRecord[],
): SelfRankResult {
  const mastery = masteryKyu(profiles)
  const adaptive = computeAdaptiveStrength(games)
  const adaptiveKyu = adaptive.sampleSize >= ADAPTIVE_MIN_GAMES ? approxKyuForStrengthId(adaptive.strengthId) : null

  if (mastery !== null && adaptiveKyu !== null) {
    return { kyu: (mastery + adaptiveKyu) / 2, confidence: 'blended' }
  }
  if (mastery !== null) return { kyu: mastery, confidence: 'low' }
  if (adaptiveKyu !== null) return { kyu: adaptiveKyu, confidence: 'low' }
  return { kyu: null, confidence: 'none' }
}
