import { describe, expect, it } from 'vitest'
import type { ConceptId } from '../../src/analysis/concepts'
import type { BankEntry } from '../../src/content/problemBank'
import { Rating, createCard, reviewCard } from '../../src/learning/fsrs'
import type { ConceptProfile } from '../../src/learning/profile'
import { planSession } from '../../src/training-policy/session'
import type { SrsCardRecord } from '../../src/storage/db'

const NOW = new Date('2026-01-10T00:00:00Z')

function entry(id: string, conceptId: ConceptId): BankEntry {
  return { id, conceptId, sgf: '', difficulty: 'easy' }
}

function emptyProfiles(): Record<ConceptId, ConceptProfile> {
  return {} as Record<ConceptId, ConceptProfile>
}

function profile(conceptId: ConceptId, score: number, correct: number, incorrect: number): ConceptProfile {
  return {
    conceptId,
    score,
    observationCount: correct + incorrect,
    correctCount: correct,
    incorrectCount: incorrect,
    lastPracticedAt: null,
    byContext: { exercise: { correct, incorrect }, game: { correct: 0, incorrect: 0 } },
  }
}

describe('planificador de sesion diaria', () => {
  it('sin tarjetas SRS, la sesion se completa entera con contenido nuevo', () => {
    const entries = [entry('p1', 'DOS_OJOS'), entry('p2', 'DOS_OJOS'), entry('p3', 'PUNTO_VITAL')]
    const plan = planSession(entries, [], emptyProfiles(), NOW, 1)
    expect(plan.items.length).toBeGreaterThan(0)
    expect(plan.items.every((i) => i.reason === 'new')).toBe(true)
  })

  it('prioriza los elementos vencidos de la cola SRS', () => {
    const entries = [entry('p1', 'DOS_OJOS'), entry('p2', 'DOS_OJOS'), entry('p3', 'PUNTO_VITAL')]
    const overdueCard = createCard(new Date('2026-01-01T00:00:00Z')) // vencida hace dias
    const futureCard = reviewCard(createCard(NOW), Rating.Good, NOW) // recien revisada, no vencida
    const cards: SrsCardRecord[] = [
      { problemId: 'p1', conceptId: 'DOS_OJOS', card: overdueCard },
      { problemId: 'p2', conceptId: 'DOS_OJOS', card: futureCard },
    ]
    const plan = planSession(entries, cards, emptyProfiles(), NOW, 10)
    const overdueItems = plan.items.filter((i) => i.reason === 'overdue')
    expect(overdueItems.map((i) => i.entry.id)).toContain('p1')
    expect(overdueItems.map((i) => i.entry.id)).not.toContain('p2')
  })

  it('incluye problemas de los conceptos mas debiles del perfil', () => {
    const entries = [entry('p1', 'AUTOATARI'), entry('p2', 'DOS_OJOS')]
    const profiles: Record<ConceptId, ConceptProfile> = {
      ...emptyProfiles(),
      AUTOATARI: profile('AUTOATARI', 10, 1, 4),
    }
    const plan = planSession(entries, [], profiles, NOW, 10)
    const weakItems = plan.items.filter((i) => i.reason === 'weak')
    expect(weakItems.some((i) => i.entry.id === 'p1')).toBe(true)
  })

  it('no repite el mismo problema en dos categorias', () => {
    const entries = [entry('p1', 'DOS_OJOS')]
    const overdueCard = createCard(new Date('2026-01-01T00:00:00Z'))
    const cards: SrsCardRecord[] = [{ problemId: 'p1', conceptId: 'DOS_OJOS', card: overdueCard }]
    const profiles: Record<ConceptId, ConceptProfile> = {
      ...emptyProfiles(),
      DOS_OJOS: profile('DOS_OJOS', 5, 0, 5),
    }
    const plan = planSession(entries, cards, profiles, NOW, 10)
    const ids = plan.items.map((i) => i.entry.id)
    expect(ids.length).toBe(new Set(ids).size)
  })
})
