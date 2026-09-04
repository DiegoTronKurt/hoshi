import { getGroup } from '../../core/groups'
import { board, point } from './helpers'
import type { Lesson } from './types'

const WIDTH = 19
const HEIGHT = 19

/**
 * Escena base compartida por n10-l1 (que es un semeai) y n10-l3
 * (libertades compartidas vs de afuera): dos dominos de dos piedras,
 * cara a cara, con dos libertades compartidas en el medio ((6,8) y (6,9))
 * mas las libertades de afuera de cada lado. Simetrica a proposito (4
 * libertades de afuera para cada uno) para que la primera lectura del
 * nivel muestre el caso mas limpio posible.
 */
const SYMMETRIC_BLACK: Array<[number, number]> = [[5, 8], [5, 9]]
const SYMMETRIC_WHITE: Array<[number, number]> = [[7, 8], [7, 9]]
const SYMMETRIC_BOARD = board(WIDTH, SYMMETRIC_BLACK, SYMMETRIC_WHITE, HEIGHT)
const symmetricBlackLibs = getGroup({ width: WIDTH, height: HEIGHT, stones: SYMMETRIC_BOARD }, point(WIDTH, 5, 8))!.liberties.size
const symmetricWhiteLibs = getGroup({ width: WIDTH, height: HEIGHT, stones: SYMMETRIC_BOARD }, point(WIDTH, 7, 8))!.liberties.size

/**
 * Misma pareja de piedras negras, pero blanco ya jugo tres piedras mas
 * (izquierda y arriba) tapando casi todas las libertades de afuera de
 * negro. Resultado real, contado con getGroup, no inventado: negro queda
 * con 3 libertades (2 compartidas + 1 de afuera), blanco con 6 (2
 * compartidas + 4 de afuera). Si negro ataca de todas formas, blanco gana
 * la carrera -- secuencia completa verificada jugada por jugada con un
 * script de depuracion antes de aceptar esta posicion (ver NOTAS.md): el
 * tablero "despues" de abajo es el resultado real de esa secuencia, sin
 * la piedra de tenuki de negro (irrelevante para la carrera en si).
 */
const BEHIND_BLACK: Array<[number, number]> = [[5, 8], [5, 9]]
const BEHIND_WHITE: Array<[number, number]> = [[7, 8], [7, 9], [4, 8], [4, 9], [5, 7]]
const BEHIND_BOARD = board(WIDTH, BEHIND_BLACK, BEHIND_WHITE, HEIGHT)
const behindBlackLibs = getGroup({ width: WIDTH, height: HEIGHT, stones: BEHIND_BOARD }, point(WIDTH, 5, 8))!.liberties.size
const behindWhiteLibs = getGroup({ width: WIDTH, height: HEIGHT, stones: BEHIND_BOARD }, point(WIDTH, 7, 8))!.liberties.size

const AFTER_RACE_BLACK: Array<[number, number]> = [[8, 8], [8, 9]]
const AFTER_RACE_WHITE: Array<[number, number]> = [[5, 7], [4, 8], [6, 8], [7, 8], [4, 9], [6, 9], [7, 9], [5, 10]]
const AFTER_RACE_BOARD = board(WIDTH, AFTER_RACE_BLACK, AFTER_RACE_WHITE, HEIGHT)

/**
 * Anillo negro (8 piedras) alrededor de un punto real: blanco no puede
 * jugar ahi (suicidio puro, verificado con applyMove antes de aceptar
 * esta posicion -- ver NOTAS.md), asi que cuenta como una libertad que
 * blanco nunca va a poder tocar. Tapado casi por completo con piedras
 * blancas de afuera, dejando exactamente 2 libertades de afuera para el
 * anillo -- las mismas 2 que la piedra blanca suelta de mas abajo, sin
 * ninguna compartida entre ambos grupos.
 */
const RING: Array<[number, number]> = [
  [10, 9], [11, 9], [12, 9],
  [10, 10], [12, 10],
  [10, 11], [11, 11], [12, 11],
]
const RING_CAP: Array<[number, number]> = [
  [11, 8], [10, 8], [12, 8],
  [11, 12], [10, 12], [12, 12],
  [9, 9], [9, 11],
  [13, 9], [13, 11],
]
const EYE_POINT: [number, number] = [11, 10]
const EYE_BOARD = board(WIDTH, RING, RING_CAP, HEIGHT)
const eyePoint = point(WIDTH, ...EYE_POINT)

