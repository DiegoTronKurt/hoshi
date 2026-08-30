const DB_NAME = 'hoshi'
const DB_VERSION = 1
const STORE_GAMES = 'partidas'

export interface SavedGameRecord {
  id?: number
  createdAt: string
  size: number
  komi: number
  mode: 'local' | 'bot'
  botPlayouts?: number
  result: { black: number; white: number; winner: 'black' | 'white' }
  sgf: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_GAMES)) {
        db.createObjectStore(STORE_GAMES, { keyPath: 'id', autoIncrement: true })
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
