import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { listGames, saveGame } from '../../src/storage/db'
import type { SavedGameRecord } from '../../src/storage/db'

function sampleRecord(overrides: Partial<SavedGameRecord> = {}): Omit<SavedGameRecord, 'id'> {
  return {
    createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
    size: 9,
    komi: 6.5,
    mode: 'bot',
    botPlayouts: 500,
    result: { black: 40, white: 47.5, winner: 'white' },
    sgf: '(;GM[1]FF[4]SZ[9]KM[6.5])',
    ...overrides,
  }
}

beforeEach(async () => {
  indexedDB = new IDBFactory()
})

describe('almacenamiento de partidas', () => {
  it('guarda una partida y la recupera con listGames', async () => {
    const id = await saveGame(sampleRecord())
    const games = await listGames()

    expect(games.length).toBe(1)
    expect(games[0].id).toBe(id)
    expect(games[0].sgf).toBe('(;GM[1]FF[4]SZ[9]KM[6.5])')
    expect(games[0].result.winner).toBe('white')
  })

  it('acumula varias partidas guardadas en orden', async () => {
    await saveGame(sampleRecord({ mode: 'local', botPlayouts: undefined }))
    await saveGame(sampleRecord({ mode: 'bot', botPlayouts: 2000 }))

    const games = await listGames()
    expect(games.length).toBe(2)
    expect(games.map((g) => g.mode)).toEqual(['local', 'bot'])
  })
})
