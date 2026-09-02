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
 * Misma red que buildGetaSeed (misma forma relativa a la esquina: blanco a
 * un paso de diagonal, negro cerrandole las dos libertades ortogonales), pero
 * en un tablero 9x9 en vez de 5x5 -- da una posicion realmente distinta (no
 * alcanzable con las transformaciones diedrales de la semilla original, que
 * solo rota/refleja el mismo tablero de 5x5) sin inventar una tactica nueva
 * que verificar desde cero.
 */
function buildGetaSeed2(): { board: BoardState; targetPoints: number[] } {
  const board = createBoard(9)
  board.stones[toPoint(9, 1, 2)] = BLACK
  board.stones[toPoint(9, 2, 1)] = BLACK
  board.stones[toPoint(9, 1, 1)] = WHITE
  return { board, targetPoints: [toPoint(9, 1, 1)] }
}

/**
 * Ojo falso de esquina: el punto (0,0) parece un ojo (sus dos vecinos
 * ortogonales, unico requisito posible en una esquina, son negros), pero la
 * diagonal (1,1) es blanca. Esa piedra blanca no esta ahi de adorno: al ser
 * vecina ortogonal directa de AMBAS piedras del "anillo" (A y B), les quita
 * a cada una la libertad que tendrian hacia ese lado, dejandolas con una
 * sola libertad real (la esquina misma, compartida). Por eso blanco puede
 * jugar directo en la esquina y capturar las dos de una: el "ojo" nunca fue
 * un punto seguro, era la unica libertad de dos piedras ya debilitadas por
 * la diagonal.
 *
 * A proposito NO se construye con la tecnica de `buildEnclosedShape` (llenar
 * todo el tablero de blanco): bajo ese relleno total, las piedras del
 * anillo ya tienen cero libertades "hacia afuera" desde el principio (todo
 * alrededor es blanco, este u otro punto), asi que ninguna diagonal puede
 * quitarles una libertad que nunca tuvieron: recolorear una diagonal ahi no
 * cambia nada (confirmado con el solucionador, ver NOTAS.md). El mecanismo
 * real de un ojo falso solo existe en una construccion dispersa como esta,
 * donde la diagonal SI le quita una libertad real a una piedra que de otro
 * modo la tendria.
 */
function buildOjoFalsoSeed(): { board: BoardState; targetPoints: number[] } {
  const size = 9
  const board = createBoard(size)
  board.stones[toPoint(size, 1, 0)] = BLACK // A, anillo del ojo (0,0)
  board.stones[toPoint(size, 0, 1)] = BLACK // B, anillo del ojo (0,0)
  board.stones[toPoint(size, 1, 1)] = WHITE // diagonal de la esquina: hace falso el ojo
  board.stones[toPoint(size, 2, 0)] = WHITE // sella la otra libertad de A
  board.stones[toPoint(size, 0, 2)] = WHITE // sella la otra libertad de B
  return { board, targetPoints: [toPoint(size, 1, 0), toPoint(size, 0, 1)] }
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

/**
 * Misma trampa de snapback que buildSnapbackSeed (mismas piedras, mismas
 * coordenadas), pero en un tablero 9x9: la region que recorta solve()
 * alrededor del objetivo (margen 2) no llega a tocar ningun borde en
 * ninguno de los dos tableros, asi que es literalmente la misma lectura,
 * solo con mas tablero vacio alrededor -- una posicion nueva de verdad para
 * el banco, no una transformacion diedral de la misma.
 */
function buildSnapbackSeed2(): { board: BoardState; targetPoints: number[] } {
  const board = createBoard(9)
  const black: Array<[number, number]> = [
    [2, 3], [3, 2], [2, 4], [3, 5], [5, 4], [4, 5],
  ]
  const white: Array<[number, number]> = [
    [3, 3], [3, 4], [5, 3], [4, 2],
  ]
  for (const [x, y] of black) board.stones[toPoint(9, x, y)] = BLACK
  for (const [x, y] of white) board.stones[toPoint(9, x, y)] = WHITE
  return { board, targetPoints: [toPoint(9, 3, 3), toPoint(9, 3, 4)] }
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
const getaSeed2 = buildGetaSeed2()
const snapbackSeed = buildSnapbackSeed()
const snapbackSeed2 = buildSnapbackSeed2()
const ojoFalsoSeed = buildOjoFalsoSeed()

const SEED_SPECS: SeedSpec[] = [
  // Vive: jugar el punto vital separa el espacio en dos ojos reales.
  { conceptId: 'DOS_OJOS', board: rectaDeTres.board, targetPoints: rectaDeTres.wallPoints, targetColor: BLACK, toMove: BLACK, objective: 'live', regionMargin: 1, maxDepth: 8 },
  { conceptId: 'DOS_OJOS', board: piramideDeCuatro.board, targetPoints: piramideDeCuatro.wallPoints, targetColor: BLACK, toMove: BLACK, objective: 'live', regionMargin: 1, maxDepth: 8 },
  // Mata: el atacante juega adentro del espacio para reducirlo a un ojo, nakade.
  { conceptId: 'NAKADE', board: rectaDeTres.board, targetPoints: rectaDeTres.wallPoints, targetColor: BLACK, toMove: WHITE, objective: 'kill', regionMargin: 1, maxDepth: 8 },
  { conceptId: 'NAKADE', board: cuadradoDeCuatro.board, targetPoints: cuadradoDeCuatro.wallPoints, targetColor: BLACK, toMove: WHITE, objective: 'kill', regionMargin: 1, maxDepth: 8 },
  { conceptId: 'NAKADE', board: piramideDeCuatro.board, targetPoints: piramideDeCuatro.wallPoints, targetColor: BLACK, toMove: WHITE, objective: 'kill', regionMargin: 1, maxDepth: 8 },
  // Red y snapback: posiciones ya verificadas en las lecciones de Fase 6, mas
  // la misma lectura otra vez sobre un tablero 9x9 (buildGetaSeed2/
  // buildSnapbackSeed2): la region que recorta solve() no llega a tocar el
  // borde extra en ninguno de los dos casos, asi que es la misma tactica,
  // solo en una posicion de tablero nueva de verdad.
  { conceptId: 'RED_GETA', board: getaSeed.board, targetPoints: getaSeed.targetPoints, targetColor: WHITE, toMove: BLACK, objective: 'kill', regionMargin: 2, maxDepth: 4 },
  { conceptId: 'RED_GETA', board: getaSeed2.board, targetPoints: getaSeed2.targetPoints, targetColor: WHITE, toMove: BLACK, objective: 'kill', regionMargin: 2, maxDepth: 4 },
  { conceptId: 'SNAPBACK', board: snapbackSeed.board, targetPoints: snapbackSeed.targetPoints, targetColor: WHITE, toMove: BLACK, objective: 'kill', regionMargin: 2, maxDepth: 5 },
  { conceptId: 'SNAPBACK', board: snapbackSeed2.board, targetPoints: snapbackSeed2.targetPoints, targetColor: WHITE, toMove: BLACK, objective: 'kill', regionMargin: 2, maxDepth: 5 },
  // Ojo falso de esquina: blanco captura las dos piedras del "anillo" jugando
  // directo en la esquina, porque la diagonal ya les habia quitado su otra
  // libertad a cada una (ver comentario de buildOjoFalsoSeed).
  { conceptId: 'OJO_FALSO', board: ojoFalsoSeed.board, targetPoints: ojoFalsoSeed.targetPoints, targetColor: BLACK, toMove: WHITE, objective: 'kill', regionMargin: 1, maxDepth: 8 },
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
