import { formatSize, parseSgf, parseSize, pointToSgf, sgfToPoint, writeSgf } from '../core/sgf'
import { createBoard } from '../core/board'
import { BLACK, WHITE } from '../core/types'
import type { BoardState, Color } from '../core/types'

/**
 * RELLENO_TERRITORIO_PROPIO y PASE_PREMATURO son la misma pregunta vista
 * desde los dos lados: "¿cual es la mejor jugada aca: un punto concreto, o
 * pasar?". Ninguno de los dos encaja en Problem/solve() (no son vida-muerte
 * de un grupo chico, son una comparacion de area de todo el tablero), asi
 * que no guardan una "respuesta correcta" fija -- se valida en vivo con
 * solver/areaValue.ts (bestAreaMove/isOwnTerritory), exactamente como hacen
 * ESCALERA (solveLadder) y DOBLE_ATARI (isDoubleAtariMove) con sus propios
 * verificadores en vez de un arbol guardado. El conceptId solo indica cual
 * de las dos respuestas incorrectas es la trampa de esta posicion concreta
 * (jugar dentro del propio territorio ya asegurado, o pasar habiendo una
 * jugada real): la validacion en si es identica para ambos.
 */
export interface AreaValueProblem {
  conceptId: 'RELLENO_TERRITORIO_PROPIO' | 'PASE_PREMATURO' | 'EL_FINAL_TAMBIEN_ES_GRANDE' | 'COMPARAR_VALOR_REAL'
  board: BoardState
  toMove: Color
}

export function areaValueProblemToSgf(problem: AreaValueProblem): string {
  const { board, toMove, conceptId } = problem
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
    ZKIND: ['areaValue'],
    ZCONCEPT: [conceptId],
    PL: [toMove === BLACK ? 'B' : 'W'],
  }
  if (ab.length > 0) properties.AB = ab
  if (aw.length > 0) properties.AW = aw

  return writeSgf({ root: { properties, children: [] } })
}

export function sgfToAreaValueProblem(text: string): AreaValueProblem {
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

  const conceptId = (root.properties.ZCONCEPT?.[0] ?? 'PASE_PREMATURO') as AreaValueProblem['conceptId']
  const toMove: Color = root.properties.PL?.[0] === 'B' ? BLACK : WHITE

  return { conceptId, board, toMove }
}
