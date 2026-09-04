import { getGroup } from '../../core/groups'
import { toPoint } from '../../core/board'
import { computeAreaScore } from '../../core/scoring'
import { BLACK, WHITE } from '../../core/types'
import { board, point } from './helpers'
import type { Lesson } from './types'

const WIDTH = 9
const HEIGHT = 13

/**
 * Cuatro piedras amontonadas ("dango") vs las mismas cuatro piedras
 * repartidas en una cadena de saltos de caballo (keima), sin tocarse entre
 * si. La afirmacion de la leccion (la forma repartida respira el doble) se
 * calcula aca con `getGroup` sobre el tablero real, no se escribe a mano:
 * verificado con un script de depuracion antes de aceptar el numero (dango
 * = 8 libertades, cadena = 16 -- ver NOTAS.md).
 */
const DANGO_STONES: Array<[number, number]> = [[3, 5], [4, 5], [3, 6], [4, 6]]
const DANGO_BOARD = board(WIDTH, DANGO_STONES, [], HEIGHT)
const dangoLibs = getGroup({ width: WIDTH, height: HEIGHT, stones: DANGO_BOARD }, toPoint(WIDTH, 3, 5))?.liberties.size ?? 0

const SPREAD_STONES: Array<[number, number]> = [[1, 1], [3, 2], [5, 3], [7, 4]]
const SPREAD_BOARD = board(WIDTH, SPREAD_STONES, [], HEIGHT)
const spreadLibs = new Set<number>()
for (const [x, y] of SPREAD_STONES) {
  const group = getGroup({ width: WIDTH, height: HEIGHT, stones: SPREAD_BOARD }, toPoint(WIDTH, x, y))
  if (group) for (const l of group.liberties) spreadLibs.add(l)
}

/**
 * Esquina ya cerrada por negro (12 puntos) contra un bolsillo mas chico que
 * todavia tiene un solo punto sin cerrar. La afirmacion de la leccion
 * (cerrar el bolsillo chico vale mas que reforzar la esquina grande) se
 * calcula aca con `computeAreaScore` sobre el tablero real, comparando el
 * puntaje antes y despues de cada jugada candidata -- no se escribe a mano.
 * Ver NOTAS.md: reemplaza el intento anterior de verificar esto con
 * partidas simuladas (que no dio una señal reproducible en el sentido
 * correcto) por una comparacion exacta de conteo de area.
 */
const DIRECTION_WALL: Array<[number, number]> = [
  [3, 0], [3, 1], [3, 2], [3, 3], [0, 4], [1, 4], [2, 4],
  [4, 6], [4, 7], [5, 5], [6, 5], [5, 8], [6, 8], [7, 7],
]
const DIRECTION_WHITE: Array<[number, number]> = [[8, 6]]
const SECURED_MOVE: [number, number] = [1, 2]
const CONTESTED_MOVE: [number, number] = [7, 6]

const DIRECTION_BOARD = board(WIDTH, DIRECTION_WALL, DIRECTION_WHITE, HEIGHT)
const SECURED_BOARD = board(WIDTH, [...DIRECTION_WALL, SECURED_MOVE], DIRECTION_WHITE, HEIGHT)
const CONTESTED_BOARD = board(WIDTH, [...DIRECTION_WALL, CONTESTED_MOVE], DIRECTION_WHITE, HEIGHT)

const directionBeforeScore = computeAreaScore({ width: WIDTH, height: HEIGHT, stones: DIRECTION_BOARD }, 0)
const securedDelta = computeAreaScore({ width: WIDTH, height: HEIGHT, stones: SECURED_BOARD }, 0).black - directionBeforeScore.black
const contestedDelta = computeAreaScore({ width: WIDTH, height: HEIGHT, stones: CONTESTED_BOARD }, 0).black - directionBeforeScore.black

