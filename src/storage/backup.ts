import { listAttempts, listGames, listSrsCards, restoreAllStores } from './db'
import type { AttemptRecord, SavedGameRecord, SrsCardRecord } from './db'

export const BACKUP_SCHEMA_VERSION = 1

/** Claves de localStorage que vale la pena respaldar junto con el progreso.
 * No incluye nada derivado (el perfil de habilidad, la racha, el nivel actual
 * se recalculan solos desde intentos/partidas apenas se restauran esas dos). */
const SETTINGS_KEYS = [
  'hoshi-daily-goal',
  'hoshi-sound-enabled',
  'hoshi-app-theme',
  'hoshi-theme',
  'hoshi-streak-enabled',
  'hoshi-language',
] as const

export type BackupSettings = Partial<Record<(typeof SETTINGS_KEYS)[number], string>>

export interface BackupFile {
  schemaVersion: number
  exportedAt: string
  partidas: SavedGameRecord[]
  intentos: AttemptRecord[]
  srs: SrsCardRecord[]
  settings: BackupSettings
}

function readSettings(): BackupSettings {
  const settings: BackupSettings = {}
  for (const key of SETTINGS_KEYS) {
    try {
      const value = window.localStorage.getItem(key)
      if (value !== null) settings[key] = value
    } catch {
      // sin acceso a localStorage (p.ej. modo privado), se omite esa clave
    }
  }
  return settings
}

function writeSettings(settings: BackupSettings): void {
  for (const key of SETTINGS_KEYS) {
    const value = settings[key]
    if (value === undefined) continue
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // sin acceso a localStorage, esa preferencia no se restaura
    }
  }
}

export async function exportBackup(): Promise<BackupFile> {
  const [partidas, intentos, srs] = await Promise.all([listGames(), listAttempts(), listSrsCards()])
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    partidas,
    intentos,
    srs,
    settings: readSettings(),
  }
}

export class InvalidBackupError extends Error {}

/** Valida la forma minima de un archivo de respaldo antes de tocar cualquier
 * dato existente. No usa un validador de esquema para no agregar una
 * dependencia nueva; el archivo lo genera la propia app, no llega de una
 * fuente no confiable, asi que una validacion estructural basica alcanza. */
export function parseBackup(raw: unknown): BackupFile {
  if (typeof raw !== 'object' || raw === null) {
    throw new InvalidBackupError('El archivo no contiene un objeto JSON valido.')
  }
  const data = raw as Record<string, unknown>
  if (data.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new InvalidBackupError('El archivo no es un respaldo de Hoshi reconocido, o es de una version incompatible.')
  }
  if (!Array.isArray(data.partidas) || !Array.isArray(data.intentos) || !Array.isArray(data.srs)) {
    throw new InvalidBackupError('El archivo no tiene la estructura esperada de un respaldo de Hoshi.')
  }
  return {
    schemaVersion: data.schemaVersion,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    partidas: data.partidas as SavedGameRecord[],
    intentos: data.intentos as AttemptRecord[],
    srs: data.srs as SrsCardRecord[],
    settings: typeof data.settings === 'object' && data.settings !== null ? (data.settings as BackupSettings) : {},
  }
}

/** Reemplaza todo el progreso guardado (partidas, intentos, tarjetas SRS) y
 * las preferencias respaldadas por el contenido de `backup`. Es una
 * restauracion, no una fusion: los datos actuales se pierden. Llamar solo
 * despues de que quien usa la app confirme explicitamente. */
export async function importBackup(backup: BackupFile): Promise<void> {
  await restoreAllStores({ partidas: backup.partidas, intentos: backup.intentos, srs: backup.srs })
  writeSettings(backup.settings)
}
