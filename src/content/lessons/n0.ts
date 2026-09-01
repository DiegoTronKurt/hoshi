import { BLACK, WHITE } from '../../core/types'
import { board, point } from './helpers'
import type { Lesson } from './types'

const SIZE = 5

export const LESSONS_N0: Lesson[] = [
  {
    id: 'n0-l1',
    level: 0,
    order: 1,
    titleKey: 'lesson.n0-l1.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n0-l1.p1' },
      { kind: 'paragraph', textKey: 'lesson.n0-l1.p2' },
    ],
    demo: {
      size: SIZE,
      initialStones: board(SIZE, []),
      toMove: BLACK,
      steps: [
        {
          promptKey: 'lesson.n0-l1.demo.step1.prompt',
          expectedPoints: [point(SIZE, 2, 2)],
          feedbackKey: 'lesson.n0-l1.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n0-l1.demo.complete',
    },
  },
  {
    id: 'n0-l2',
    level: 0,
    order: 2,
    titleKey: 'lesson.n0-l2.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n0-l2.p1' },
      { kind: 'paragraph', textKey: 'lesson.n0-l2.p2' },
    ],
    demo: {
      size: SIZE,
      initialStones: board(SIZE, [[2, 2]]),
      toMove: WHITE,
      steps: [
        {
          promptKey: 'lesson.n0-l2.demo.step1.prompt',
          expectedPoints: [point(SIZE, 1, 2), point(SIZE, 3, 2), point(SIZE, 2, 1), point(SIZE, 2, 3)],
          feedbackKey: 'lesson.n0-l2.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n0-l2.demo.complete',
    },
  },
  {
    id: 'n0-l3',
    level: 0,
    order: 3,
    titleKey: 'lesson.n0-l3.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n0-l3.p1' },
      { kind: 'paragraph', textKey: 'lesson.n0-l3.p2' },
    ],
    demo: {
      size: SIZE,
      initialStones: board(SIZE, [[1, 2]]),
      toMove: BLACK,
      steps: [
        {
          promptKey: 'lesson.n0-l3.demo.step1.prompt',
          expectedPoints: [point(SIZE, 2, 2)],
          feedbackKey: 'lesson.n0-l3.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n0-l3.demo.complete',
    },
  },
  {
    id: 'n0-l4',
    level: 0,
    order: 4,
    titleKey: 'lesson.n0-l4.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n0-l4.p1' },
      { kind: 'paragraph', textKey: 'lesson.n0-l4.p2' },
    ],
    demo: {
      size: SIZE,
      initialStones: board(
        SIZE,
        [
          [1, 2],
          [3, 2],
          [2, 1],
        ],
        [[2, 2]],
      ),
      toMove: BLACK,
      steps: [
        {
          promptKey: 'lesson.n0-l4.demo.step1.prompt',
          expectedPoints: [point(SIZE, 2, 3)],
          feedbackKey: 'lesson.n0-l4.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n0-l4.demo.complete',
    },
  },
  {
    id: 'n0-l5',
    level: 0,
    order: 5,
    titleKey: 'lesson.n0-l5.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n0-l5.p1' },
      { kind: 'paragraph', textKey: 'lesson.n0-l5.p2' },
    ],
    demo: {
      size: SIZE,
      initialStones: board(
        SIZE,
        [
          [1, 1],
          [3, 1],
          [1, 2],
          [3, 2],
        ],
        [
          [2, 1],
          [2, 2],
        ],
      ),
      toMove: BLACK,
      steps: [
        {
          promptKey: 'lesson.n0-l5.demo.step1.prompt',
          expectedPoints: [point(SIZE, 2, 0)],
          feedbackKey: 'lesson.n0-l5.demo.step1.feedback',
        },
        {
          promptKey: 'lesson.n0-l5.demo.auto.prompt',
          expectedPoints: [],
          auto: true,
          feedbackKey: 'lesson.n0-l5.demo.auto.feedback',
        },
        {
          promptKey: 'lesson.n0-l5.demo.step2.prompt',
          expectedPoints: [point(SIZE, 2, 3)],
          feedbackKey: 'lesson.n0-l5.demo.step2.feedback',
        },
      ],
      completionKey: 'lesson.n0-l5.demo.complete',
    },
  },
  {
    id: 'n0-l6',
    level: 0,
    order: 6,
    titleKey: 'lesson.n0-l6.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n0-l6.p1' },
      { kind: 'paragraph', textKey: 'lesson.n0-l6.p2' },
    ],
    demo: {
      size: SIZE,
      initialStones: board(SIZE, [
        [1, 2],
        [3, 2],
        [2, 1],
        [2, 3],
      ]),
      toMove: WHITE,
      steps: [
        {
          promptKey: 'lesson.n0-l6.demo.step1.prompt',
          expectedPoints: [point(SIZE, 2, 2)],
          expectIllegal: true,
          feedbackKey: 'lesson.n0-l6.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n0-l6.demo.complete',
    },
  },
]
