import { describe, expect, it } from 'vitest'
import { BLACK, WHITE } from '../../src/core/types'
import {
  ADAPTIVE_MIN_GAMES,
  computeAdaptiveStrength,
} from '../../src/learning/adaptiveDifficulty'
import type { SavedGameRecord } from '../../src/storage/db'

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

describe('computeAdaptiveStrength', () => {
  it('sin partidas contra el bot, arranca en normal', () => {
    const result = computeAdaptiveStrength([])
    expect(result.strengthId).toBe('normal')
    expect(result.sampleSize).toBe(0)
    expect(result.winRate).toBeNull()
  })

  it('ignora partidas locales y partidas sin humanColor/botStrengthId (guardadas antes de este campo)', () => {
    const result = computeAdaptiveStrength([
      botGame({ mode: 'local', humanColor: undefined, botStrengthId: undefined }),
      botGame({ humanColor: undefined }),
      botGame({ botStrengthId: undefined }),
    ])
    expect(result.sampleSize).toBe(0)
  })

  it('con menos partidas que el minimo, se queda en el ultimo nivel usado sin calcular tasa', () => {
    const list = games(2, () => ({ botStrengthId: 'strong', result: { black: 40, white: 30, winner: 'black' } }))
    const result = computeAdaptiveStrength(list)
    expect(result.sampleSize).toBe(2)
    expect(result.sampleSize).toBeLessThan(ADAPTIVE_MIN_GAMES)
    expect(result.strengthId).toBe('strong')
    expect(result.winRate).toBeNull()
  })

  it('tasa de victoria alta sube un nivel', () => {
    const list = games(5, () => ({
      botStrengthId: 'normal',
      humanColor: BLACK,
      result: { black: 40, white: 30, winner: 'black' },
    }))
    const result = computeAdaptiveStrength(list)
    expect(result.winRate).toBe(1)
    expect(result.strengthId).toBe('strong')
  })

  it('tasa de victoria baja baja un nivel', () => {
    const list = games(5, () => ({
      botStrengthId: 'normal',
      humanColor: BLACK,
      result: { black: 30, white: 40, winner: 'white' },
    }))
    const result = computeAdaptiveStrength(list)
    expect(result.winRate).toBe(0)
    expect(result.strengthId).toBe('weak')
  })

  it('tasa de victoria cercana a la mitad se queda en el mismo nivel', () => {
    const list = games(6, (i) => ({
      botStrengthId: 'normal',
      humanColor: BLACK,
      result: i < 3 ? { black: 40, white: 30, winner: 'black' } : { black: 30, white: 40, winner: 'white' },
    }))
    const result = computeAdaptiveStrength(list)
    expect(result.winRate).toBe(0.5)
    expect(result.strengthId).toBe('normal')
  })

  it('ya en el nivel mas fuerte, una racha ganadora no sube mas alla del techo', () => {
    const list = games(5, () => ({
      botStrengthId: 'veryStrong',
      humanColor: BLACK,
      result: { black: 40, white: 30, winner: 'black' },
    }))
    const result = computeAdaptiveStrength(list)
    expect(result.strengthId).toBe('veryStrong')
  })

  it('ya en el nivel mas debil, una racha perdedora no baja mas alla del piso', () => {
    const list = games(5, () => ({
      botStrengthId: 'weak',
      humanColor: BLACK,
      result: { black: 30, white: 40, winner: 'white' },
    }))
    const result = computeAdaptiveStrength(list)
    expect(result.strengthId).toBe('weak')
  })

  it('usa el color humano correcto para determinar victoria/derrota, no siempre negro', () => {
    const list = games(5, () => ({
      botStrengthId: 'normal',
      humanColor: WHITE,
      result: { black: 30, white: 40, winner: 'white' },
    }))
    const result = computeAdaptiveStrength(list)
    expect(result.winRate).toBe(1)
    expect(result.strengthId).toBe('strong')
  })

  it('solo mira la ventana de las ultimas ADAPTIVE_WINDOW partidas, no todo el historial', () => {
    const old = games(20, () => ({
      botStrengthId: 'normal',
      humanColor: BLACK,
      result: { black: 30, white: 40, winner: 'white' },
    }))
    const recent = games(10, (i) => ({
      createdAt: `2027-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      botStrengthId: 'normal',
      humanColor: BLACK,
      result: { black: 40, white: 30, winner: 'black' },
    }))
    const result = computeAdaptiveStrength([...old, ...recent])
    expect(result.sampleSize).toBe(10)
    expect(result.winRate).toBe(1)
    expect(result.strengthId).toBe('strong')
  })
})
