import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  BACKUP_SCHEMA_VERSION,
  InvalidBackupError,
  exportBackup,
  importBackup,
  parseBackup,
} from '../../src/storage/backup'
import { getSrsCard, listAttempts, listGames, recordAttempt, saveGame, saveSrsCard } from '../../src/storage/db'
import { createCard } from '../../src/learning/fsrs'

beforeEach(() => {
  indexedDB = new IDBFactory()
  localStorage.clear()
})

function sampleGame() {
  return {
    createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
    size: 9,
    komi: 6.5,
    mode: 'local' as const,
    result: { black: 40, white: 30, winner: 'black' as const },
    sgf: '(;GM[1]FF[4]SZ[9]KM[6.5])',
  }
}

function sampleAttempt() {
  return {
    problemId: 'p1',
    conceptId: 'DOS_OJOS' as const,
    createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
    solved: true,
    wrongAttempts: 0,
  }
}

describe('exportBackup', () => {
  it('incluye partidas, intentos, tarjetas srs y ajustes respaldables', async () => {
    await saveGame(sampleGame())
    await recordAttempt(sampleAttempt())
    const card = createCard(new Date('2026-01-01T00:00:00Z'))
    await saveSrsCard({ problemId: 'p1', conceptId: 'DOS_OJOS', card })
    localStorage.setItem('hoshi-daily-goal', '5')

    const backup = await exportBackup()

    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(backup.partidas.length).toBe(1)
    expect(backup.intentos.length).toBe(1)
    expect(backup.srs.length).toBe(1)
    expect(backup.settings['hoshi-daily-goal']).toBe('5')
  })

  it('con la base vacia, exporta arreglos vacios en vez de fallar', async () => {
    const backup = await exportBackup()
    expect(backup.partidas).toEqual([])
    expect(backup.intentos).toEqual([])
    expect(backup.srs).toEqual([])
  })
})

describe('parseBackup', () => {
  it('acepta un objeto con la forma correcta', () => {
    const parsed = parseBackup({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-01-01T00:00:00Z',
      partidas: [],
      intentos: [],
      srs: [],
      settings: {},
    })
    expect(parsed.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
  })

  it('rechaza un valor que no es un objeto', () => {
    expect(() => parseBackup('no es un objeto')).toThrow(InvalidBackupError)
    expect(() => parseBackup(null)).toThrow(InvalidBackupError)
  })

  it('rechaza una version de esquema distinta', () => {
    expect(() =>
      parseBackup({ schemaVersion: 999, partidas: [], intentos: [], srs: [] }),
    ).toThrow(InvalidBackupError)
  })

  it('rechaza un objeto al que le faltan los arreglos esperados', () => {
    expect(() => parseBackup({ schemaVersion: BACKUP_SCHEMA_VERSION })).toThrow(InvalidBackupError)
  })
})

describe('importBackup', () => {
  it('reemplaza los datos existentes por los del respaldo', async () => {
    await saveGame(sampleGame())
    await recordAttempt(sampleAttempt())

    const backup = parseBackup({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-02-01T00:00:00Z',
      partidas: [{ ...sampleGame(), id: 99 }],
      intentos: [],
      srs: [],
      settings: { 'hoshi-daily-goal': '7' },
    })

    await importBackup(backup)

    const games = await listGames()
    const attempts = await listAttempts()
    expect(games.length).toBe(1)
    expect(attempts.length).toBe(0)
    expect(localStorage.getItem('hoshi-daily-goal')).toBe('7')
  })

  it('restaura tarjetas srs conservando su problemId', async () => {
    const card = createCard(new Date('2026-01-01T00:00:00Z'))
    const backup = parseBackup({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-02-01T00:00:00Z',
      partidas: [],
      intentos: [],
      srs: [{ problemId: 'restored-1', conceptId: 'DOS_OJOS', card }],
      settings: {},
    })

    await importBackup(backup)

    const found = await getSrsCard('restored-1')
    expect(found?.conceptId).toBe('DOS_OJOS')
  })
})
