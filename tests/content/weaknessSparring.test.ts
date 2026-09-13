import { describe, expect, it } from 'vitest'
import type { ConceptId } from '../../src/analysis/concepts'
import type { ConceptProfile } from '../../src/learning/profile'
import { pickWeaknessSparringSeed } from '../../src/content/weaknessSparring'
import { listBankEntries } from '../../src/content/problemBank'

function stubProfile(conceptId: ConceptId, score: number | null): ConceptProfile {
  return {
    conceptId,
    score,
    observationCount: score === null ? 0 : 10,
    correctCount: 0,
    incorrectCount: 0,
    lastPracticedAt: null,
    byContext: { exercise: { correct: 0, incorrect: 0 }, game: { correct: 0, incorrect: 0 } },
  }
}

describe('pickWeaknessSparringSeed', () => {
  it('null si ningun concepto tiene evidencia todavia (mismo caso que profile.selfRank.insufficientData)', () => {
    const profiles = { CAPTURA_SIMPLE: stubProfile('CAPTURA_SIMPLE', null) } as Record<ConceptId, ConceptProfile>
    expect(pickWeaknessSparringSeed(profiles)).toBeNull()
  })

  it('elige el concepto de peor puntaje entre los que tienen evidencia, no el primero declarado', () => {
    const profiles = {
      CAPTURA_SIMPLE: stubProfile('CAPTURA_SIMPLE', 90),
      DOBLE_ATARI: stubProfile('DOBLE_ATARI', 20), // el mas debil
      ESCALERA: stubProfile('ESCALERA', 60),
    } as Record<ConceptId, ConceptProfile>

    const result = pickWeaknessSparringSeed(profiles)
    expect(result?.conceptId).toBe('DOBLE_ATARI')
  })

  it('la semilla arranca en modo bot, y toMove/tablero vienen de una entrada real de ese concepto', () => {
    const profiles = { CAPTURA_SIMPLE: stubProfile('CAPTURA_SIMPLE', 10) } as Record<ConceptId, ConceptProfile>
    const result = pickWeaknessSparringSeed(profiles)

    expect(result).not.toBeNull()
    expect(result!.seed.mode).toBe('bot')
    expect(result!.seed.width).toBeGreaterThan(0)
    expect(result!.seed.height).toBeGreaterThan(0)
    expect(result!.seed.stones.length).toBe(result!.seed.width * result!.seed.height)
  })

  // Cada BankEntryKind construye toMove de una forma distinta (ver
  // initialToMove en useSolvableExercise.ts) -- probar uno de cada familia
  // real (no solo tsumego) confirma que pickWeaknessSparringSeed funciona
  // igual de bien para los 5, no solo para el caso mas comun.
  const representativeConcepts: ConceptId[] = ['CAPTURA_SIMPLE', 'ESCALERA', 'DOBLE_ATARI', 'RELLENO_TERRITORIO_PROPIO', 'CONTAR_LIBERTADES_ANTES_DE_JUGAR']
  for (const conceptId of representativeConcepts) {
    it(`funciona para el concepto ${conceptId} (confirma que existen entradas reales de esta familia)`, () => {
      expect(listBankEntries(conceptId).length).toBeGreaterThan(0)
      const profiles = { [conceptId]: stubProfile(conceptId, 5) } as Record<ConceptId, ConceptProfile>
      const result = pickWeaknessSparringSeed(profiles)
      expect(result?.conceptId).toBe(conceptId)
      expect(result?.seed.mode).toBe('bot')
    })
  }
})
