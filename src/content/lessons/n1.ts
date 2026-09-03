import { computeAreaScore } from '../../core/scoring'
import { toPoint } from '../../core/board'
import { applyMove, createGame } from '../../core/rules'
import { BLACK } from '../../core/types'
import type { GameState } from '../../core/types'
import { board, point } from './helpers'
import type { Lesson } from './types'

const SIZE = 9

function areaDiagram() {
  const size = 7
  const black: Array<[number, number]> = []
  const white: Array<[number, number]> = []
  for (let y = 0; y < 7; y++) {
    black.push([2, y])
    white.push([4, y])
  }
  const stones = board(size, black, white)
  const score = computeAreaScore({ width: size, height: size, stones }, 0)
  return { size, stones, score }
}

const AREA_DIAGRAM = areaDiagram()

/**
 * Reproduce exactamente la misma secuencia de jugadas verificada en
 * tests/core/ko-superko.test.ts (setUpKo) para no inventar a mano una
 * posicion de ko nueva: si el motor de reglas cambia, el test la vuelve a
 * verificar y esta leccion se mantiene correcta sin tocarla.
 */
function playKo(state: GameState, x: number, y: number): GameState {
  const result = applyMove(state, toPoint(state.board.width, x, y))
  if (!result.legal || !result.state) throw new Error(`Jugada ilegal en (${x},${y}): ${result.reason}`)
  return result.state
}

function buildKoPosition() {
  let state = createGame(5, 5, 0)
  state = playKo(state, 1, 2)
  state = playKo(state, 2, 2)
  state = playKo(state, 2, 1)
  state = playKo(state, 4, 2)
  state = playKo(state, 2, 3)
  state = playKo(state, 3, 1)
  state = playKo(state, 0, 0)
  state = playKo(state, 3, 3)
  return state
}

const KO_POSITION = buildKoPosition()

export const LESSONS_N1: Lesson[] = [
  {
    id: 'n1-l1',
    level: 1,
    order: 1,
    titleKey: 'lesson.n1-l1.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n1-l1.p1' },
      { kind: 'paragraph', textKey: 'lesson.n1-l1.p2' },
    ],
  },
  {
    id: 'n1-l2',
    level: 1,
    order: 2,
    titleKey: 'lesson.n1-l2.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n1-l2.p1' },
      { kind: 'paragraph', textKey: 'lesson.n1-l2.p2' },
    ],
    demo: {
      width: SIZE,
      height: SIZE,
      initialStones: board(
        SIZE,
        [
          [0, 0],
          [2, 0],
        ],
        [[1, 0]],
      ),
      toMove: BLACK,
      steps: [
        {
          promptKey: 'lesson.n1-l2.demo.step1.prompt',
          expectedPoints: [point(SIZE, 1, 1)],
          feedbackKey: 'lesson.n1-l2.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n1-l2.demo.complete',
    },
  },
  {
    id: 'n1-l3',
    level: 1,
    order: 3,
    titleKey: 'lesson.n1-l3.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n1-l3.p1' },
      {
        kind: 'diagram',
        width: AREA_DIAGRAM.size,
        height: AREA_DIAGRAM.size,
        stones: AREA_DIAGRAM.stones,
        captionKey: 'lesson.n1-l3.diagram.caption',
        captionParams: { score: AREA_DIAGRAM.score.black, stones: 7, territory: 14 },
      },
    ],
  },
  {
    id: 'n1-l4',
    level: 1,
    order: 4,
    titleKey: 'lesson.n1-l4.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n1-l4.p1' },
      { kind: 'paragraph', textKey: 'lesson.n1-l4.p2' },
    ],
  },
  {
    id: 'n1-l5',
    level: 1,
    order: 5,
    titleKey: 'lesson.n1-l5.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n1-l5.p1' },
      { kind: 'paragraph', textKey: 'lesson.n1-l5.p2' },
    ],
    demo: {
      width: 5,
      height: 5,
      initialStones: KO_POSITION.board.stones,
      toMove: BLACK,
      steps: [
        {
          promptKey: 'lesson.n1-l5.demo.step1.prompt',
          expectedPoints: [point(5, 3, 2)],
          feedbackKey: 'lesson.n1-l5.demo.step1.feedback',
        },
        {
          promptKey: 'lesson.n1-l5.demo.step2.prompt',
          expectedPoints: [point(5, 2, 2)],
          expectIllegal: true,
          feedbackKey: 'lesson.n1-l5.demo.step2.feedback',
        },
      ],
      completionKey: 'lesson.n1-l5.demo.complete',
    },
  },
  {
    id: 'n1-l6',
    level: 1,
    order: 6,
    titleKey: 'lesson.n1-l6.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n1-l6.p1' },
      { kind: 'paragraph', textKey: 'lesson.n1-l6.p2' },
    ],
  },
  {
    id: 'n1-l7',
    level: 1,
    order: 7,
    titleKey: 'lesson.n1-l7.title',
    blocks: [
      { kind: 'paragraph', textKey: 'lesson.n1-l7.p1' },
      { kind: 'paragraph', textKey: 'lesson.n1-l7.p2' },
    ],
    demo: {
      width: SIZE,
      height: SIZE,
      initialStones: board(
        SIZE,
        [
          [0, 1],
          [2, 1],
          [1, 0],
          [7, 8],
          [8, 7],
        ],
        [[1, 1]],
      ),
      toMove: BLACK,
      steps: [
        {
          promptKey: 'lesson.n1-l7.demo.step1.prompt',
          expectedPoints: [point(SIZE, 1, 2)],
          feedbackKey: 'lesson.n1-l7.demo.step1.feedback',
        },
      ],
      completionKey: 'lesson.n1-l7.demo.complete',
    },
  },
]
