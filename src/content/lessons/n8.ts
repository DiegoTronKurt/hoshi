import { board, point } from './helpers'
import type { Lesson } from './types'

const WIDTH = 19
const HEIGHT = 19

export const LESSONS_N8: Lesson[] = [
  {
    id: 'n8-l1',
    level: 8,
    order: 1,
    titleKey: 'lesson.n8-l1.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n8-l1.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[7, 9], [9, 7]], [[9, 9], [10, 9]], HEIGHT),
        captionKey: 'lesson.n8-l1.diagram.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n8-l1.p2' },
    ],
  },
  {
    id: 'n8-l2',
    level: 8,
    order: 2,
    titleKey: 'lesson.n8-l2.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n8-l2.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[5, 9], [7, 9]], [[9, 9], [10, 9]], HEIGHT),
        highlightPoint: point(WIDTH, 7, 9),
        captionKey: 'lesson.n8-l2.diagram.supported.caption',
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[5, 9], [14, 9]], [[9, 9], [10, 9]], HEIGHT),
        highlightPoint: point(WIDTH, 14, 9),
        captionKey: 'lesson.n8-l2.diagram.isolated.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n8-l2.p2' },
    ],
  },
  {
    id: 'n8-l3',
    level: 8,
    order: 3,
    titleKey: 'lesson.n8-l3.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n8-l3.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[2, 2], [2, 5], [12, 10]], [[13, 10]], HEIGHT),
        captionKey: 'lesson.n8-l3.diagram.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n8-l3.p2' },
    ],
  },
  {
    id: 'n8-l4',
    level: 8,
    order: 4,
    titleKey: 'lesson.n8-l4.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n8-l4.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[2, 2], [2, 3], [10, 5], [11, 6], [12, 7]], [], HEIGHT),
        captionKey: 'lesson.n8-l4.diagram.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n8-l4.p2' },
    ],
  },
  {
    id: 'n8-l5',
    level: 8,
    order: 5,
    titleKey: 'lesson.n8-l5.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n8-l5.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[2, 2], [2, 5], [16, 16], [16, 13]], [[8, 10], [9, 9], [10, 8]], HEIGHT),
        captionKey: 'lesson.n8-l5.diagram.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n8-l5.p2' },
    ],
  },
]
