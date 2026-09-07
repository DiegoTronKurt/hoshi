import { computeAreaScore } from '../../core/scoring'
import { createBoard, toPoint } from '../../core/board'
import { applyMove, createGame, gameStateFromBoard } from '../../core/rules'
import { BLACK, WHITE } from '../../core/types'
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
 * Mismo tablero, dos maneras de contarlo: sin komi es un empate exacto
 * (verificado con computeAreaScore, no inventado), con el komi real de esta
 * app (6.5) blanco gana. Paredes en columnas 2 y 4 de un tablero de 7, con
 * la columna 3 vacia y neutral (toca los dos colores) en el medio.
 */
function komiDiagram() {
  const size = 7
  const black: Array<[number, number]> = []
  const white: Array<[number, number]> = []
  for (let y = 0; y < size; y++) {
    black.push([2, y])
    white.push([4, y])
  }
  const stones = board(size, black, white)
  const noKomi = computeAreaScore({ width: size, height: size, stones }, 0)
  const withKomi = computeAreaScore({ width: size, height: size, stones }, 6.5)
  return { size, stones, tied: noKomi.black, margin: withKomi.white - withKomi.black }
}

const KOMI_DIAGRAM = komiDiagram()

/**
 * Grupo blanco de 2x2 sin espacio para dos ojos, con exactamente una
 * libertad real (no cero: un grupo sin libertades no podria seguir en el
 * tablero bajo las reglas reales) -- atari real, tan muerto como se puede
 * estar sin haber sido capturado todavia. `afterScore` es el resultado de
 * jugar de verdad esa ultima libertad (applyMove real, piedras removidas
 * por el motor, no borradas a mano), para que el puntaje de "despues" sea
 * el que el motor realmente da, igual que el resto de este archivo.
 */
function deadStoneDiagram() {
  const size = 3
  const b = createBoard(size)
  const blackWall: Array<[number, number]> = [[2, 0], [2, 2], [0, 2], [1, 2]]
  const whiteDead: Array<[number, number]> = [[0, 0], [1, 0], [0, 1], [1, 1]]
  for (const [x, y] of blackWall) b.stones[toPoint(size, x, y)] = BLACK
  for (const [x, y] of whiteDead) b.stones[toPoint(size, x, y)] = WHITE
  const beforeScore = computeAreaScore({ width: size, height: size, stones: b.stones }, 0)

  const state = gameStateFromBoard({ width: size, height: size, stones: b.stones }, BLACK)
  const captured = applyMove(state, toPoint(size, 2, 1))
  if (!captured.legal || !captured.state) throw new Error('deadStoneDiagram: la jugada de captura no fue legal')
  const afterScore = computeAreaScore({ width: size, height: size, stones: captured.state.board.stones }, 0)

  return { size, before: b.stones, after: captured.state.board.stones, beforeScore, afterScore }
}

const DEAD_STONE_DIAGRAM = deadStoneDiagram()

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
      {
        kind: 'diagram',
        width: KOMI_DIAGRAM.size,
        height: KOMI_DIAGRAM.size,
        stones: KOMI_DIAGRAM.stones,
        captionKey: 'lesson.n1-l4.diagram.caption',
        captionParams: { tied: KOMI_DIAGRAM.tied, margin: KOMI_DIAGRAM.margin },
      },
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
      {
        kind: 'diagram',
        width: DEAD_STONE_DIAGRAM.size,
        height: DEAD_STONE_DIAGRAM.size,
        stones: DEAD_STONE_DIAGRAM.before,
        captionKey: 'lesson.n1-l6.diagram.before.caption',
        captionParams: { black: DEAD_STONE_DIAGRAM.beforeScore.black, white: DEAD_STONE_DIAGRAM.beforeScore.white },
      },
      {
        kind: 'diagram',
        width: DEAD_STONE_DIAGRAM.size,
        height: DEAD_STONE_DIAGRAM.size,
        stones: DEAD_STONE_DIAGRAM.after,
        captionKey: 'lesson.n1-l6.diagram.after.caption',
        captionParams: { black: DEAD_STONE_DIAGRAM.afterScore.black, white: DEAD_STONE_DIAGRAM.afterScore.white },
      },
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
