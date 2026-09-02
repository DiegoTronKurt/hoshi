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

/** Dos grupos de una piedra, separados verticalmente por el punto compartido
 * (mismo mecanismo que template1, pero orientado vertical y en otra zona del
 * tablero, para dar una posicion final realmente distinta). */
function template4(): Template {
  const board = createBoard(SIZE)
  board.stones[toPoint(SIZE, 6, 3)] = WHITE
  board.stones[toPoint(SIZE, 6, 5)] = WHITE
  board.stones[toPoint(SIZE, 5, 3)] = BLACK
  board.stones[toPoint(SIZE, 7, 3)] = BLACK
  board.stones[toPoint(SIZE, 5, 5)] = BLACK
  board.stones[toPoint(SIZE, 7, 5)] = BLACK
  return { board, color: BLACK }
}

/** Corte en angulo recto: un grupo arriba del punto compartido, el otro a la
 * derecha -- la forma de doble atari mas comun en una partida real, en vez
 * de dos grupos enfrentados en linea recta como en las plantillas 1 y 4. */
function template5(): Template {
  const board = createBoard(SIZE)
  board.stones[toPoint(SIZE, 2, 5)] = WHITE
  board.stones[toPoint(SIZE, 3, 6)] = WHITE
  board.stones[toPoint(SIZE, 1, 5)] = BLACK
  board.stones[toPoint(SIZE, 2, 4)] = BLACK
  board.stones[toPoint(SIZE, 4, 6)] = BLACK
  board.stones[toPoint(SIZE, 3, 7)] = BLACK
  return { board, color: BLACK }
}

/** Mismo mecanismo de contacto que template1 (una piedra blanca con 2
 * libertades compartiendo el punto con otra igual), mas piedras sueltas
 * lejos de ahi, cada una aislada con 4 libertades propias -- no participan
 * de ningun atari, solo hacen mas dificil ubicar a simple vista cual es el
 * punto real. A pedido explicito de mas dificultad: hasta ahora ningun
 * tablero de doble atari tenia relleno alrededor de la jugada. */
function template6(): Template {
  const board = createBoard(SIZE)
  board.stones[toPoint(SIZE, 4, 4)] = WHITE
  board.stones[toPoint(SIZE, 3, 4)] = BLACK
  board.stones[toPoint(SIZE, 4, 3)] = BLACK
  board.stones[toPoint(SIZE, 6, 4)] = WHITE
  board.stones[toPoint(SIZE, 7, 4)] = BLACK
  board.stones[toPoint(SIZE, 6, 3)] = BLACK
  // Piedras sueltas, cada una aislada (4 libertades, sin ningun vecino):
  // ruido visual, verificado abajo que no agregan otro punto de doble atari.
  board.stones[toPoint(SIZE, 1, 1)] = BLACK
  board.stones[toPoint(SIZE, 7, 1)] = WHITE
  board.stones[toPoint(SIZE, 1, 7)] = WHITE
  return { board, color: BLACK }
}

async function main() {
  const templates = [template1(), template2(), template3(), template4(), template5(), template6()]
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
    // Reconocimiento de una sola jugada, siempre "facil" en el mismo sentido
    // que CAPTURA_SIMPLE: la dificultad de template6 es visual (mas piedras
    // en el tablero), no de lectura, y esta etiqueta mide lectura.
    difficulty: 'easy' as const,
  }))

  await writeFile(join(outDir, 'double-atari.json'), JSON.stringify(bank, null, 2))
  console.log(`Generados ${bank.length} problemas de doble atari.`)
}

main()
