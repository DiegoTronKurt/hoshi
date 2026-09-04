import { board, point } from './helpers'
import type { Lesson } from './types'

const WIDTH = 13
const HEIGHT = 13

export const LESSONS_N5: Lesson[] = [
  {
    id: 'n5-l1',
    level: 5,
    order: 1,
    titleKey: 'lesson.n5-l1.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n5-l1.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[3, 3]], [], HEIGHT),
        captionKey: 'lesson.n5-l1.diagram.alone.caption',
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[3, 3], [7, 3], [3, 7]], [], HEIGHT),
        captionKey: 'lesson.n5-l1.diagram.both.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n5-l1.p2' },
    ],
  },
  {
    id: 'n5-l2',
    level: 5,
    order: 2,
    titleKey: 'lesson.n5-l2.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n5-l2.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[2, 3]], [], HEIGHT),
        captionKey: 'lesson.n5-l2.diagram.open.caption',
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[2, 3]], [[8, 3]], HEIGHT),
        highlightPoint: point(WIDTH, 8, 3),
        captionKey: 'lesson.n5-l2.diagram.blocked.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n5-l2.p2' },
    ],
  },
  {
    id: 'n5-l3',
    level: 5,
    order: 3,
    titleKey: 'lesson.n5-l3.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n5-l3.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[3, 3]], [], HEIGHT),
        captionKey: 'lesson.n5-l3.diagram.star.caption',
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[2, 2]], [], HEIGHT),
        captionKey: 'lesson.n5-l3.diagram.33.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n5-l3.p2' },
    ],
  },
  {
    id: 'n5-l4',
    level: 5,
    order: 4,
    titleKey: 'lesson.n5-l4.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n5-l4.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[2, 3], [2, 6], [5, 3]], [], HEIGHT),
        highlightPoint: point(WIDTH, 5, 3),
        captionKey: 'lesson.n5-l4.diagram.box.caption',
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[2, 3], [2, 6], [2, 9]], [], HEIGHT),
        highlightPoint: point(WIDTH, 2, 9),
        captionKey: 'lesson.n5-l4.diagram.tray.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n5-l4.p2' },
    ],
  },
  {
    id: 'n5-l5',
    level: 5,
    order: 5,
    titleKey: 'lesson.n5-l5.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n5-l5.p1' },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[3, 3], [9, 3]], [], HEIGHT),
        captionKey: 'lesson.n5-l5.diagram.aligned.caption',
      },
      {
        kind: 'diagram',
        width: WIDTH,
        height: HEIGHT,
        stones: board(WIDTH, [[3, 3], [3, 9]], [], HEIGHT),
        captionKey: 'lesson.n5-l5.diagram.opposite.caption',
      },
      { kind: 'paragraph', textKey: 'lesson.n5-l5.p2' },
    ],
  },
]
