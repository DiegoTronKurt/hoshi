import { createBoard, toPoint } from '../core/board'
import { BLACK, WHITE } from '../core/types'
import type { BoardState, Color } from '../core/types'
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

interface SeedSpec {
  board: BoardState
  wallPoints: number[]
  toMove: Color
  objective: Objective
}

const SEED_SPECS: SeedSpec[] = [
  { board: rectaDeTres.board, wallPoints: rectaDeTres.wallPoints, toMove: BLACK, objective: 'live' },
  { board: rectaDeTres.board, wallPoints: rectaDeTres.wallPoints, toMove: WHITE, objective: 'kill' },
  { board: cuadradoDeCuatro.board, wallPoints: cuadradoDeCuatro.wallPoints, toMove: WHITE, objective: 'kill' },
  // piramideDeCuatro no se agrega aca a proposito: el banco de problemas
  // generado (src/content/problems/bank.json) es un pendiente conocido y
  // fuera de alcance de esta fase (ver NOTAS.md). La forma queda exportada
  // y verificada con test propio para que las lecciones de la Fase 6 la
  // usen directo como diagrama, sin pasar por el generador.
]

export function buildSeedProblems(): Problem[] {
  const problems: Problem[] = []

  for (const spec of SEED_SPECS) {
    const region = computeRegion(spec.board, spec.wallPoints, 1)
    const result = solve({
      board: spec.board,
      region,
      targetPoints: spec.wallPoints,
      targetColor: BLACK,
      toMove: spec.toMove,
      objective: spec.objective,
      maxDepth: 6,
    })

    if (!result.solved) continue // por diseno no deberia pasar para estas formas, pero nunca se acepta sin verificar

    problems.push({
      conceptId: 'DOS_OJOS',
      board: spec.board,
      targetPoints: spec.wallPoints,
      targetColor: BLACK,
      toMove: spec.toMove,
      objective: spec.objective,
      tree: result.root,
    })
  }

  return problems
}
