import type { Difficulty } from './difficulty'
import type { BankEntry } from './problemBank'
import { listBankEntries } from './problemBank'
import { STRENGTH_LEVELS } from '../ui/play/strengthLevels'

/**
 * Bateria fija del test de nivel: dos problemas de cada dificultad
 * (`difficulty.ts`, calculada para TODO el banco a partir de cuantas jugadas
 * de lectura hace falta para resolver cada uno -- no solo tsumego, tambien
 * escalera/doble atari/valor de area/libertades de semeai, ver
 * problemBank.ts). Con miles de problemas en las tres dificultades (1234
 * faciles, 301 medios, 190 dificiles al momento de escribir esto) sacar dos
 * de cada una al azar en cada intento alcanza para que el test no se sienta
 * repetitivo, sin necesitar el mecanismo de "ventana reciente" que usa
 * Ejercicios (pensado para sesiones largas, no un test corto de una sola
 * vez).
 */
const TIERS: readonly Difficulty[] = ['easy', 'easy', 'medium', 'medium', 'hard', 'hard']

export function pickLevelTestBattery(): BankEntry[] {
  const battery: BankEntry[] = []
  for (const tier of TIERS) {
    const pool = listBankEntries().filter((entry) => entry.difficulty === tier && !battery.some((b) => b.id === entry.id))
    if (pool.length === 0) continue
    battery.push(pool[Math.floor(Math.random() * pool.length)])
  }
  return battery
}

export interface LevelTestItemResult {
  difficulty: Difficulty
  solved: boolean
}

// Misma derivacion que masteryKyu en learning/selfRank.ts: los extremos de
// la escala de kyu ESTIMADA salen de StrengthLevel.approxKyu (mas bajo =
// mas fuerte), no de numeros repetidos a mano, para no poder desalinearse
// si esos valores cambian.
const RATED_KYUS = STRENGTH_LEVELS.map((level) => level.approxKyu).filter((kyu): kyu is number => kyu !== null)
const WEAKEST_KYU = Math.max(...RATED_KYUS)
const STRONGEST_KYU = Math.min(...RATED_KYUS)

// Un problema dificil pesa mas que uno facil, en los dos sentidos: resolverlo
// empuja mas hacia STRONGEST_KYU, y fallarlo empuja menos hacia WEAKEST_KYU
// que fallar uno facil -- fallar un problema dificil no dice mucho (la
// mayoria de la gente lo esperaria), pero fallar uno facil si.
const TIER_WEIGHT: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 }

/**
 * Kyu estimado a partir del desempeno real en el test, interpolado
 * linealmente sobre la misma escala 10-25 de strengthLevels.ts (identico
 * patron a masteryKyu en selfRank.ts): fraccion de peso resuelto 0 ->
 * WEAKEST_KYU, 1 -> STRONGEST_KYU. A diferencia de selfRank.ts (que combina
 * dominio de conceptos ya practicados con tasa de victoria contra el bot),
 * esto viene de una bateria fija resuelta ahora mismo contra problemas cuya
 * dificultad el solucionador ya verifico -- una senal distinta, no un
 * reemplazo. Null si la bateria esta vacia (no deberia pasar en la
 * practica, ver TIERS/pickLevelTestBattery).
 */
export function estimateKyuFromResults(results: LevelTestItemResult[]): number | null {
  let totalWeight = 0
  let solvedWeight = 0
  for (const result of results) {
    const weight = TIER_WEIGHT[result.difficulty]
    totalWeight += weight
    if (result.solved) solvedWeight += weight
  }
  if (totalWeight === 0) return null
  const fraction = solvedWeight / totalWeight
  return WEAKEST_KYU - fraction * (WEAKEST_KYU - STRONGEST_KYU)
}
