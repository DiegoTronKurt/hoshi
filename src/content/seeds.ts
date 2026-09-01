import { BOARD_TRANSFORMS, createBoard, toPoint, transformBoard, transformPoint } from '../core/board'
import { BLACK, WHITE } from '../core/types'
import type { BoardState, Color } from '../core/types'
import type { ConceptId } from '../analysis/concepts'
import { computeRegion } from '../solver/region'
import { solve } from '../solver/tsumego'
import type { Objective } from '../solver/tsumego'
import type { Problem } from './problemSgf'

function place(board: BoardState, color: Color, points: Array<[number, number]>): void {
  for (const [x, y] of points) {
    board.stones[toPoint(board.size, x, y)] = color
  }
}

/**
 * Posiciones semilla escritas a mano: formas clasicas de vida y muerte cuyo
 * estado es un hecho establecido de teoria de Go, no una opinion. Es la unica
 * excepcion a la regla de no escribir posiciones a mano, y por eso cada una
 * se re-verifica aqui mismo con el solucionador antes de aceptarse (ver
 * tests/solver/tsumego.test.ts para la derivacion completa razonada de cada
 * forma).
 */
export function buildEnclosedShape(size: number, wall: Array<[number, number]>, eyespace: Array<[number, number]>) {
  const board = createBoard(size)
  for (let p = 0; p < board.stones.length; p++) board.stones[p] = WHITE
  place(board, BLACK, wall)
  for (const [x, y] of eyespace) board.stones[toPoint(size, x, y)] = 0
  return { board, wallPoints: wall.map(([x, y]) => toPoint(size, x, y)) }
}

