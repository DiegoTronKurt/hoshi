import { formatSize, parseSgf, parseSize, pointToSgf, sgfToPoint, writeSgf } from '../core/sgf'
import { createBoard } from '../core/board'
import { BLACK, WHITE } from '../core/types'
import type { BoardState, Color } from '../core/types'

/**
 * Una escalera corre por todo el tablero por diseno, asi que no encaja en
 * el formato Problem/RefutationNode (region acotada, arbol de vida-muerte)
 * que usa solve(). Se verifica con solveLadder (solver/ladder.ts) en vez de
 * solve(), y el ejercicio interactivo la vuelve a llamar de forma sincrona
 * en el hilo principal despues de cada jugada del estudiante — es barata
 * (lectura lineal, no busqueda exponencial), no necesita el Worker.
 */
export interface LadderProblem {
  conceptId: 'ESCALERA'
  board: BoardState
  /** Un punto cualquiera del grupo que huye. */
  runnerPoint: number
  /** El color que persigue. Juega primero (mismo orden que solveLadder). */
  chaserColor: Color
}

export function ladderProblemToSgf(problem: LadderProblem): string {
  const { board, runnerPoint, chaserColor } = problem
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
    ZKIND: ['ladder'],
    ZRUNNER: [pointToSgf(board.width, runnerPoint)],
    ZCHASER: [chaserColor === BLACK ? 'B' : 'W'],
  }
  if (ab.length > 0) properties.AB = ab
  if (aw.length > 0) properties.AW = aw

  return writeSgf({ root: { properties, children: [] } })
}

export function sgfToLadderProblem(text: string): LadderProblem {
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

  const runnerCoord = root.properties.ZRUNNER?.[0] ?? ''
  const runnerPoint = sgfToPoint(width, runnerCoord) ?? 0
  const chaserColor: Color = root.properties.ZCHASER?.[0] === 'B' ? BLACK : WHITE

  return { conceptId: 'ESCALERA', board, runnerPoint, chaserColor }
}
