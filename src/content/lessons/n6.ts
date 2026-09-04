import { toPoint, transformBoard, transformPoint, BOARD_TRANSFORMS } from '../../core/board'
import { board, point } from './helpers'
import type { Lesson } from './types'

const WIDTH = 13
const HEIGHT = 13

/**
 * Forma base para las lecciones 2 y 5: una piedra de esquina (punto 3-4) mas
 * una piedra de apoyo del mismo lado, con blanco acercandose entre las dos.
 * Negro puede bloquear hacia el apoyo (conecta con algo que ya vale) o hacia
 * el vacio (la pared apunta a la esquina, sin nada que reforzar). Geometria
 * simple a proposito -- una sola columna, distancias parejas -- para que la
 * comparacion sea facil de verificar a ojo, no una secuencia de joseki de
 * libro memorizada de memoria.
 */
const CORNER_STONE: [number, number] = [2, 3]
const SUPPORT_STONE: [number, number] = [2, 9]
const APPROACH_STONE: [number, number] = [2, 6]
const BLOCK_TOWARD_SUPPORT: [number, number] = [2, 7]
const BLOCK_TOWARD_EMPTY: [number, number] = [2, 5]

const BLOCK_SUPPORT_BOARD = board(WIDTH, [CORNER_STONE, SUPPORT_STONE, BLOCK_TOWARD_SUPPORT], [APPROACH_STONE], HEIGHT)
const BLOCK_EMPTY_BOARD = board(WIDTH, [CORNER_STONE, SUPPORT_STONE, BLOCK_TOWARD_EMPTY], [APPROACH_STONE], HEIGHT)

/**
 * La leccion 5 (simetria) reutiliza el tablero de "bloqueo hacia el apoyo"
 * de la leccion 2 y lo gira 180 grados con la misma utilidad de
 * transformaciones diedrales que ya multiplica el banco de problemas
 * (core/board.ts) -- la version girada se genera, no se redibuja a mano, asi
 * que es imposible que quede inconsistente con el original.
 */
const ROTATE_180 = BOARD_TRANSFORMS[2]
const ROTATED_BLOCK_SUPPORT_BOARD = transformBoard({ width: WIDTH, height: HEIGHT, stones: BLOCK_SUPPORT_BOARD }, ROTATE_180).stones
const ROTATED_BLOCK_POINT = transformPoint(WIDTH, HEIGHT, point(WIDTH, ...BLOCK_TOWARD_SUPPORT), ROTATE_180)

export const LESSONS_N6: Lesson[] = [
  {
    id: 'n6-l1',
    level: 6,
    order: 1,
    titleKey: 'lesson.n6-l1.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n6-l1.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[3, 3]], [[3, 7]], HEIGHT),
        captionKey: 'lesson.n6-l1.diagram.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n6-l1.p2' },
    ],
  },
  {
    id: 'n6-l2',
    level: 6,
    order: 2,
    titleKey: 'lesson.n6-l2.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n6-l2.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: BLOCK_SUPPORT_BOARD,
        highlightPoint: point(WIDTH, ...BLOCK_TOWARD_SUPPORT),
        captionKey: 'lesson.n6-l2.diagram.support.caption',
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: BLOCK_EMPTY_BOARD,
        highlightPoint: point(WIDTH, ...BLOCK_TOWARD_EMPTY),
        captionKey: 'lesson.n6-l2.diagram.empty.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n6-l2.p2' },
    ],
  },
  {
    id: 'n6-l3',
    level: 6,
    order: 3,
    titleKey: 'lesson.n6-l3.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n6-l3.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[2, 3]], [[4, 3]], HEIGHT),
        captionKey: 'lesson.n6-l3.diagram.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n6-l3.p2' },
    ],
  },
  {
    id: 'n6-l4',
    level: 6,
    order: 4,
    titleKey: 'lesson.n6-l4.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n6-l4.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[3, 3]], [], HEIGHT),
        captionKey: 'lesson.n6-l4.diagram.alone.caption',
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[3, 3]], [[2, 2]], HEIGHT),
        highlightPoint: toPoint(WIDTH, 2, 2),
        captionKey: 'lesson.n6-l4.diagram.invasion.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n6-l4.p2' },
    ],
  },
  {
    id: 'n6-l5',
    level: 6,
    order: 5,
    titleKey: 'lesson.n6-l5.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n6-l5.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: BLOCK_SUPPORT_BOARD,
        highlightPoint: point(WIDTH, ...BLOCK_TOWARD_SUPPORT),
        captionKey: 'lesson.n6-l5.diagram.original.caption',
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: ROTATED_BLOCK_SUPPORT_BOARD,
        highlightPoint: ROTATED_BLOCK_POINT,
        captionKey: 'lesson.n6-l5.diagram.rotated.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n6-l5.p2' },
    ],
  },
]
