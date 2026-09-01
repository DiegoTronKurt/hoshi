/**
 * Genera el banco de problemas de doble atari (DOBLE_ATARI), separado del
 * banco principal porque no usa solve() ni RefutationNode (ver
 * content/doubleAtariProblem.ts): es reconocimiento de una sola jugada,
 * verificado con isDoubleAtariMove (solver/doubleAtari.ts) sobre un puñado
 * de plantillas de contacto, multiplicadas por las 8 transformaciones
 * diedrales igual que geta y snapback en content/seeds.ts.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BOARD_TRANSFORMS, createBoard, toPoint, transformBoard } from '../src/core/board'
import { BLACK, WHITE } from '../src/core/types'
import type { BoardState, Color } from '../src/core/types'
import { findDoubleAtariMoves } from '../src/solver/doubleAtari'
import { doubleAtariProblemToSgf } from '../src/content/doubleAtariProblem'
import type { DoubleAtariProblem } from '../src/content/doubleAtariProblem'

const SIZE = 9

interface Template {
  board: BoardState
  color: Color
}

/** Dos piedras blancas separadas, cada una con dos libertades, compartiendo
 * un punto: negro jugando ahi las deja a ambas en atari a la vez. */
function template1(): Template {
  const board = createBoard(SIZE)
  board.stones[toPoint(SIZE, 2, 2)] = WHITE
  board.stones[toPoint(SIZE, 1, 2)] = BLACK
  board.stones[toPoint(SIZE, 2, 1)] = BLACK
  board.stones[toPoint(SIZE, 4, 2)] = WHITE
  board.stones[toPoint(SIZE, 5, 2)] = BLACK
  board.stones[toPoint(SIZE, 4, 1)] = BLACK
  return { board, color: BLACK }
}

/** Mismo patron pero con el punto compartido en diagonal (contacto tipico
 * de una jugada de doble atari real: una piedra en medio de dos grupos). */
function template2(): Template {
  const board = createBoard(SIZE)
  board.stones[toPoint(SIZE, 2, 2)] = WHITE
  board.stones[toPoint(SIZE, 1, 1)] = BLACK
  board.stones[toPoint(SIZE, 1, 3)] = BLACK
  board.stones[toPoint(SIZE, 2, 1)] = BLACK
  board.stones[toPoint(SIZE, 2, 3)] = BLACK
  board.stones[toPoint(SIZE, 4, 4)] = WHITE
  board.stones[toPoint(SIZE, 5, 3)] = BLACK
  board.stones[toPoint(SIZE, 5, 5)] = BLACK
  board.stones[toPoint(SIZE, 4, 3)] = BLACK
  board.stones[toPoint(SIZE, 4, 5)] = BLACK
  return { board, color: BLACK }
}

/** Dos grupos de dos piedras blancas cada uno, mismo patron de dos libertades compartiendo el punto central. */
function template3(): Template {
  const board = createBoard(SIZE)
  board.stones[toPoint(SIZE, 2, 2)] = WHITE
  board.stones[toPoint(SIZE, 2, 3)] = WHITE
  board.stones[toPoint(SIZE, 1, 2)] = BLACK
  board.stones[toPoint(SIZE, 1, 3)] = BLACK
  board.stones[toPoint(SIZE, 2, 1)] = BLACK
  board.stones[toPoint(SIZE, 2, 4)] = BLACK
  board.stones[toPoint(SIZE, 4, 2)] = WHITE
  board.stones[toPoint(SIZE, 4, 3)] = WHITE
  board.stones[toPoint(SIZE, 5, 2)] = BLACK
  board.stones[toPoint(SIZE, 5, 3)] = BLACK
  board.stones[toPoint(SIZE, 4, 1)] = BLACK
  board.stones[toPoint(SIZE, 4, 4)] = BLACK
  return { board, color: BLACK }
}

async function main() {
  const templates = [template1(), template2(), template3()]
  const problems: DoubleAtariProblem[] = []
  const seen = new Set<string>()

  for (const template of templates) {
    for (const transform of BOARD_TRANSFORMS) {
      const board = transformBoard(template.board, transform)

      const key = board.stones.join('')
      if (seen.has(key)) continue
      seen.add(key)

      const expectedPoints = findDoubleAtariMoves(board, template.color)
      if (expectedPoints.length === 0) continue // nunca se acepta sin que isDoubleAtariMove lo reconfirme

      problems.push({ conceptId: 'DOBLE_ATARI', board, color: template.color, expectedPoints })
    }
  }

  const root = dirname(fileURLToPath(import.meta.url))
  const outDir = join(root, '..', 'src', 'content', 'problems')
  await mkdir(outDir, { recursive: true })

  const bank = problems.map((problem, index) => ({
    id: `doubleatari${index + 1}`,
    conceptId: problem.conceptId,
    sgf: doubleAtariProblemToSgf(problem),
  }))

  await writeFile(join(outDir, 'double-atari.json'), JSON.stringify(bank, null, 2))
  console.log(`Generados ${bank.length} problemas de doble atari.`)
}

main()
