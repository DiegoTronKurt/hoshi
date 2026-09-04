import { neighbors } from './board'
import { EMPTY } from './types'
import type { BoardState, Color, Group } from './types'

/**
 * Buffer de "visitado" reutilizable entre llamadas, en vez de un Set nuevo
 * por cada getGroup: getGroup se llama decenas de veces por jugada simulada
 * del bot (ver tests/engine/_debug-mcts-perf.test.ts), y para los grupos
 * chicos tipicos de una partida al azar el costo fijo de crear y hashear un
 * Set pesaba mas que el recorrido en si. Solo se limpian al final los
 * indices realmente tocados (el tamaño del grupo), no el tablero entero, asi
 * que no se paga O(ancho*alto) por cada grupo chico. Seguro entre llamadas
 * porque getGroup es sincronico y no reentrante (JS de un solo hilo, cada
 * llamada termina antes de que empiece la siguiente) y cada Web Worker tiene
 * su propia copia del modulo, sin memoria compartida con la pestaña principal.
 */
let scratchVisited: Uint8Array | null = null
let scratchWidth = -1
let scratchHeight = -1

function getVisitedScratch(width: number, height: number): Uint8Array {
  if (!scratchVisited || scratchWidth !== width || scratchHeight !== height) {
    scratchVisited = new Uint8Array(width * height)
    scratchWidth = width
    scratchHeight = height
  }
  return scratchVisited
}

export function getGroup(board: BoardState, point: number): Group | null {
  const color = board.stones[point]
  if (color === EMPTY) return null

  const visited = getVisitedScratch(board.width, board.height)
  const liberties = new Set<number>()
  const stones: number[] = [point]
  visited[point] = 1
  const stack = [point]

  while (stack.length > 0) {
    const current = stack.pop() as number
    for (const n of neighbors(board.width, board.height, current)) {
      const value = board.stones[n]
      if (value === EMPTY) {
        liberties.add(n)
      } else if (value === color && !visited[n]) {
        visited[n] = 1
        stones.push(n)
        stack.push(n)
      }
    }
  }

  for (const s of stones) visited[s] = 0

  return { color: color as Color, stones, liberties }
}

export function countLiberties(board: BoardState, point: number): number {
  return getGroup(board, point)?.liberties.size ?? 0
}
