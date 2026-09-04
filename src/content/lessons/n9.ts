import { computeAreaScore } from '../../core/scoring'
import { areaDeltaForPoint } from '../../solver/areaValue'
import { countLiberties } from '../../core/groups'
import { BLACK } from '../../core/types'
import { board, point } from './helpers'
import type { Lesson } from './types'

const WIDTH = 19
const HEIGHT = 19

/**
 * Esquina superior izquierda casi sellada por negro: pared en la columna
 * x=5 (filas 0-5) mas la fila y=5 (columnas 0-3), con un hueco real en
 * (4,5) -- a diferencia de una esquina en L cerrada por sus dos segmentos
 * (que ya queda sellada sin llenar el punto diagonal, ver n6/n7), este
 * hueco es ortogonal: conecta el bolsillo de adentro con el resto del
 * tablero. Dos piedras blancas lejanas (sin ellas, TODO el tablero vacio
 * quedaria "rodeado solo por negro" y el sellado no cambiaria nada, ver
 * NOTAS.md) hacen que el bolsillo cuente como neutral hasta que se sella.
 * El valor real de sellarlo se calcula aca con `areaDeltaForPoint` sobre
 * el tablero real, no se escribe a mano -- verificado con un script de
 * depuracion antes de aceptar el numero (ver NOTAS.md).
 */
