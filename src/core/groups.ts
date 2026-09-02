import { neighbors } from './board'
import { EMPTY } from './types'
import type { BoardState, Color, Group } from './types'

export function getGroup(board: BoardState, point: number): Group | null {
  const color = board.stones[point]
  if (color === EMPTY) return null

  const visited = new Set<number>([point])
  const liberties = new Set<number>()
  const stack = [point]

  while (stack.length > 0) {
    const current = stack.pop() as number
    for (const n of neighbors(board.width, board.height, current)) {
      const value = board.stones[n]
      if (value === EMPTY) {
        liberties.add(n)
      } else if (value === color && !visited.has(n)) {
        visited.add(n)
        stack.push(n)
      }
    }
  }

  return { color: color as Color, stones: Array.from(visited), liberties }
}

export function countLiberties(board: BoardState, point: number): number {
  return getGroup(board, point)?.liberties.size ?? 0
}
