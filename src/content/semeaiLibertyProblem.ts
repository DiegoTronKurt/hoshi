import { formatSize, parseSgf, parseSize, pointToSgf, sgfToPoint, writeSgf } from '../core/sgf'
import { createBoard } from '../core/board'
import { BLACK, WHITE } from '../core/types'
import type { BoardState, Color } from '../core/types'

/**
 * CONTAR_LIBERTADES_ANTES_DE_JUGAR y LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO:
 * un clic de reconocimiento (cual grupo va perdiendo la carrera / cual punto
 * es libertad compartida), no una jugada -- no encaja en Problem/solve() ni
 * en ningun otro formato existente. No guarda una respuesta precalculada:
 * se valida en vivo con solver/semeai.ts (raceBehindColor/sharedLibertiesOf)
 * sobre el tablero real, exactamente con las mismas funciones que usa
 * tools/generate-semeai-liberty-problems.ts para clasificar cada posicion
 * antes de aceptarla.
 */
export interface SemeaiLibertyProblem {
  conceptId: 'CONTAR_LIBERTADES_ANTES_DE_JUGAR' | 'LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO'
  board: BoardState
  toMove: Color
  /** Un punto cualquiera de cada uno de los dos grupos en carrera. */
  groupAPoint: number
  groupBPoint: number
}

export function semeaiLibertyProblemToSgf(problem: SemeaiLibertyProblem): string {
  const { board, toMove, conceptId, groupAPoint, groupBPoint } = problem
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
    ZKIND: ['semeaiLiberty'],
    ZCONCEPT: [conceptId],
    ZGROUPA: [pointToSgf(board.width, groupAPoint)],
    ZGROUPB: [pointToSgf(board.width, groupBPoint)],
    PL: [toMove === BLACK ? 'B' : 'W'],
  }
  if (ab.length > 0) properties.AB = ab
  if (aw.length > 0) properties.AW = aw

  return writeSgf({ root: { properties, children: [] } })
}

export function sgfToSemeaiLibertyProblem(text: string): SemeaiLibertyProblem {
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

  const conceptId = (root.properties.ZCONCEPT?.[0] ?? 'CONTAR_LIBERTADES_ANTES_DE_JUGAR') as SemeaiLibertyProblem['conceptId']
  const toMove: Color = root.properties.PL?.[0] === 'B' ? BLACK : WHITE
  const groupAPoint = sgfToPoint(width, root.properties.ZGROUPA?.[0] ?? '') ?? 0
  const groupBPoint = sgfToPoint(width, root.properties.ZGROUPB?.[0] ?? '') ?? 0

  return { conceptId, board, toMove, groupAPoint, groupBPoint }
}
