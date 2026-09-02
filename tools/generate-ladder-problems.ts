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
import { simulateLadder, solveLadder } from '../src/solver/ladder'
import { ladderProblemToSgf } from '../src/content/ladderProblem'
import type { LadderProblem } from '../src/content/ladderProblem'
import { difficultyFromDepth } from '../src/content/difficulty'

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

/** Mismo patron de contacto que template1, corrido una columna mas lejos de
 * la esquina: variedad de posicion real, no solo una transformacion diedral
 * de una plantilla ya existente. */
function template4(): Template {
  const board = createBoard(SIZE)
  board.stones[toPoint(SIZE, 2, 1)] = BLACK
  board.stones[toPoint(SIZE, 3, 1)] = WHITE
  board.stones[toPoint(SIZE, 2, 2)] = WHITE
  return { board, runnerPoint: toPoint(SIZE, 2, 1), chaserColor: WHITE }
}

/** Grupo de 2 que huye, mismo patron que template3, corrido una columna
 * hacia la esquina opuesta del tablero para dar una posicion final distinta. */
function template5(): Template {
  const board = createBoard(SIZE)
  board.stones[toPoint(SIZE, 2, 0)] = BLACK
  board.stones[toPoint(SIZE, 2, 1)] = BLACK
  board.stones[toPoint(SIZE, 3, 1)] = WHITE
  board.stones[toPoint(SIZE, 2, 2)] = WHITE
  board.stones[toPoint(SIZE, 3, 0)] = WHITE
  return { board, runnerPoint: toPoint(SIZE, 2, 0), chaserColor: WHITE }
}

/**
 * Escalera mas larga, a pedido explicito (hasta ahora ninguna del banco
 * pasaba de 4 jugadas del perseguidor). Primer intento (trasladar el
 * contacto minimo de template1 lejos de la esquina, sin nada mas) fallo: el
 * solucionador de este proyecto declara "escapado" apenas el grupo llega a
 * 3 libertades (ver ESCAPE_LIBERTY_THRESHOLD en solver/ladder.ts, una
 * simplificacion documentada de "escalera simple"), y una piedra recien
 * extendida en medio de un tablero vacio siempre gana una tercera libertad
 * de inmediato -- por eso template1 solo funciona porque a un paso de la
 * esquina el propio borde ya le quita esa tercera libertad gratis. Lejos
 * del borde hace falta reponer esa funcion a mano: dos piedras blancas mas,
 * puestas de entrada en las libertades "de costado" que la primera
 * extension abriria, cumplen el mismo papel que el borde cumple en la
 * esquina. Verificado con solveLadder antes de aceptar esta explicacion:
 * sin las dos piedras extra escapa a los 2 movimientos, con ellas captura
 * en 6.
 */
function template6(): Template {
  const board = createBoard(SIZE)
  board.stones[toPoint(SIZE, 3, 3)] = BLACK
  board.stones[toPoint(SIZE, 4, 3)] = WHITE
  board.stones[toPoint(SIZE, 3, 4)] = WHITE
  board.stones[toPoint(SIZE, 2, 4)] = WHITE
  board.stones[toPoint(SIZE, 4, 2)] = WHITE
  return { board, runnerPoint: toPoint(SIZE, 3, 3), chaserColor: WHITE }
}

async function main() {
  const templates = [template1(), template2(), template3(), template4(), template5(), template6()]
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

  const bank = problems.map((problem, index) => {
    const step = simulateLadder({ board: problem.board, runnerPoint: problem.runnerPoint, chaserColor: problem.chaserColor })
    return {
      id: `ladder${index + 1}`,
      conceptId: problem.conceptId,
      sgf: ladderProblemToSgf(problem),
      difficulty: difficultyFromDepth(step.captured ? step.chaserMoves.length : null),
    }
  })

  await writeFile(join(outDir, 'ladders.json'), JSON.stringify(bank, null, 2))
  console.log(`Generados ${bank.length} problemas de escalera.`)

  const byDifficulty: Record<string, number> = {}
  for (const p of bank) byDifficulty[p.difficulty] = (byDifficulty[p.difficulty] ?? 0) + 1
  console.log('Por dificultad:', byDifficulty)
}

main()