const LONE_WHITE: [number, number] = [16, 16]
const LONE_CAP: Array<[number, number]> = [[15, 16], [16, 15]]
const RACE_BOARD = board(WIDTH, [...RING, ...LONE_CAP], [...RING_CAP, LONE_WHITE], HEIGHT)
const ringOutsideLibs = getGroup({ width: WIDTH, height: HEIGHT, stones: RACE_BOARD }, point(WIDTH, 10, 9))!.liberties.size - 1
const loneWhiteLibs = getGroup({ width: WIDTH, height: HEIGHT, stones: RACE_BOARD }, point(WIDTH, ...LONE_WHITE))!.liberties.size

/**
 * Dos grupos negros de dos piedras cada uno, separados por un solo punto
 * vacio -- jugarlo los funde en un unico grupo de 5 piedras (verificado
 * con getGroup antes de aceptar la posicion: 12 libertades el grupo
 * fundido, contra 3+3 repartidas e independientes antes de conectar).
 */
const CONNECT_BLACK: Array<[number, number]> = [[2, 5], [2, 6], [2, 8], [2, 9]]
const CONNECT_WHITE: Array<[number, number]> = [[4, 7]]
const CONNECT_POINT: [number, number] = [2, 7]
const BEFORE_CONNECT_BOARD = board(WIDTH, CONNECT_BLACK, CONNECT_WHITE, HEIGHT)
const AFTER_CONNECT_BOARD = board(WIDTH, [...CONNECT_BLACK, CONNECT_POINT], CONNECT_WHITE, HEIGHT)
const mergedLibs = getGroup({ width: WIDTH, height: HEIGHT, stones: AFTER_CONNECT_BOARD }, point(WIDTH, 2, 5))!.liberties.size

export const LESSONS_N10: Lesson[] = [
  {
    id: 'n10-l1',
    level: 10,
    order: 1,
    titleKey: 'lesson.n10-l1.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n10-l1.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: SYMMETRIC_BOARD,
        captionKey: 'lesson.n10-l1.diagram.caption',
        captionParams: { blackLibs: symmetricBlackLibs, whiteLibs: symmetricWhiteLibs },
      },
      { kind: 'paragraph', textKey: 'lesson.n10-l1.p2' },
    ],
  },
  {
    id: 'n10-l2',
    level: 10,
    order: 2,
    titleKey: 'lesson.n10-l2.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n10-l2.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: BEHIND_BOARD,
        captionKey: 'lesson.n10-l2.diagram.before.caption',
        captionParams: { blackLibs: behindBlackLibs, whiteLibs: behindWhiteLibs },
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: AFTER_RACE_BOARD,
        captionKey: 'lesson.n10-l2.diagram.after.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n10-l2.p2' },
    ],
  },
  {
    id: 'n10-l3',
    level: 10,
    order: 3,
    titleKey: 'lesson.n10-l3.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n10-l3.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: SYMMETRIC_BOARD,
        highlightPoint: point(WIDTH, 6, 8),
        captionKey: 'lesson.n10-l3.diagram.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n10-l3.p2' },
    ],
  },
  {
    id: 'n10-l4',
    level: 10,
    order: 4,
    titleKey: 'lesson.n10-l4.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n10-l4.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: EYE_BOARD,
        highlightPoint: eyePoint,
        captionKey: 'lesson.n10-l4.diagram.eye.caption',
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: RACE_BOARD,
        captionKey: 'lesson.n10-l4.diagram.race.caption',
        captionParams: { ringLibs: ringOutsideLibs, loneLibs: loneWhiteLibs },
      },
      { kind: 'paragraph', textKey: 'lesson.n10-l4.p2' },
    ],
  },
  {
    id: 'n10-l5',
    level: 10,
    order: 5,
    titleKey: 'lesson.n10-l5.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n10-l5.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: BEFORE_CONNECT_BOARD,
        highlightPoint: point(WIDTH, ...CONNECT_POINT),
        captionKey: 'lesson.n10-l5.diagram.caption',
        captionParams: { libs: mergedLibs },
      },
      { kind: 'paragraph', textKey: 'lesson.n10-l5.p2' },
    ],
  },
]
