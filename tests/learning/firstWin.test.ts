import { describe, expect, it } from 'vitest'
import { BLACK, WHITE } from '../../src/core/types'
import { bucketFirstWin, computeFirstWin } from '../../src/learning/firstWin'
import type { SavedGameRecord } from '../../src/storage/db'

function botGame(overrides: Partial<SavedGameRecord> = {}): SavedGameRecord {
  return {
    id: 1,
    createdAt: '2026-01-01T00:10:00Z',
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

const FIRST_OPEN = '2026-01-01T00:00:00Z'

describe('computeFirstWin', () => {
  it('sin fecha de primera apertura registrada, no calcula nada', () => {
    expect(computeFirstWin([botGame()], null).elapsedMs).toBeNull()
  })

  it('sin ninguna partida ganada contra el bot, no calcula nada', () => {
    expect(computeFirstWin([], FIRST_OPEN).elapsedMs).toBeNull()
    expect(computeFirstWin([botGame({ result: { black: 30, white: 40, winner: 'white' } })], FIRST_OPEN).elapsedMs).toBeNull()
  })

  it('ignora partidas locales, aunque tengan un ganador', () => {
    const result = computeFirstWin([botGame({ mode: 'local' })], FIRST_OPEN)
    expect(result.elapsedMs).toBeNull()
  })

  it('ignora partidas contra el bot sin humanColor (guardadas antes de este campo)', () => {
    const result = computeFirstWin([botGame({ humanColor: undefined })], FIRST_OPEN)
    expect(result.elapsedMs).toBeNull()
  })

  it('calcula los milisegundos entre la primera apertura y la primera victoria contra el bot', () => {
    const result = computeFirstWin([botGame({ createdAt: '2026-01-01T00:10:00Z' })], FIRST_OPEN)
    expect(result.elapsedMs).toBe(10 * 60 * 1000)
  })

  it('usa la victoria mas temprana, no la primera del arreglo', () => {
    const result = computeFirstWin(
      [
        botGame({ createdAt: '2026-01-01T02:00:00Z' }),
        botGame({ createdAt: '2026-01-01T00:20:00Z' }),
        botGame({ createdAt: '2026-01-01T01:00:00Z' }),
      ],
      FIRST_OPEN,
    )
    expect(result.elapsedMs).toBe(20 * 60 * 1000)
  })

  it('cuenta la victoria por color: humano jugando blanco y ganando blanco cuenta', () => {
    const result = computeFirstWin(
      [botGame({ humanColor: WHITE, result: { black: 30, white: 40, winner: 'white' }, createdAt: '2026-01-01T00:05:00Z' })],
      FIRST_OPEN,
    )
    expect(result.elapsedMs).toBe(5 * 60 * 1000)
  })

  it('una derrota previa no cuenta como victoria, solo importa la primera que si se gano', () => {
    const result = computeFirstWin(
      [
        botGame({ createdAt: '2026-01-01T00:05:00Z', result: { black: 20, white: 40, winner: 'white' } }),
        botGame({ createdAt: '2026-01-01T00:30:00Z', result: { black: 40, white: 20, winner: 'black' } }),
      ],
      FIRST_OPEN,
    )
    expect(result.elapsedMs).toBe(30 * 60 * 1000)
  })
})

describe('bucketFirstWin', () => {
  it('menos de una hora, en minutos (minimo 1)', () => {
    expect(bucketFirstWin(30_000)).toEqual({ unit: 'minutes', value: 1 })
    expect(bucketFirstWin(25 * 60_000)).toEqual({ unit: 'minutes', value: 25 })
  })

  it('una hora o mas pero menos de un dia, en horas', () => {
    expect(bucketFirstWin(90 * 60_000)).toEqual({ unit: 'hours', value: 2 })
    expect(bucketFirstWin(23 * 60 * 60_000)).toEqual({ unit: 'hours', value: 23 })
  })

  it('un dia o mas, en dias', () => {
    expect(bucketFirstWin(25 * 60 * 60_000)).toEqual({ unit: 'days', value: 1 })
    expect(bucketFirstWin(72 * 60 * 60_000)).toEqual({ unit: 'days', value: 3 })
  })
})