const CORNER_WALL: Array<[number, number]> = [
  [5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [0, 5], [1, 5], [2, 5], [3, 5],
]
const DISTANT_WHITE: Array<[number, number]> = [[15, 15], [16, 15]]
const GAP: [number, number] = [4, 5]

const CORNER_BOARD = board(WIDTH, CORNER_WALL, DISTANT_WHITE, HEIGHT)
const SEALED_BOARD = board(WIDTH, [...CORNER_WALL, GAP], DISTANT_WHITE, HEIGHT)
const gapPoint = point(WIDTH, ...GAP)
const bigDelta = areaDeltaForPoint({ width: WIDTH, height: HEIGHT, stones: CORNER_BOARD }, gapPoint, BLACK)

/**
 * Mismo mecanismo que arriba (punto grande), mas dos paredes ya selladas
 * del todo con un unico punto de dame compartido entre ellas -- llenarlo
 * solo reclama ese punto, no desata nada mas atras. Dos valores reales
 * bien distintos para comparar, calculados con la misma funcion, no
 * inventados para que "se vean" distintos.
 */
const CORRIDOR_BLACK: Array<[number, number]> = [[10, 8], [10, 9], [10, 10], [10, 11], [10, 12]]
const CORRIDOR_WHITE: Array<[number, number]> = [[12, 8], [12, 9], [12, 10], [12, 11], [12, 12]]
const SMALL_POINT: [number, number] = [11, 10]

const COMPARE_BASE_BOARD = board(WIDTH, [...CORNER_WALL, ...CORRIDOR_BLACK], [...DISTANT_WHITE, ...CORRIDOR_WHITE], HEIGHT)
const smallPoint = point(WIDTH, ...SMALL_POINT)
const smallDelta = areaDeltaForPoint({ width: WIDTH, height: HEIGHT, stones: COMPARE_BASE_BOARD }, smallPoint, BLACK)

/**
 * Dos esquinas ya cerradas del todo (mismo truco de pared en L, sin punto
 * diagonal que llenar), de tamanos bien distintos -- para contar y
 * comparar, no para jugar nada. Puntaje real con `computeAreaScore` y el
 * mismo komi que usa el resto del banco generado (ver areaValue.ts).
 */
const KOMI = 6.5
const BLACK_TERRITORY_WALL: Array<[number, number]> = [
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
]
const WHITE_TERRITORY_WALL: Array<[number, number]> = [[15, 0], [15, 1], [15, 2], [16, 2], [17, 2], [18, 2]]
const COUNTING_BOARD = board(WIDTH, BLACK_TERRITORY_WALL, WHITE_TERRITORY_WALL, HEIGHT)
const countingScore = computeAreaScore({ width: WIDTH, height: HEIGHT, stones: COUNTING_BOARD }, KOMI)

/**
 * Hane que ademas ataja: blanco (2 piedras) tiene exactamente 2
 * libertades antes de la jugada (verificado con countLiberties), 1
 * despues -- atari real, no solo "parece". Si blanco ignora, negro
 * captura jugando la libertad que queda (verificado jugada por jugada con
 * un script de depuracion antes de aceptar la posicion, ver NOTAS.md).
 */
const HANE_BLACK: Array<[number, number]> = [[6, 8], [6, 9], [8, 8], [8, 9]]
const HANE_WHITE: Array<[number, number]> = [[7, 8], [7, 9]]
const HANE_MOVE: [number, number] = [7, 7]

const BEFORE_HANE_BOARD = board(WIDTH, HANE_BLACK, HANE_WHITE, HEIGHT)
const AFTER_HANE_BOARD = board(WIDTH, [...HANE_BLACK, HANE_MOVE], HANE_WHITE, HEIGHT)
const whiteLibsBefore = countLiberties({ width: WIDTH, height: HEIGHT, stones: BEFORE_HANE_BOARD }, point(WIDTH, 7, 8))
const whiteLibsAfter = countLiberties({ width: WIDTH, height: HEIGHT, stones: AFTER_HANE_BOARD }, point(WIDTH, 7, 8))

/** Jugada de borde sin ninguna piedra rival cerca -- gote, blanco puede ignorarla sin perder nada. */
const GOTE_BLACK: Array<[number, number]> = [[10, 3], [10, 4], [10, 5]]
const GOTE_MOVE: [number, number] = [10, 6]
const GOTE_BOARD = board(WIDTH, [...GOTE_BLACK, GOTE_MOVE], [], HEIGHT)

export const LESSONS_N9: Lesson[] = [
  {
    id: 'n9-l1',
    level: 9,
    order: 1,
    titleKey: 'lesson.n9-l1.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n9-l1.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: CORNER_BOARD,
        highlightPoint: gapPoint,
        captionKey: 'lesson.n9-l1.diagram.open.caption',
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: SEALED_BOARD,
        captionKey: 'lesson.n9-l1.diagram.sealed.caption',
        captionParams: { delta: bigDelta ?? 0 },
      },
      { kind: 'paragraph', textKey: 'lesson.n9-l1.p2' },
    ],
  },
  {
    id: 'n9-l2',
    level: 9,
    order: 2,
    titleKey: 'lesson.n9-l2.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n9-l2.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: AFTER_HANE_BOARD,
        highlightPoint: point(WIDTH, ...HANE_MOVE),
        captionKey: 'lesson.n9-l2.diagram.sente.caption',
        captionParams: { before: whiteLibsBefore, after: whiteLibsAfter },
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: GOTE_BOARD,
        highlightPoint: point(WIDTH, ...GOTE_MOVE),
        captionKey: 'lesson.n9-l2.diagram.gote.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n9-l2.p2' },
    ],
  },
  {
    id: 'n9-l3',
    level: 9,
    order: 3,
    titleKey: 'lesson.n9-l3.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n9-l3.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: AFTER_HANE_BOARD,
        highlightPoint: point(WIDTH, ...HANE_MOVE),
        captionKey: 'lesson.n9-l3.diagram.caption',
        captionParams: { after: whiteLibsAfter },
      },
      { kind: 'paragraph', textKey: 'lesson.n9-l3.p2' },
    ],
  },
  {
    id: 'n9-l4',
    level: 9,
    order: 4,
    titleKey: 'lesson.n9-l4.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n9-l4.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: COMPARE_BASE_BOARD,
        highlightPoint: gapPoint,
        captionKey: 'lesson.n9-l4.diagram.big.caption',
        captionParams: { delta: bigDelta ?? 0 },
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: COMPARE_BASE_BOARD,
        highlightPoint: smallPoint,
        captionKey: 'lesson.n9-l4.diagram.small.caption',
        captionParams: { delta: smallDelta ?? 0 },
      },
      { kind: 'paragraph', textKey: 'lesson.n9-l4.p2' },
    ],
  },
  {
    id: 'n9-l5',
    level: 9,
    order: 5,
    titleKey: 'lesson.n9-l5.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n9-l5.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: COUNTING_BOARD,
        captionKey: 'lesson.n9-l5.diagram.caption',
        captionParams: { black: countingScore.black, white: countingScore.white },
      },
      { kind: 'paragraph', textKey: 'lesson.n9-l5.p2' },
    ],
  },
]
