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
  conceptId:
    | 'RELLENO_TERRITORIO_PROPIO'
    | 'PASE_PREMATURO'
    | 'EL_FINAL_TAMBIEN_ES_GRANDE'
    | 'COMPARAR_VALOR_REAL'
    // JUICIO_LOCAL_VS_GLOBAL (Nivel 7): mismo formato, misma validacion --
    // ver tools/generate-whole-board-judgment-problems.ts. La unica
    // diferencia con COMPARAR_VALOR_REAL es como se generan las posiciones
    // (candidatos en al menos dos zonas separadas del tablero, no solo dos
    // puntos), no como se validan.
    | 'JUICIO_LOCAL_VS_GLOBAL'
    // SENTE_ANTES_QUE_GOTE (Nivel 9): mismo `board`/`toMove`, pero la
    // validacion NO es areaDeltaForPoint/isBestAreaMove -- ver el branch
    // dedicado en useSolvableExercise.ts. La posicion trae un candidato
    // sente y uno gote (solver/areaValue.ts::classifySenteGote); la jugada
    // correcta es la sente, sin importar si su delta de area inmediato es
    // chico (una jugada de atari real vale poco en area HASTA que la
    // captura pasa -- exigirle el mismo umbral que el resto de esta union
    // rechazaria la respuesta correcta).
    | 'SENTE_ANTES_QUE_GOTE'
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
