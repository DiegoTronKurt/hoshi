import { describe, expect, it } from 'vitest'
import { ALL_AXIS_IDS, AXIS_CONCEPTS } from '../../src/analysis/axes'
import type { ConceptId } from '../../src/analysis/concepts'
import { BLACK } from '../../src/core/types'
import { ADAPTIVE_MIN_GAMES } from '../../src/learning/adaptiveDifficulty'
import type { ConceptProfile } from '../../src/learning/profile'
import { computeSelfRankKyu } from '../../src/learning/selfRank'
import type { SavedGameRecord } from '../../src/storage/db'
import { STRENGTH_LEVELS } from '../../src/ui/play/strengthLevels'

const WEAKEST_KYU = Math.max(...STRENGTH_LEVELS.map((level) => level.approxKyu))
const STRONGEST_KYU = Math.min(...STRENGTH_LEVELS.map((level) => level.approxKyu))

function profileWithScore(conceptId: ConceptId, score: number): ConceptProfile {
  return {
    conceptId,
    score,
    observationCount: 10,
    correctCount: 10,
    incorrectCount: 0,
    lastPracticedAt: null,
    byContext: { exercise: { correct: 10, incorrect: 0 }, game: { correct: 0, incorrect: 0 } },
  }
}

/** Todos los conceptos de todos los ejes con el mismo puntaje, para que el
 * promedio de cada eje (y por lo tanto el promedio general) sea exactamente
 * ese puntaje, sin depender de cuantos conceptos tiene cada eje. */
function profilesWithUniformScore(score: number): Record<ConceptId, ConceptProfile> {
  const profiles = {} as Record<ConceptId, ConceptProfile>
  for (const axisId of ALL_AXIS_IDS) {
    for (const conceptId of AXIS_CONCEPTS[axisId]) {
      profiles[conceptId] = profileWithScore(conceptId, score)
    }
  }
  return profiles
}

const EMPTY_PROFILES = {} as Record<ConceptId, ConceptProfile>

function botGame(overrides: Partial<SavedGameRecord> = {}): SavedGameRecord {
  return {
    id: 1,
    createdAt: '2026-01-01T00:00:00Z',
    size: 9,
    komi: 6.5,
    mode: 'bot',
    botStrengthId: 'normal',
    humanColor: BLACK,
    result: { black: 40, white: 30, winner: 'black' },
    sgf: '(;GM[1]FF[4]SZ[9]KM[6.5])',
    ...overrides,
  }
}

function games(n: number, build: (i: number) => Partial<SavedGameRecord>): SavedGameRecord[] {
  return Array.from({ length: n }, (_, i) =>
    botGame({ createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`, ...build(i) }),
  )
}

describe('computeSelfRankKyu', () => {
  it('sin ningun dato (ni conceptos con evidencia ni partidas contra el bot), no hay estimacion', () => {
    const result = computeSelfRankKyu(EMPTY_PROFILES, [])
    expect(result.kyu).toBeNull()
    expect(result.confidence).toBe('none')
  })

  it('solo dominio de conceptos (sin partidas contra el bot): kyu por dominio, confianza baja', () => {
    const result = computeSelfRankKyu(profilesWithUniformScore(100), [])
    expect(result.confidence).toBe('low')
    expect(result.kyu).toBeCloseTo(STRONGEST_KYU, 5)
  })

  it('dominio en 0 da el extremo mas debil de la escala', () => {
    const result = computeSelfRankKyu(profilesWithUniformScore(0), [])
    expect(result.kyu).toBeCloseTo(WEAKEST_KYU, 5)
  })

  it('dominio a mitad de camino da el punto medio de la escala', () => {
    const result = computeSelfRankKyu(profilesWithUniformScore(50), [])
    expect(result.kyu).toBeCloseTo((WEAKEST_KYU + STRONGEST_KYU) / 2, 5)
  })

  it('solo partidas contra el bot (sin conceptos con evidencia), muestra suficiente: kyu por tasa de victoria, confianza baja', () => {
    const list = games(5, () => ({
      botStrengthId: 'normal',
      humanColor: BLACK,
      result: { black: 40, white: 30, winner: 'black' }, // tasa de victoria 100% -> sube a 'strong'
    }))
    expect(list.length).toBeGreaterThanOrEqual(ADAPTIVE_MIN_GAMES)
    const result = computeSelfRankKyu(EMPTY_PROFILES, list)
    expect(result.confidence).toBe('low')
    expect(result.kyu).toBe(STRENGTH_LEVELS.find((level) => level.id === 'strong')?.approxKyu)
  })

  it('muestra de partidas insuficiente (menos que ADAPTIVE_MIN_GAMES) no cuenta como señal', () => {
    const list = games(ADAPTIVE_MIN_GAMES - 1, () => ({ botStrengthId: 'normal', humanColor: BLACK }))
    const result = computeSelfRankKyu(EMPTY_PROFILES, list)
    expect(result.kyu).toBeNull()
    expect(result.confidence).toBe('none')
  })

  it('con ambas señales disponibles, promedia dominio y tasa de victoria, confianza alta', () => {
    const list = games(5, () => ({
      botStrengthId: 'normal',
      humanColor: BLACK,
      result: { black: 30, white: 40, winner: 'white' }, // tasa de victoria 0% -> baja a 'weak'
    }))
    const result = computeSelfRankKyu(profilesWithUniformScore(100), list)
    const adaptiveKyu = STRENGTH_LEVELS.find((level) => level.id === 'weak')?.approxKyu as number
    expect(result.confidence).toBe('blended')
    expect(result.kyu).toBeCloseTo((STRONGEST_KYU + adaptiveKyu) / 2, 5)
  })
})