export const LESSONS_N4: Lesson[] = [
  {
    id: 'n4-l1',
    level: 4,
    order: 1,
    titleKey: 'lesson.n4-l1.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n4-l1.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: DANGO_BOARD,
        captionKey: 'lesson.n4-l1.diagram.dango.caption',
        captionParams: { libs: dangoLibs },
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: SPREAD_BOARD,
        captionKey: 'lesson.n4-l1.diagram.spread.caption',
        captionParams: { libs: spreadLibs.size },
      },
      { kind: 'paragraph', textKey: 'lesson.n4-l1.p2' },
    ],
  },
  {
    id: 'n4-l2',
    level: 4,
    order: 2,
    titleKey: 'lesson.n4-l2.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n4-l2.p1' },
      { kind: 'paragraph', textKey: 'lesson.n4-l2.p2' },
    ],
    demo: {
      width: WIDTH,
      height: HEIGHT,
      initialStones: board(WIDTH, [[2, 2], [4, 3]], [], HEIGHT),
      toMove: WHITE,
      steps: [
        {
          promptKey: 'lesson.n4-l2.demo.step1.prompt',
          expectedPoints: [point(WIDTH, 3, 2), point(WIDTH, 3, 3)],
          feedbackKey: 'lesson.n4-l2.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n4-l2.demo.complete',
    },
  },
  {
    id: 'n4-l3',
    level: 4,
    order: 3,
    titleKey: 'lesson.n4-l3.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n4-l3.p1' },
      { kind: 'paragraph', textKey: 'lesson.n4-l3.p2' },
    ],
    demo: {
      width: WIDTH,
      height: HEIGHT,
      initialStones: board(WIDTH, [[1, 2]], [[2, 2]], HEIGHT),
      toMove: BLACK,
      steps: [
        {
          promptKey: 'lesson.n4-l3.demo.step1.prompt',
          expectedPoints: [point(WIDTH, 2, 1)],
          feedbackKey: 'lesson.n4-l3.demo.step1.feedback',
        },
        {
          promptKey: 'lesson.n4-l3.demo.auto.prompt',
          expectedPoints: [],
          auto: point(WIDTH, 1, 1),
          feedbackKey: 'lesson.n4-l3.demo.auto.feedback',
        },
        {
          // Primera jugada de la escalera real que captura la piedra de
          // corte (verificado con solveLadder antes de escribir esto -- ver
          // NOTAS.md: `moves: [9, 1, 0, 2, 3]`, captured: true).
          promptKey: 'lesson.n4-l3.demo.step2.prompt',
          expectedPoints: [point(WIDTH, 0, 1)],
          feedbackKey: 'lesson.n4-l3.demo.step2.feedback',
        },
      ],
      completionKey: 'lesson.n4-l3.demo.complete',
    },
  },
  {
    id: 'n4-l4',
    level: 4,
    order: 4,
    titleKey: 'lesson.n4-l4.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n4-l4.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[1, 3], [1, 4], [1, 5], [1, 6], [3, 8]], [[7, 4]], HEIGHT),
        captionKey: 'lesson.n4-l4.diagram.short.caption',
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[1, 3], [1, 4], [1, 5], [1, 6], [4, 8]], [[7, 4]], HEIGHT),
        captionKey: 'lesson.n4-l4.diagram.balanced.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n4-l4.p2' },
    ],
  },
  {
    id: 'n4-l5',
    level: 4,
    order: 5,
    titleKey: 'lesson.n4-l5.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n4-l5.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: SECURED_BOARD,
        highlightPoint: point(WIDTH, SECURED_MOVE[0], SECURED_MOVE[1]),
        captionKey: 'lesson.n4-l5.diagram.secured.caption',
        captionParams: { delta: securedDelta },
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: CONTESTED_BOARD,
        highlightPoint: point(WIDTH, CONTESTED_MOVE[0], CONTESTED_MOVE[1]),
        captionKey: 'lesson.n4-l5.diagram.contested.caption',
        captionParams: { delta: contestedDelta },
      },
      { kind: 'paragraph', textKey: 'lesson.n4-l5.p2' },
    ],
  },
]
