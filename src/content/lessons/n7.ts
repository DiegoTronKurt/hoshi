import { board, point } from './helpers'
import type { Lesson } from './types'

const WIDTH = 19
const HEIGHT = 19

/**
 * Forma base para las lecciones 1 y 4: dos piedras negras del mismo lado (la
 * 4-4 de esquina y la 4-10 de lado, ambas hoshi reales en 19x19 -- ver
 * ui/board/hoshiPoints.ts) con blanco invadiendo a mitad de camino entre
 * ellas, en la tercera linea. Geometria elegida para que la afirmacion de la
 * leccion 1 se pueda verificar contando intersecciones, no leyendo una
 * secuencia: una extension de dos espacios desde la invasion, hacia
 * cualquiera de los dos lados, cae en contacto directo con una piedra negra
 * (fila 3 o fila 9, a una columna de distancia) -- no hay lugar para una
 * base comoda. La leccion 4 reutiliza la misma posicion para una pregunta
 * distinta (que hacer con esa invasion, no que es lo que le falta).
 */
const MOYO_BOARD = board(WIDTH, [[3, 3], [3, 9]], [[2, 6]], HEIGHT)
const MOYO_INVASION_POINT = point(WIDTH, 2, 6)

export const LESSONS_N7: Lesson[] = [
  {
    id: 'n7-l1',
    level: 7,
    order: 1,
    titleKey: 'lesson.n7-l1.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n7-l1.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[3, 3], [3, 9]], [], HEIGHT),
        captionKey: 'lesson.n7-l1.diagram.moyo.caption',
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: MOYO_BOARD,
        highlightPoint: MOYO_INVASION_POINT,
        captionKey: 'lesson.n7-l1.diagram.invasion.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n7-l1.p2' },
    ],
  },
  {
    id: 'n7-l2',
    level: 7,
    order: 2,
    titleKey: 'lesson.n7-l2.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n7-l2.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[3, 3], [3, 7]], [[6, 5]], HEIGHT),
        highlightPoint: point(WIDTH, 5, 5),
        captionKey: 'lesson.n7-l2.diagram.local.caption',
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[3, 3], [3, 7]], [[6, 5]], HEIGHT),
        highlightPoint: point(WIDTH, 15, 15),
        captionKey: 'lesson.n7-l2.diagram.global.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n7-l2.p2' },
    ],
  },
  {
    id: 'n7-l3',
    level: 7,
    order: 3,
    titleKey: 'lesson.n7-l3.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n7-l3.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[3, 3], [9, 3]], [], HEIGHT),
        highlightPoint: point(WIDTH, 15, 3),
        captionKey: 'lesson.n7-l3.diagram.related.caption',
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[3, 3], [9, 3]], [], HEIGHT),
        highlightPoint: point(WIDTH, 15, 15),
        captionKey: 'lesson.n7-l3.diagram.unrelated.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n7-l3.p2' },
    ],
  },
  {
    id: 'n7-l4',
    level: 7,
    order: 4,
    titleKey: 'lesson.n7-l4.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n7-l4.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: MOYO_BOARD,
        highlightPoint: MOYO_INVASION_POINT,
        captionKey: 'lesson.n7-l4.diagram.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n7-l4.p2' },
    ],
  },
  {
    id: 'n7-l5',
    level: 7,
    order: 5,
    titleKey: 'lesson.n7-l5.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n7-l5.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[5, 5]], [[6, 5]], HEIGHT),
        captionKey: 'lesson.n7-l5.diagram.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n7-l5.p2' },
    ],
  },
]
