import type { Card } from 'ts-fsrs'
import type { ConceptId } from '../analysis/concepts'
import type { Color } from '../core/types'

const DB_NAME = 'hoshi'
const DB_VERSION = 2
const STORE_GAMES = 'partidas'
const STORE_ATTEMPTS = 'intentos'
const STORE_SRS = 'srs'

export interface SavedGameRecord {
  id?: number
  createdAt: string
  size: number
  komi: number
  mode: 'local' | 'bot'
  botPlayouts?: number
  /** Nivel de fuerza usado para esta partida contra el bot (id de
   * StrengthLevel en ui/play/strengthLevels.ts). Guardado como string suelto
   * en vez de importar ese tipo aca para no hacer que storage/ dependa de
   * ui/: quien interpreta este campo (learning/adaptiveDifficulty.ts) es
   * quien conoce el tipo real. Ausente en partidas guardadas antes de que
   * existiera la dificultad adaptativa. */
  botStrengthId?: string
  /** Color con el que jugo la persona en una partida contra el bot. Ausente
   * en partidas guardadas antes de este campo o en partidas locales
   * (mode: 'local', donde no aplica un solo "color humano"). */
  humanColor?: Color
  result: { black: number; white: number; winner: 'black' | 'white' }
  sgf: string
}

/** Un intento de ejercicio. Registra hechos crudos, no una calificacion FSRS:
 * quien decide como traducir esto a una nota (Otra vez/Dificil/Bien/Facil)
 * es la capa de aprendizaje, no el almacenamiento. */
export interface AttemptRecord {
  id?: number
  problemId: string
  conceptId: ConceptId
  createdAt: string
  /** true si se resolvio el ejercicio, false si se abandono sin resolverlo. */
  solved: boolean
  /** Jugadas incorrectas antes de resolverlo (0 si se acerto a la primera). */
  wrongAttempts: number
  /** Tiempo hasta la primera resolucion o abandono del problema. Ausente en intentos previos a esta version. */
  responseTimeMs?: number
}

/** Una tarjeta FSRS por problema, identificada por problemId (no autoincrement:
 * revisar un problema de nuevo actualiza la misma fila, no agrega una nueva). */
export interface SrsCardRecord {
  problemId: string
  conceptId: ConceptId
  card: Card
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_GAMES)) {
        db.createObjectStore(STORE_GAMES, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(STORE_ATTEMPTS)) {
        db.createObjectStore(STORE_ATTEMPTS, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(STORE_SRS)) {
        db.createObjectStore(STORE_SRS, { keyPath: 'problemId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveGame(record: Omit<SavedGameRecord, 'id'>): Promise<number> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GAMES, 'readwrite')
    const request = tx.objectStore(STORE_GAMES).add(record)
    request.onsuccess = () => resolve(request.result as number)
    request.onerror = () => reject(request.error)
  })
}

export async function listGames(): Promise<SavedGameRecord[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GAMES, 'readonly')
    const request = tx.objectStore(STORE_GAMES).getAll()
    request.onsuccess = () => resolve(request.result as SavedGameRecord[])
    request.onerror = () => reject(request.error)
  })
}

export async function recordAttempt(record: Omit<AttemptRecord, 'id'>): Promise<number> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ATTEMPTS, 'readwrite')
    const request = tx.objectStore(STORE_ATTEMPTS).add(record)
    request.onsuccess = () => resolve(request.result as number)
    request.onerror = () => reject(request.error)
  })
}

export async function listAttempts(): Promise<AttemptRecord[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ATTEMPTS, 'readonly')
    const request = tx.objectStore(STORE_ATTEMPTS).getAll()
    request.onsuccess = () => resolve(request.result as AttemptRecord[])
    request.onerror = () => reject(request.error)
  })
}

export async function saveSrsCard(record: SrsCardRecord): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SRS, 'readwrite')
    const request = tx.objectStore(STORE_SRS).put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getSrsCard(problemId: string): Promise<SrsCardRecord | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SRS, 'readonly')
    const request = tx.objectStore(STORE_SRS).get(problemId)
    request.onsuccess = () => resolve(request.result as SrsCardRecord | undefined)
    request.onerror = () => reject(request.error)
  })
}

export async function listSrsCards(): Promise<SrsCardRecord[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SRS, 'readonly')
    const request = tx.objectStore(STORE_SRS).getAll()
    request.onsuccess = () => resolve(request.result as SrsCardRecord[])
    request.onerror = () => reject(request.error)
  })
}

/** Datos crudos de las tres stores, usados por el respaldo (src/storage/backup.ts).
 * Los ids de partidas/intentos no se preservan al restaurar (se reasignan por
 * autoincrement): nada en la app depende de que sean estables entre sesiones. */
export interface AllStoresData {
  partidas: SavedGameRecord[]
  intentos: AttemptRecord[]
  srs: SrsCardRecord[]
}

/** Vacia y repuebla las tres stores en una sola transaccion (todo o nada):
 * si algo falla a mitad de camino, IndexedDB revierte la transaccion completa
 * en vez de dejar la base a medio restaurar. */
export async function restoreAllStores(data: AllStoresData): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_GAMES, STORE_ATTEMPTS, STORE_SRS], 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)

    const games = tx.objectStore(STORE_GAMES)
    const attempts = tx.objectStore(STORE_ATTEMPTS)
    const srs = tx.objectStore(STORE_SRS)

    games.clear()
    attempts.clear()
    srs.clear()

    for (const record of data.partidas) {
      const { id: _id, ...rest } = record
      games.add(rest)
    }
    for (const record of data.intentos) {
      const { id: _id, ...rest } = record
      attempts.add(rest)
    }
    for (const record of data.srs) {
      srs.put(record)
    }
  })
}
