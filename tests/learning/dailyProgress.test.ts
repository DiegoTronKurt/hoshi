import { describe, expect, it } from 'vitest'
import { countCompletedToday } from '../../src/learning/dailyProgress'
import type { AttemptRecord } from '../../src/storage/db'

// Fechas sin sufijo 'Z' a proposito: se interpretan en hora local, mismo
// motivo que streak.test.ts.
function attempt(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    id: 1,
    problemId: 'p1',
    conceptId: 'DOS_OJOS',
    createdAt: '2026-01-10T10:00:00',
    solved: true,
    wrongAttempts: 0,
    ...overrides,
  }
}

const NOW = new Date(2026, 0, 10, 12, 0, 0) // 10 de enero de 2026, mediodia local

describe('countCompletedToday', () => {
  it('cuenta solo los intentos resueltos de hoy', () => {
    const attempts = [
      attempt({ id: 1, solved: true, createdAt: '2026-01-10T08:00:00' }),
      attempt({ id: 2, solved: false, createdAt: '2026-01-10T09:00:00' }),
      attempt({ id: 3, solved: true, createdAt: '2026-01-09T23:59:00' }),
    ]
    expect(countCompletedToday(attempts, NOW)).toBe(1)
  })

  it('sin intentos, el conteo es cero', () => {
    expect(countCompletedToday([], NOW)).toBe(0)
  })
})
