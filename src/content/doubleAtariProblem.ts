import { formatSize, parseSgf, parseSize, pointToSgf, sgfToPoint, writeSgf } from '../core/sgf'
import { createBoard } from '../core/board'
import { BLACK, WHITE } from '../core/types'
import type { BoardState, Color } from '../core/types'

/**
 * Un doble atari es reconocimiento de una sola jugada (ver
 * solver/doubleAtari.ts), no encaja en Problem/RefutationNode. Puede haber
 * mas de un punto valido en una misma posicion; se guardan todos para que
 * el ejercicio acepte cualquiera, mismo principio que sigue el arbol de
 * refutacion de Problem para las jugadas del defensor.
 */
export interface DoubleAtariProblem {
  conceptId: 'DOBLE_ATARI'
  board: BoardState
  color: Color
  expectedPoints: number[]
}

export function doubleAtariProblemToSgf(problem: DoubleAtariProblem): string {
  const { board, color, expectedPoints } = problem
  const ab: string[] = []
  const aw: string[] = []
  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] === BLACK) ab.push(pointToSgf(board.width, p))
    else if (board.stones[p] === WHITE) aw.push(pointToSgf(board.width, p))
  }
  const properties: Record<string, string[]> = {
    GM: ['1'],
    FF: ['4'],
    SZ: [formatSize(board.width, board.height)],
    ZKIND: ['doubleAtari'],
    ZCOLOR: [color === BLACK ? 'B' : 'W'],
    ZEXPECTED: expectedPoints.map((p) => pointToSgf(board.width, p)),
  }
  if (ab.length > 0) properties.AB = ab
  if (aw.length > 0) properties.AW = aw

  return writeSgf({ root: { properties, children: [] } })
}

export function sgfToDoubleAtariProblem(text: string): DoubleAtariProblem {
  const { root } = parseSgf(text)
  const { width, height } = parseSize(root.properties.SZ?.[0] ?? '9')
  const board = createBoard(width, height)

  for (const coord of root.properties.AB ?? []) {
    const point = sgfToPoint(width, coord)
    if (point !== null) board.stones[point] = BLACK
  }
  for (const coord of root.properties.AW ?? []) {
    const point = sgfToPoint(width, coord)
    if (point !== null) board.stones[point] = WHITE
  }

  const color: Color = root.properties.ZCOLOR?.[0] === 'B' ? BLACK : WHITE
  const expectedPoints = (root.properties.ZEXPECTED ?? [])
    .map((coord) => sgfToPoint(width, coord))
    .filter((p): p is number => p !== null)

  return { conceptId: 'DOBLE_ATARI', board, color, expectedPoints }
}
