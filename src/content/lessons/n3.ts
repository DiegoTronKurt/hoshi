import { BLACK, WHITE } from '../../core/types'
import { board, point } from './helpers'
import type { Lesson } from './types'

export const LESSONS_N3: Lesson[] = [
  {
    id: 'n3-l1',
    level: 3,
    order: 1,
    titleKey: 'lesson.n3-l1.title',
    blocks: [{ kind: 'paragraph', textKey: 'lesson.n3-l1.p1' }],
    demo: {
      size: 7,
      initialStones: board(
        7,
        [
          [1, 2],
          [2, 1],
          [5, 2],
          [4, 1],
        ],
        [
          [2, 2],
          [4, 2],
        ],
      ),
      toMove: BLACK,
      steps: [
        {
          promptKey: 'lesson.n3-l1.demo.step1.prompt',
          expectedPoints: [point(7, 3, 2)],
          feedbackKey: 'lesson.n3-l1.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n3-l1.demo.complete',
    },
  },
  {
    id: 'n3-l2',
    level: 3,
    order: 2,
    titleKey: 'lesson.n3-l2.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n3-l2.p1' },
      { kind: 'paragraph', textKey: 'lesson.n3-l2.p2' },
    ],
    demo: {
      size: 5,
      initialStones: board(5, [[1, 1]], [[2, 1], [1, 2]]),
      toMove: WHITE,
      steps: [
        {
          promptKey: 'lesson.n3-l2.demo.step1.prompt',
          expectedPoints: [point(5, 0, 1)],
          feedbackKey: 'lesson.n3-l2.demo.step1.feedback',
        },
        {
          promptKey: 'lesson.n3-l2.demo.auto1.prompt',
          expectedPoints: [],
          auto: point(5, 1, 0),
          feedbackKey: 'lesson.n3-l2.demo.auto1.feedback',
        },
        {
          promptKey: 'lesson.n3-l2.demo.step2.prompt',
          expectedPoints: [point(5, 0, 0)],
          feedbackKey: 'lesson.n3-l2.demo.step2.feedback',
        },
        {
          promptKey: 'lesson.n3-l2.demo.auto2.prompt',
          expectedPoints: [],
          auto: point(5, 2, 0),
          feedbackKey: 'lesson.n3-l2.demo.auto2.feedback',
        },
        {
          promptKey: 'lesson.n3-l2.demo.step3.prompt',
          expectedPoints: [point(5, 3, 0)],
          feedbackKey: 'lesson.n3-l2.demo.step3.feedback',
        },
      ],
      completionKey: 'lesson.n3-l2.demo.complete',
    },
  },
  {
    id: 'n3-l3',
    level: 3,
    order: 3,
    titleKey: 'lesson.n3-l3.title',
    blocks: [{ kind: 'paragraph', textKey: 'lesson.n3-l3.p1' }],
    demo: {
      size: 5,
      initialStones: board(5, [[1, 1], [1, 0]], [[2, 1], [1, 2]]),
      toMove: WHITE,
      steps: [
        {
          promptKey: 'lesson.n3-l3.demo.step1.prompt',
          expectedPoints: [point(5, 0, 1)],
          feedbackKey: 'lesson.n3-l3.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n3-l3.demo.complete',
    },
  },
  {
    id: 'n3-l4',
    level: 3,
    order: 4,
    titleKey: 'lesson.n3-l4.title',
    blocks: [{ kind: 'paragraph', textKey: 'lesson.n3-l4.p1' }],
    demo: {
      size: 5,
      initialStones: board(5, [[1, 2], [2, 1]], [[1, 1]]),
      toMove: BLACK,
      steps: [
        {
          promptKey: 'lesson.n3-l4.demo.step1.prompt',
          expectedPoints: [point(5, 0, 0)],
          feedbackKey: 'lesson.n3-l4.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n3-l4.demo.complete',
    },
  },
  {
    id: 'n3-l5',
    level: 3,
    order: 5,
    titleKey: 'lesson.n3-l5.title',
    blocks: [{ kind: 'paragraph', textKey: 'lesson.n3-l5.p1' }],
    demo: {
      size: 7,
      initialStones: board(
        7,
        [
          [2, 3],
          [3, 2],
          [2, 4],
          [3, 5],
          [5, 4],
          [4, 5],
        ],
        [
          [3, 3],
          [3, 4],
          [5, 3],
          [4, 2],
        ],
      ),
      toMove: BLACK,
      steps: [
        {
          promptKey: 'lesson.n3-l5.demo.step1.prompt',
          expectedPoints: [point(7, 4, 3)],
          feedbackKey: 'lesson.n3-l5.demo.step1.feedback',
        },
        {
          promptKey: 'lesson.n3-l5.demo.auto.prompt',
          expectedPoints: [],
          auto: point(7, 4, 4),
          feedbackKey: 'lesson.n3-l5.demo.auto.feedback',
        },
        {
          promptKey: 'lesson.n3-l5.demo.step2.prompt',
          expectedPoints: [point(7, 4, 3)],
          feedbackKey: 'lesson.n3-l5.demo.step2.feedback',
        },
      ],
      completionKey: 'lesson.n3-l5.demo.complete',
    },
  },
  {
    id: 'n3-l6',
    level: 3,
    order: 6,
    titleKey: 'lesson.n3-l6.title',
    blocks: [{ kind: 'paragraph', textKey: 'lesson.n3-l6.p1' }],
    demo: {
      size: 5,
      initialStones: board(5, [
        [2, 2],
        [3, 3],
      ]),
      toMove: BLACK,
      steps: [
        {
          promptKey: 'lesson.n3-l6.demo.step1.prompt',
          expectedPoints: [point(5, 3, 2), point(5, 2, 3)],
          feedbackKey: 'lesson.n3-l6.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n3-l6.demo.complete',
    },
  },
  {
    id: 'n3-l7',
    level: 3,
    order: 7,
    titleKey: 'lesson.n3-l7.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n3-l7.p1' },
      {
        kind: 'diagram',
        size: 5,
        stones: board(5, [
          [2, 2],
          [3, 2],
          [2, 4],
          [3, 4],
        ]),
        captionKey: 'lesson.n3-l7.diagram.bamboo.caption',
      },
      {
        kind: 'diagram',
        size: 5,
        stones: board(5, [
          [2, 1],
          [1, 2],
          [3, 2],
        ]),
        captionKey: 'lesson.n3-l7.diagram.tiger.caption',
        highlightPoint: point(5, 2, 2),
      },
    ],
  },
  {
    id: 'n3-l8',
    level: 3,
    order: 8,
    titleKey: 'lesson.n3-l8.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n3-l8.p1' },
      {
        kind: 'diagram',
        size: 5,
        stones: board(5, [
          [2, 2],
          [3, 2],
          [2, 3],
        ]),
        captionKey: 'lesson.n3-l8.diagram.caption',
        highlightPoint: point(5, 3, 3),
      },
      { kind: 'paragraph', textKey: 'lesson.n3-l8.p2' },
    ],
  },
]
