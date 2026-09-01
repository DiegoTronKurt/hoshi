import { describe, expect, it } from 'vitest'
import { computeStreak } from '../../src/learning/streak'
import type { AttemptRecord, SavedGameRecord } from '../../src/storage/db'

// Fechas sin sufijo 'Z' a proposito: se interpretan en hora local, para que
// el dia calendario que extrae computeStreak sea el mismo sin importar la
// zona horaria de la maquina que corre el test.
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

function game(overrides: Partial<SavedGameRecord> = {}): SavedGameRecord {
  return {
    id: 1,
    createdAt: '2026-01-10T10:00:00',
    size: 9,
    komi: 6.5,
    mode: 'local',
    result: { black: 1, white: 0, winner: 'black' },
    sgf: '(;SZ[9])',
    ...overrides,
  }
}

const NOW = new Date(2026, 0, 10, 12, 0, 0) // 10 de enero de 2026, mediodia local

describe('racha de practica', () => {
  it('sin actividad, la racha queda en cero', () => {
    const streak = computeStreak([], [], NOW)
    expect(streak).toEqual({ current: 0, longest: 0, activeToday: false, lastActiveDate: null })
  })

  it('racha activa hoy, ayer y anteayer', () => {
    const attempts = [
      attempt({ createdAt: '2026-01-08T09:00:00' }),
      attempt({ createdAt: '2026-01-09T09:00:00' }),
      attempt({ createdAt: '2026-01-10T09:00:00' }),
    ]
    const streak = computeStreak(attempts, [], NOW)
    expect(streak.current).toBe(3)
    expect(streak.longest).toBe(3)
    expect(streak.activeToday).toBe(true)
    expect(streak.lastActiveDate).toBe('2026-01-10')
  })

  it('periodo de gracia: hubo actividad hasta ayer pero todavia nada hoy', () => {
    const attempts = [
      attempt({ createdAt: '2026-01-08T09:00:00' }),
      attempt({ createdAt: '2026-01-09T09:00:00' }),
    ]
    const streak = computeStreak(attempts, [], NOW)
    expect(streak.current).toBe(2)
    expect(streak.activeToday).toBe(false)
    expect(streak.lastActiveDate).toBe('2026-01-09')
  })

  it('racha rota: pasaron dos dias locales completos sin actividad', () => {
    const attempts = [
      attempt({ createdAt: '2026-01-06T09:00:00' }),
      attempt({ createdAt: '2026-01-07T09:00:00' }),
    ]
    const streak = computeStreak(attempts, [], NOW)
    expect(streak.current).toBe(0)
    expect(streak.activeToday).toBe(false)
    expect(streak.longest).toBe(2)
  })

  it('longest historico se mantiene aunque la racha vigente sea mas corta', () => {
    const attempts = [
      attempt({ createdAt: '2026-01-01T09:00:00' }),
      attempt({ createdAt: '2026-01-02T09:00:00' }),
      attempt({ createdAt: '2026-01-03T09:00:00' }),
      attempt({ createdAt: '2026-01-04T09:00:00' }),
      attempt({ createdAt: '2026-01-05T09:00:00' }),
      attempt({ createdAt: '2026-01-09T09:00:00' }),
      attempt({ createdAt: '2026-01-10T09:00:00' }),
    ]
    const streak = computeStreak(attempts, [], NOW)
    expect(streak.longest).toBe(5)
    expect(streak.current).toBe(2)
    expect(streak.activeToday).toBe(true)
  })

  it('varios registros el mismo dia cuentan como un solo dia', () => {
    const attempts = [
      attempt({ createdAt: '2026-01-10T08:00:00' }),
      attempt({ createdAt: '2026-01-10T09:00:00' }),
      attempt({ createdAt: '2026-01-10T20:00:00' }),
    ]
    const games = [game({ createdAt: '2026-01-10T21:00:00' })]
    const streak = computeStreak(attempts, games, NOW)
    expect(streak.current).toBe(1)
    expect(streak.longest).toBe(1)
    expect(streak.activeToday).toBe(true)
  })
})
