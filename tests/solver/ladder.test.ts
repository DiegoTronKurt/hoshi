import { describe, expect, it } from 'vitest'
import ladderBank from '../../src/content/problems/ladders.json'
import { sgfToLadderProblem } from '../../src/content/ladderProblem'
import { createBoard, toPoint } from '../../src/core/board'
import { BLACK, WHITE } from '../../src/core/types'
import type { BoardState, Color } from '../../src/core/types'
import { simulateLadder, solveLadder } from '../../src/solver/ladder'

function place(board: BoardState, color: Color, points: Array<[number, number]>): void {
  for (const [x, y] of points) {
    board.stones[toPoint(board.width, x, y)] = color
  }
}

// Una piedra negra en atari, con dos libertades hacia la esquina superior
// izquierda. Sin nada mas en el tablero, perseguirla hacia la esquina la
// atrapa: cada vez que blanco reduce sus libertades, la unica extension
// posible la deja igual de acorralada, hasta que la esquina no le deja mas
// espacio.
describe('solucionador de escaleras', () => {
  it('captura al grupo que huye hacia la esquina cuando no hay rompedor', () => {
    const board = createBoard(9)
    place(board, BLACK, [[1, 1]])
    place(board, WHITE, [[2, 1], [1, 2]])

    const result = solveLadder({
      board,
      runnerPoint: toPoint(9, 1, 1),
      chaserColor: WHITE,
    })

    expect(result.captured).toBe(true)
    expect(result.reason).toBe('captured')
    expect(result.moves.length).toBeGreaterThan(0)
  })

  it('escapa si una piedra propia (rompedor) ya le da mas libertades', () => {
    const board = createBoard(9)
    place(board, BLACK, [[1, 1]])
    place(board, WHITE, [[2, 1], [1, 2]])
    place(board, BLACK, [[1, 0]]) // rompedor: se conecta de entrada y da una tercera libertad

    const result = solveLadder({
      board,
      runnerPoint: toPoint(9, 1, 1),
      chaserColor: WHITE,
    })

    expect(result.captured).toBe(false)
    expect(result.reason).toBe('escaped')
  })

  it('un grupo que ya tiene varias libertades no es una escalera forzable', () => {
    const board = createBoard(9)
    place(board, BLACK, [[4, 4]])
    place(board, WHITE, [[3, 4], [4, 3]])

    const result = solveLadder({
      board,
      runnerPoint: toPoint(9, 4, 4),
      chaserColor: WHITE,
      maxMoves: 30,
    })

    expect(result.captured).toBe(false)
  })

  it('captura incluso cuando la unica libertad restante seria suicidio para el que huye', () => {
    // Rincon cerrado por delante: si el que huye intentara jugar su unica
    // libertad quedaria en autoatari, asi que solveLadder(), llamado una
    // sola vez desde ese punto, no encuentra ninguna jugada legal para el y
    // cae en la rama de "ya esta capturado" con moves:[] -- aunque las
    // piedras siguen en el tablero y el perseguidor todavia tiene que jugar
    // ahi. Este es justo el caso que dejaba el ejercicio interactivo
    // trabado en "resuelto" con las piedras del que huye todavia dibujadas.
    const board = createBoard(9)
    place(board, BLACK, [[1, 7], [1, 8]])
    place(board, WHITE, [[2, 7], [2, 8], [1, 6]])

    const runnerPoint = toPoint(9, 1, 7)
    const direct = solveLadder({ board, runnerPoint, chaserColor: WHITE })
    expect(direct.captured).toBe(true)
    expect(direct.moves.length).toBeGreaterThan(0) // el propio bloqueo ya es la jugada capturadora

    const step = simulateLadder({ board, runnerPoint, chaserColor: WHITE })
    expect(step.captured).toBe(true)
    expect(step.chaserMoves.length).toBeGreaterThan(0)
  })

  it('el banco de escaleras siempre termina con el grupo realmente fuera del tablero', () => {
    for (const entry of ladderBank as { id: string; sgf: string }[]) {
      const problem = sgfToLadderProblem(entry.sgf)
      const step = simulateLadder({
        board: problem.board,
        runnerPoint: problem.runnerPoint,
        chaserColor: problem.chaserColor,
      })
      expect(step.captured, `${entry.id}: solveLadder dice que no se captura`).toBe(true)
      expect(step.chaserMoves.length, `${entry.id}: sin jugadas del perseguidor`).toBeGreaterThan(0)
    }
  })
})
