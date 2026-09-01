/**
 * Genera el banco de problemas de escalera (ESCALERA), separado del banco
 * principal de tsumego porque usa solveLadder en vez de solve() (ver
 * content/ladderProblem.ts para el porque). Un puñado de plantillas de
 * contacto cerca de una esquina o borde, verificadas con solveLadder y
 * multiplicadas por las 8 transformaciones diedrales, igual que se hace en
 * content/seeds.ts para geta y snapback.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BOARD_TRANSFORMS, createBoard, toPoint, transformBoard, transformPoint } from '../src/core/board'
import { BLACK, WHITE } from '../src/core/types'
import type { BoardState, Color } from '../src/core/types'
import { solveLadder } from '../src/solver/ladder'
import { ladderProblemToSgf } from '../src/content/ladderProblem'
import type { LadderProblem } from '../src/content/ladderProblem'

const SIZE = 9

interface Template {
  board: BoardState
  runnerPoint: number
  chaserColor: Color
}

/** Contacto simple cerca de la esquina (0,0): negro huye, blanco persigue. */
function template1(): Template {
  const board = createBoard(SIZE)
  board.stones[toPoint(SIZE, 1, 1)] = BLACK
  board.stones[toPoint(SIZE, 2, 1)] = WHITE
  board.stones[toPoint(SIZE, 1, 2)] = WHITE
  return { board, runnerPoint: toPoint(SIZE, 1, 1), chaserColor: WHITE }
}

/** Contacto un poco mas lejos de la esquina, con una piedra perseguidora
 * ya puesta en diagonal (fuerza al que huye hacia la esquina desde antes). */
function template2(): Template {
  const board = createBoard(SIZE)
  board.stones[toPoint(SIZE, 2, 2)] = BLACK
  board.stones[toPoint(SIZE, 3, 2)] = WHITE
  board.stones[toPoint(SIZE, 2, 3)] = WHITE
  board.stones[toPoint(SIZE, 0, 1)] = WHITE
  return { board, runnerPoint: toPoint(SIZE, 2, 2), chaserColor: WHITE }
}

/** El que huye ya tiene una piedra conectada, grupo de 2, mismo patron de contacto. */
function template3(): Template {
  const board = createBoard(SIZE)
  board.stones[toPoint(SIZE, 1, 1)] = BLACK
  board.stones[toPoint(SIZE, 1, 0)] = BLACK
  board.stones[toPoint(SIZE, 2, 1)] = WHITE
  board.stones[toPoint(SIZE, 1, 2)] = WHITE
  board.stones[toPoint(SIZE, 2, 0)] = WHITE
  return { board, runnerPoint: toPoint(SIZE, 1, 1), chaserColor: WHITE }
}

async function main() {
  const templates = [template1(), template2(), template3()]
  const problems: LadderProblem[] = []
  const seen = new Set<string>()

  for (const template of templates) {
    for (const transform of BOARD_TRANSFORMS) {
      const board = transformBoard(template.board, transform)
      const runnerPoint = transformPoint(SIZE, template.runnerPoint, transform)

      const key = board.stones.join('')
      if (seen.has(key)) continue
      seen.add(key)

      const result = solveLadder({ board, runnerPoint, chaserColor: template.chaserColor })
      if (!result.captured) continue // nunca se acepta sin que solveLadder lo reconfirme

      problems.push({ conceptId: 'ESCALERA', board, runnerPoint, chaserColor: template.chaserColor })
    }
  }

  const root = dirname(fileURLToPath(import.meta.url))
  const outDir = join(root, '..', 'src', 'content', 'problems')
  await mkdir(outDir, { recursive: true })

  const bank = problems.map((problem, index) => ({
    id: `ladder${index + 1}`,
    conceptId: problem.conceptId,
    sgf: ladderProblemToSgf(problem),
  }))

  await writeFile(join(outDir, 'ladders.json'), JSON.stringify(bank, null, 2))
  console.log(`Generados ${bank.length} problemas de escalera.`)
}

main()
