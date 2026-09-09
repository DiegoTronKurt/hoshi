import { describe, expect, it } from 'vitest'
import { ALL_AXIS_IDS, AXIS_CONCEPTS } from '../../src/analysis/axes'
import { computeSelfRankTrend } from '../../src/learning/selfRankTrend'
import type { AttemptRecord } from '../../src/storage/db'

const CONCEPT_ID = AXIS_CONCEPTS[ALL_AXIS_IDS[0]][0]

function attempts(n: number, createdAt: string): AttemptRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    problemId: `p${i}`,
    conceptId: CONCEPT_ID,
    createdAt,
    solved: true,
    wrongAttempts: 0,
  }))
}

describe('computeSelfRankTrend', () => {
  it('sin ningun dato, ni el momento pasado ni el presente tienen estimacion', () => {
    const trend = computeSelfRankTrend([], [])
    expect(trend.past.kyu).toBeNull()
    expect(trend.current.kyu).toBeNull()
  })

  it('evidencia toda reciente (dentro de la ventana de 30 dias): el presente tiene estimacion, el pasado no', () => {
    const recent = new Date().toISOString()
    const trend = computeSelfRankTrend(attempts(5, recent), [])
    expect(trend.current.kyu).not.toBeNull()
    expect(trend.past.kyu).toBeNull()
  })

  it('con evidencia de hace mas de 30 dias y evidencia reciente, ambos momentos tienen estimacion', () => {
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const recent = new Date().toISOString()
    const trend = computeSelfRankTrend([...attempts(5, old), ...attempts(5, recent)], [])
    expect(trend.past.kyu).not.toBeNull()
    expect(trend.current.kyu).not.toBeNull()
  })

  it('respeta una ventana distinta a los 30 dias por defecto', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    const trendDefault = computeSelfRankTrend(attempts(5, eightDaysAgo), [], 30)
    expect(trendDefault.past.kyu).toBeNull()

    const trendShortWindow = computeSelfRankTrend(attempts(5, eightDaysAgo), [], 7)
    expect(trendShortWindow.past.kyu).not.toBeNull()
  })
})
