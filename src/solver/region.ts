import { toPoint, toXY } from '../core/board'
import { EMPTY } from '../core/types'
import type { BoardState } from '../core/types'

/**
 * Rectangulo que contiene al grupo objetivo mas un margen de puntos alrededor,
 * recortado a los bordes del tablero.
 */
export function computeRegion(board: BoardState, targetPoints: number[], margin = 2): number[] {
  const { width, height } = board
  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1

  for (const p of targetPoints) {
    const [x, y] = toXY(width, p)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }

  minX = Math.max(0, minX - margin)
  maxX = Math.min(width - 1, maxX + margin)
  minY = Math.max(0, minY - margin)
  maxY = Math.min(height - 1, maxY + margin)

  const region: number[] = []
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      region.push(toPoint(width, x, y))
    }
  }
  return region
}

export function countEmptyPoints(board: BoardState, region: number[]): number {
  let count = 0
  for (const p of region) {
    if (board.stones[p] === EMPTY) count++
  }
  return count
}
