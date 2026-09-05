import { describe, expect, it } from 'vitest'
import { createBoard, toPoint } from '../../src/core/board'
import { BLACK, WHITE } from '../../src/core/types'
import { semeaiLibertyProblemToSgf, sgfToSemeaiLibertyProblem } from '../../src/content/semeaiLibertyProblem'
import type { SemeaiLibertyProblem } from '../../src/content/semeaiLibertyProblem'
import { raceBehindColor, sharedLibertiesOf } from '../../src/solver/semeai'

const SIZE = 9
const p = (x: number, y: number) => toPoint(SIZE, x, y)

function sampleProblem(conceptId: SemeaiLibertyProblem['conceptId']): SemeaiLibertyProblem {
  const board = createBoard(SIZE)
  board.stones[p(3, 2)] = BLACK
  board.stones[p(5, 2)] = WHITE
  board.stones[p(5, 3)] = WHITE
  return { conceptId, board, toMove: BLACK, groupAPoint: p(3, 2), groupBPoint: p(5, 2) }
}

describe('SemeaiLibertyProblem SGF', () => {
  it('ida y vuelta conserva el tablero, el color a mover y los dos puntos de grupo', () => {
    const original = sampleProblem('CONTAR_LIBERTADES_ANTES_DE_JUGAR')
    const sgf = semeaiLibertyProblemToSgf(original)
    const restored = sgfToSemeaiLibertyProblem(sgf)

    expect(restored.conceptId).toBe('CONTAR_LIBERTADES_ANTES_DE_JUGAR')
    expect(restored.toMove).toBe(BLACK)
    expect(restored.groupAPoint).toBe(original.groupAPoint)
    expect(restored.groupBPoint).toBe(original.groupBPoint)
    expect(Array.from(restored.board.stones)).toEqual(Array.from(original.board.stones))
  })

  it('conserva el conceptId de LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO por separado', () => {
    const original = sampleProblem('LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO')
    const restored = sgfToSemeaiLibertyProblem(semeaiLibertyProblemToSgf(original))
    expect(restored.conceptId).toBe('LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO')
  })

  it('el problema restaurado sigue siendo una carrera valida segun solver/semeai.ts', () => {
    const original = sampleProblem('CONTAR_LIBERTADES_ANTES_DE_JUGAR')
    const restored = sgfToSemeaiLibertyProblem(semeaiLibertyProblemToSgf(original))

    expect(raceBehindColor(restored.board, restored.groupAPoint, restored.groupBPoint)).toBe(BLACK)
    expect(sharedLibertiesOf(restored.board, restored.groupAPoint, restored.groupBPoint)?.has(p(4, 2))).toBe(true)
  })
})
