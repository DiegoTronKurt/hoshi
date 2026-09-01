import { describe, expect, it } from 'vitest'
import { toPoint } from '../../src/core/board'
import { gameRecordToSgf } from '../../src/core/sgf'
import { BLACK, WHITE } from '../../src/core/types'
import type { RecordedMove } from '../../src/core/sgf'
import { computeProfiles, weakestConcepts } from '../../src/learning/profile'
import type { AttemptRecord, SavedGameRecord } from '../../src/storage/db'

const SIZE = 9
const p = (x: number, y: number) => toPoint(SIZE, x, y)

function attempt(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    id: 1,
    problemId: 'p1',
    conceptId: 'DOS_OJOS',
    createdAt: '2026-01-01T00:00:00Z',
    solved: true,
    wrongAttempts: 0,
    ...overrides,
  }
}

// Mismo tablero de autoatari usado en tests/analysis/mistakes.test.ts: negro
// juega en (2,2) rodeado por blanco en (1,2),(3,2),(2,1), autoatari puro.
function gameWithAutoatari(): SavedGameRecord {
  const moves: RecordedMove[] = [
    { color: BLACK, point: p(0, 0) },
    { color: WHITE, point: p(1, 2) },
    { color: BLACK, point: p(0, 1) },
    { color: WHITE, point: p(3, 2) },
    { color: BLACK, point: p(0, 2) },
    { color: WHITE, point: p(2, 1) },
    { color: BLACK, point: p(2, 2) },
  ]
  return {
    id: 1,
    createdAt: '2026-01-01T00:00:00Z',
    size: SIZE,
    komi: 0,
    mode: 'local',
    result: { black: 0, white: 0, winner: 'white' },
    sgf: gameRecordToSgf(SIZE, 0, moves),
  }
}

describe('perfil de habilidad', () => {
  it('sin intentos ni partidas, todos los conceptos quedan sin datos', () => {
    const profiles = computeProfiles([], [])
    expect(profiles.DOS_OJOS.score).toBeNull()
    expect(profiles.AUTOATARI.score).toBeNull()
  })

  it('con suficientes ejercicios de un concepto, el puntaje sale solo de la precision', () => {
    const attempts: AttemptRecord[] = [
      attempt({ solved: true }),
      attempt({ solved: true }),
      attempt({ solved: true }),
      attempt({ solved: false }),
      attempt({ solved: false }),
    ]
    const profiles = computeProfiles(attempts, [])
    expect(profiles.DOS_OJOS.byContext.exercise.correct).toBe(3)
    expect(profiles.DOS_OJOS.byContext.exercise.incorrect).toBe(2)
    expect(profiles.DOS_OJOS.observationCount).toBe(5)
    expect(profiles.DOS_OJOS.score).toBeCloseTo(60)
  })

  it('con suficientes partidas, un concepto sin ejercicios igual saca puntaje de los errores detectados', () => {
    const games = [gameWithAutoatari(), gameWithAutoatari(), gameWithAutoatari()]
    const profiles = computeProfiles([], games)
    expect(profiles.AUTOATARI.byContext.exercise.correct + profiles.AUTOATARI.byContext.exercise.incorrect).toBe(0)
    expect(profiles.AUTOATARI.byContext.game.incorrect).toBe(3)
    expect(profiles.AUTOATARI.score).not.toBeNull()
    expect(profiles.AUTOATARI.score as number).toBeLessThan(100)
  })

  it('mezcla ejercicio y partida para el mismo concepto y agrega observaciones de ambos contextos', () => {
    const attempts: AttemptRecord[] = [
      attempt({ conceptId: 'ATARI_IGNORADO', solved: true }),
      attempt({ conceptId: 'ATARI_IGNORADO', solved: false }),
    ]
    const games = [gameWithAutoatari()]
    const profiles = computeProfiles(attempts, games)
    expect(profiles.ATARI_IGNORADO.byContext.exercise.correct).toBe(1)
    expect(profiles.ATARI_IGNORADO.byContext.exercise.incorrect).toBe(1)
    expect(profiles.ATARI_IGNORADO.observationCount).toBe(2)
    expect(profiles.ATARI_IGNORADO.lastPracticedAt).toBe('2026-01-01T00:00:00Z')
  })

  it('weakestConcepts ordena de peor a mejor y excluye los que no tienen datos', () => {
    const attempts: AttemptRecord[] = [
      attempt({ conceptId: 'AUTOATARI', solved: false }),
      attempt({ conceptId: 'AUTOATARI', solved: false }),
      attempt({ conceptId: 'AUTOATARI', solved: false }),
      attempt({ conceptId: 'AUTOATARI', solved: true }),
      attempt({ conceptId: 'AUTOATARI', solved: true }),
      attempt({ conceptId: 'CAPTURA_PERDIDA', solved: true }),
      attempt({ conceptId: 'CAPTURA_PERDIDA', solved: true }),
      attempt({ conceptId: 'CAPTURA_PERDIDA', solved: true }),
      attempt({ conceptId: 'CAPTURA_PERDIDA', solved: true }),
      attempt({ conceptId: 'CAPTURA_PERDIDA', solved: true }),
    ]
    const profiles = computeProfiles(attempts, [])
    const weakest = weakestConcepts(profiles, 3)
    expect(weakest.every((p) => p.score !== null)).toBe(true)
    expect(weakest[0].conceptId).toBe('AUTOATARI')
    for (let i = 1; i < weakest.length; i++) {
      expect(weakest[i].score as number).toBeGreaterThanOrEqual(weakest[i - 1].score as number)
    }
  })
})