export const rectaDeTres = buildEnclosedShape(
  9,
  [
    [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
    [2, 4], [6, 4],
    [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
  ],
  [[3, 4], [4, 4], [5, 4]],
)

export const cuadradoDeCuatro = buildEnclosedShape(
  9,
  [
    [2, 3], [3, 3], [4, 3], [5, 3],
    [2, 4], [5, 4],
    [2, 5], [5, 5],
    [2, 6], [3, 6], [4, 6], [5, 6],
  ],
  [[3, 4], [4, 4], [3, 5], [4, 5]],
)

/**
 * Piramide de cuatro (T-tetromino: fila de 3 mas un punto pegado al del
 * medio). La Fase 3 la habia descartado de las semillas porque a mano
 * parecia "muerta sin mas" y en realidad resulto condicional: se verifico
 * con el solucionador (ver tests/solver/tsumego.test.ts) que, igual que la
 * recta de tres, vive si el dueno juega primero el punto vital (el punto
 * pegado, el que toca a los otros tres) y muere si lo juega el rival
 * primero. No es "muerta sin mas" como las tablas de formas suelen resumirla
 * quitando la variable de turno.
 */
export const piramideDeCuatro = buildEnclosedShape(
  9,
  [
    [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
    [2, 4], [6, 4],
    [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
    [2, 6], [3, 6], [4, 6], [5, 6], [6, 6],
  ],
  [[3, 4], [4, 4], [5, 4], [4, 5]],
)

/**
 * Dos ojos separados ya formados: vida incondicional. Misma posicion que
 * tests/solver/tsumego.test.ts verifica de forma independiente (construida
 * a mano ahi mismo); se exporta aca tambien para que las lecciones de la
 * Fase 6 la reutilicen sin duplicar la posicion, con su propia verificacion
 * en tests/content/lessons.test.ts.
 */
export const dosOjosSeparados = buildEnclosedShape(
  9,
  [
    [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
    [2, 4], [4, 4], [6, 4],
    [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
  ],
  [[3, 4], [5, 4]],
)

/**
 * Red (geta) verificada en la leccion n3-l4: blanco en (1,1) queda sin
 * escapatoria una vez que negro juega (0,0), sin necesidad de perseguirlo
 * como en una escalera. Reutilizada tal cual (mismo tablero, mismas
 * piedras) para el banco en vez de derivar una geometria nueva.
 */
function buildGetaSeed(): { board: BoardState; targetPoints: number[] } {
  const board = createBoard(5)
  board.stones[toPoint(5, 1, 2)] = BLACK
  board.stones[toPoint(5, 2, 1)] = BLACK
  board.stones[toPoint(5, 1, 1)] = WHITE
  return { board, targetPoints: [toPoint(5, 1, 1)] }
}

/**
 * Snapback verificado en la leccion n3-l5: negro sacrifica en (4,3), blanco
 * captura jugando (4,4) (unica forma de capturar esa piedra), y esa misma
 * jugada blanca deja al grupo {(3,3),(3,4),(4,4)} con una sola libertad:
 * el mismo punto (4,3) que negro recupera para recapturar las tres piedras
 * de una vez. El objetivo del problema apunta solo a (3,3)/(3,4), el nucleo
 * del grupo antes de que blanco se sume el mismo a la trampa.
 */
function buildSnapbackSeed(): { board: BoardState; targetPoints: number[] } {
  const board = createBoard(7)
  const black: Array<[number, number]> = [
    [2, 3], [3, 2], [2, 4], [3, 5], [5, 4], [4, 5],
  ]
  const white: Array<[number, number]> = [
    [3, 3], [3, 4], [5, 3], [4, 2],
  ]
  for (const [x, y] of black) board.stones[toPoint(7, x, y)] = BLACK
  for (const [x, y] of white) board.stones[toPoint(7, x, y)] = WHITE
  return { board, targetPoints: [toPoint(7, 3, 3), toPoint(7, 3, 4)] }
}

interface SeedSpec {
  conceptId: ConceptId
  board: BoardState
  targetPoints: number[]
  targetColor: Color
  toMove: Color
  objective: Objective
  /** Margen de la region alrededor de targetPoints. Chico a proposito en
   * todos los casos: el limite de MAX_REGION_EMPTY_POINTS de solve() existe
   * para que la busqueda exhaustiva siga siendo viable, y un margen que
   * cubra el tablero entero (probado y revertido) lo vuelve intratable. */
  regionMargin: number
  /** Profundidad maxima de busqueda. Las formas de ojo (fondo relleno de
   * blanco, region siempre chica) usan la profundidad estandar de 8. Geta y
   * snapback parten de un tablero mayormente vacio (sin relleno que acote
   * la busqueda), asi que una profundidad de 8 ahi explota
   * combinatoriamente (probado y revertido: minutos, no segundos, para una
   * secuencia que en la practica dura 1 a 3 jugadas). 4-5 alcanza de sobra
   * para confirmar la misma secuencia ya verificada en la leccion de Fase 6
   * y sigue siendo una demostracion real del solucionador, no un atajo. */
  maxDepth: number
}

const getaSeed = buildGetaSeed()
const snapbackSeed = buildSnapbackSeed()

const SEED_SPECS: SeedSpec[] = [
  // Vive: jugar el punto vital separa el espacio en dos ojos reales.
  { conceptId: 'DOS_OJOS', board: rectaDeTres.board, targetPoints: rectaDeTres.wallPoints, targetColor: BLACK, toMove: BLACK, objective: 'live', regionMargin: 1, maxDepth: 8 },
  { conceptId: 'DOS_OJOS', board: piramideDeCuatro.board, targetPoints: piramideDeCuatro.wallPoints, targetColor: BLACK, toMove: BLACK, objective: 'live', regionMargin: 1, maxDepth: 8 },
  // Mata: el atacante juega adentro del espacio para reducirlo a un ojo, nakade.
  { conceptId: 'NAKADE', board: rectaDeTres.board, targetPoints: rectaDeTres.wallPoints, targetColor: BLACK, toMove: WHITE, objective: 'kill', regionMargin: 1, maxDepth: 8 },
  { conceptId: 'NAKADE', board: cuadradoDeCuatro.board, targetPoints: cuadradoDeCuatro.wallPoints, targetColor: BLACK, toMove: WHITE, objective: 'kill', regionMargin: 1, maxDepth: 8 },
  { conceptId: 'NAKADE', board: piramideDeCuatro.board, targetPoints: piramideDeCuatro.wallPoints, targetColor: BLACK, toMove: WHITE, objective: 'kill', regionMargin: 1, maxDepth: 8 },
  // Red y snapback: posiciones ya verificadas en las lecciones de Fase 6.
  { conceptId: 'RED_GETA', board: getaSeed.board, targetPoints: getaSeed.targetPoints, targetColor: WHITE, toMove: BLACK, objective: 'kill', regionMargin: 2, maxDepth: 4 },
  { conceptId: 'SNAPBACK', board: snapbackSeed.board, targetPoints: snapbackSeed.targetPoints, targetColor: WHITE, toMove: BLACK, objective: 'kill', regionMargin: 2, maxDepth: 5 },
]

/**
 * Cada plantilla verificada se multiplica por las 8 transformaciones
 * diedrales (identidad, 3 rotaciones, 4 espejos) para dar variedad real al
 * banco sin derivar geometria nueva a mano por cada problema. La
 * transformacion no cambia la legalidad de Go, pero cada variante igual se
 * vuelve a verificar con el solucionador antes de aceptarse — nunca se
 * asume que una transformacion geometrica preserva un resultado de vida o
 * muerte sin confirmarlo de nuevo.
 */
export function buildSeedProblems(): Problem[] {
  const problems: Problem[] = []
  const seen = new Set<string>()

  for (const spec of SEED_SPECS) {
    for (const transform of BOARD_TRANSFORMS) {
      const board = transformBoard(spec.board, transform)
      const targetPoints = spec.targetPoints.map((p) => transformPoint(spec.board.size, p, transform))

      const key = `${spec.conceptId}:${board.stones.join('')}`
      if (seen.has(key)) continue
      seen.add(key)

      const region = computeRegion(board, targetPoints, spec.regionMargin)
      const result = solve({
        board,
        region,
        targetPoints,
        targetColor: spec.targetColor,
        toMove: spec.toMove,
        objective: spec.objective,
        maxDepth: spec.maxDepth,
      })

      if (!result.solved) continue // nunca se acepta una variante sin que el solucionador la reconfirme

      problems.push({
        conceptId: spec.conceptId,
        board,
        targetPoints,
        targetColor: spec.targetColor,
        toMove: spec.toMove,
        objective: spec.objective,
        tree: result.root,
      })
    }
  }

  return problems
}
