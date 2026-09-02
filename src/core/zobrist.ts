import { BLACK, EMPTY } from './types'
import type { BoardState, Color } from './types'

export interface ZobristTable {
  width: number
  height: number
  black: bigint[]
  white: bigint[]
}

// Generador determinista (mulberry32) para que la tabla sea reproducible
// entre ejecuciones y no dependa de Math.random.
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomBigint64(random: () => number): bigint {
  const hi = BigInt(Math.floor(random() * 0x100000000))
  const lo = BigInt(Math.floor(random() * 0x100000000))
  return (hi << 32n) | lo
}

const ZOBRIST_SEED = 0x9e3779b9
const tableCache = new Map<string, ZobristTable>()

export function getZobristTable(width: number, height: number = width): ZobristTable {
  const key = `${width}x${height}`
  let table = tableCache.get(key)
  if (!table) {
    const random = mulberry32(ZOBRIST_SEED + width * 31 + height)
    const black: bigint[] = []
    const white: bigint[] = []
    for (let p = 0; p < width * height; p++) {
      black.push(randomBigint64(random))
      white.push(randomBigint64(random))
    }
    table = { width, height, black, white }
    tableCache.set(key, table)
  }
  return table
}

export function hashBoard(table: ZobristTable, board: BoardState): bigint {
  let hash = 0n
  for (let p = 0; p < board.stones.length; p++) {
    const value = board.stones[p]
    if (value === BLACK) hash ^= table.black[p]
    else if (value !== EMPTY) hash ^= table.white[p]
  }
  return hash
}

export function toggleStone(table: ZobristTable, hash: bigint, point: number, color: Color): bigint {
  return hash ^ (color === BLACK ? table.black[point] : table.white[point])
}
