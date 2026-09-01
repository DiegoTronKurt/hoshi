import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCard } from '../../src/learning/fsrs'
import { getSrsCard, listAttempts, listGames, listSrsCards, recordAttempt, saveGame, saveSrsCard } from '../../src/storage/db'
import type { AttemptRecord, SavedGameRecord, SrsCardRecord } from '../../src/storage/db'

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

function sampleAttempt(overrides: Partial<AttemptRecord> = {}): Omit<AttemptRecord, 'id'> {
  return {
    problemId: 'p1',
    conceptId: 'DOS_OJOS',
    createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
    solved: true,
    wrongAttempts: 0,
    ...overrides,
  }
}

describe('almacenamiento de intentos de ejercicio', () => {
  it('guarda un intento y lo recupera con listAttempts', async () => {
    const id = await recordAttempt(sampleAttempt())
    const attempts = await listAttempts()

    expect(attempts.length).toBe(1)
    expect(attempts[0].id).toBe(id)
    expect(attempts[0].solved).toBe(true)
  })

  it('acumula varios intentos', async () => {
    await recordAttempt(sampleAttempt({ solved: true }))
    await recordAttempt(sampleAttempt({ solved: false, wrongAttempts: 2 }))

    const attempts = await listAttempts()
    expect(attempts.length).toBe(2)
    expect(attempts.map((a) => a.solved)).toEqual([true, false])
  })

  it('guarda y recupera el tiempo de respuesta', async () => {
    await recordAttempt(sampleAttempt({ responseTimeMs: 4200 }))

    const attempts = await listAttempts()
    expect(attempts[0].responseTimeMs).toBe(4200)
  })

  it('un intento sin tiempo de respuesta queda sin ese campo', async () => {
    await recordAttempt(sampleAttempt())

    const attempts = await listAttempts()
    expect(attempts[0].responseTimeMs).toBeUndefined()
  })
})

describe('almacenamiento de tarjetas SRS', () => {
  it('guarda una tarjeta y la recupera por problemId', async () => {
    const card = createCard(new Date('2026-01-01T00:00:00Z'))
    const record: SrsCardRecord = { problemId: 'p1', conceptId: 'DOS_OJOS', card }
    await saveSrsCard(record)

    const found = await getSrsCard('p1')
    expect(found?.conceptId).toBe('DOS_OJOS')
    expect(found?.card.due.getTime()).toBe(card.due.getTime())
  })

  it('revisar la misma tarjeta actualiza la fila en vez de duplicarla', async () => {
    const card = createCard(new Date('2026-01-01T00:00:00Z'))
    await saveSrsCard({ problemId: 'p1', conceptId: 'DOS_OJOS', card })

    const updatedCard = { ...card, reps: 1 }
    await saveSrsCard({ problemId: 'p1', conceptId: 'DOS_OJOS', card: updatedCard })

    const all = await listSrsCards()
    expect(all.length).toBe(1)
    expect(all[0].card.reps).toBe(1)
  })

  it('getSrsCard devuelve undefined si el problema nunca se reviso', async () => {
    const found = await getSrsCard('inexistente')
    expect(found).toBeUndefined()
  })
})
