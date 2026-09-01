import { cuadradoDeCuatro, dosOjosSeparados, piramideDeCuatro, rectaDeTres } from '../seeds'
import { BLACK, WHITE } from '../../core/types'
import { board, cropPoint, cropShape, point } from './helpers'
import type { Lesson } from './types'

const RECTA = cropShape(rectaDeTres)
const CUADRADO = cropShape(cuadradoDeCuatro)
const PIRAMIDE = cropShape(piramideDeCuatro)
const DOS_OJOS = cropShape(dosOjosSeparados)

export const LESSONS_N2: Lesson[] = [
  {
    id: 'n2-l1',
    level: 2,
    order: 1,
    titleKey: 'lesson.n2-l1.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n2-l1.p1' },
      {
        kind: 'diagram',
        size: 5,
        stones: board(5, [
          [3, 4],
          [4, 3],
        ]),
        captionKey: 'lesson.n2-l1.diagram.caption',
        highlightPoint: point(5, 4, 4),
      },
    ],
  },
  {
    id: 'n2-l2',
    level: 2,
    order: 2,
    titleKey: 'lesson.n2-l2.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n2-l2.p1' },
      { kind: 'paragraph', textKey: 'lesson.n2-l2.p2' },
    ],
    demo: {
      size: 5,
      initialStones: board(
        5,
        [
          [3, 3],
          [3, 4],
          [4, 3],
        ],
        [
          [2, 3],
          [3, 2],
          [2, 4],
          [4, 2],
        ],
      ),
      toMove: WHITE,
      steps: [
        {
          promptKey: 'lesson.n2-l2.demo.step1.prompt',
          expectedPoints: [point(5, 4, 4)],
          feedbackKey: 'lesson.n2-l2.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n2-l2.demo.complete',
    },
  },
  {
    id: 'n2-l3',
    level: 2,
    order: 3,
    titleKey: 'lesson.n2-l3.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n2-l3.p1' },
      { kind: 'paragraph', textKey: 'lesson.n2-l3.p2' },
      {
        kind: 'diagram',
        size: DOS_OJOS.size,
        stones: DOS_OJOS.stones,
        captionKey: 'lesson.n2-l3.diagram.caption',
        highlightPoint: cropPoint(DOS_OJOS, 3, 4),
      },
    ],
  },
  {
    id: 'n2-l4',
    level: 2,
    order: 4,
    titleKey: 'lesson.n2-l4.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n2-l4.p1' },
      { kind: 'paragraph', textKey: 'lesson.n2-l4.p2' },
      {
        kind: 'diagram',
        size: 5,
        stones: board(
          5,
          [
            [1, 0],
            [3, 0],
            [2, 1],
            [3, 1],
          ],
          [[1, 1]],
        ),
        captionKey: 'lesson.n2-l4.diagram.caption',
        highlightPoint: point(5, 2, 0),
      },
    ],
  },
  {
    id: 'n2-l5',
    level: 2,
    order: 5,
    titleKey: 'lesson.n2-l5.title',
    blocks: [{ kind: 'paragraph', textKey: 'lesson.n2-l5.p1' }],
    demo: {
      size: RECTA.size,
      initialStones: RECTA.stones,
      toMove: BLACK,
      steps: [
        {
          promptKey: 'lesson.n2-l5.demo.step1.prompt',
          expectedPoints: [cropPoint(RECTA, 4, 4)],
          feedbackKey: 'lesson.n2-l5.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n2-l5.demo.complete',
    },
  },
  {
    id: 'n2-l6',
    level: 2,
    order: 6,
    titleKey: 'lesson.n2-l6.title',
    blocks: [{ kind: 'paragraph', textKey: 'lesson.n2-l6.p1' }],
    demo: {
      size: PIRAMIDE.size,
      initialStones: PIRAMIDE.stones,
      toMove: WHITE,
      steps: [
        {
          promptKey: 'lesson.n2-l6.demo.step1.prompt',
          expectedPoints: [cropPoint(PIRAMIDE, 4, 4)],
          feedbackKey: 'lesson.n2-l6.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n2-l6.demo.complete',
    },
  },
  {
    id: 'n2-l7',
    level: 2,
    order: 7,
    titleKey: 'lesson.n2-l7.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n2-l7.p1' },
      {
        kind: 'diagram',
        size: RECTA.size,
        stones: RECTA.stones,
        captionKey: 'lesson.n2-l7.diagram.rectaDeTres.caption',
        highlightPoint: cropPoint(RECTA, 4, 4),
      },
      {
        kind: 'diagram',
        size: PIRAMIDE.size,
        stones: PIRAMIDE.stones,
        captionKey: 'lesson.n2-l7.diagram.piramide.caption',
        highlightPoint: cropPoint(PIRAMIDE, 4, 4),
      },
      {
        kind: 'diagram',
        size: CUADRADO.size,
        stones: CUADRADO.stones,
        captionKey: 'lesson.n2-l7.diagram.cuadrado.caption',
        highlightPoint: cropPoint(CUADRADO, 3, 4),
      },
    ],
  },
  {
    id: 'n2-l8',
    level: 2,
    order: 8,
    titleKey: 'lesson.n2-l8.title',
    blocks: [{ kind: 'paragraph', textKey: 'lesson.n2-l8.p1' }],
    demo: {
      size: CUADRADO.size,
      initialStones: CUADRADO.stones,
      toMove: WHITE,
      steps: [
        {
          promptKey: 'lesson.n2-l8.demo.step1.prompt',
          expectedPoints: [
            cropPoint(CUADRADO, 3, 4),
            cropPoint(CUADRADO, 4, 4),
            cropPoint(CUADRADO, 3, 5),
            cropPoint(CUADRADO, 4, 5),
          ],
          feedbackKey: 'lesson.n2-l8.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n2-l8.demo.complete',
    },
  },
]
