import { describe, expect, it } from 'vitest'
import { createBoard, toPoint } from '../../src/core/board'
import { applyMove, gameStateFromBoard } from '../../src/core/rules'
import { BLACK, WHITE } from '../../src/core/types'
import type { BoardState, Color } from '../../src/core/types'
import { raceBehindColor, sharedLibertiesOf } from '../../src/solver/semeai'

const SIZE = 9
const p = (x: number, y: number) => toPoint(SIZE, x, y)

function place(board: BoardState, color: Color, points: Array<[number, number]>): void {
  for (const [x, y] of points) board.stones[toPoint(board.width, x, y)] = color
}

/** Dos cadenas verticales rectas, columnas 3 y 5 (hueco de una sola columna
 * en medio), mismo mecanismo que tools/generate-semeai-liberty-problems.ts. */
function buildRace(lenA: number, lenB: number): { board: BoardState; groupAPoint: number; groupBPoint: number } {
  const board = createBoard(SIZE)
  for (let i = 0; i < lenA; i++) board.stones[p(3, 2 + i)] = BLACK
  for (let i = 0; i < lenB; i++) board.stones[p(5, 2 + i)] = WHITE
  return { board, groupAPoint: p(3, 2), groupBPoint: p(5, 2) }
}

describe('raceBehindColor', () => {
  it('el grupo con menos libertades totales va perdiendo', () => {
    const { board, groupAPoint, groupBPoint } = buildRace(1, 4)
    expect(raceBehindColor(board, groupAPoint, groupBPoint)).toBe(BLACK)
  })

  it('libertades empatadas: null, no hay respuesta mecanica (depende de quien juega primero)', () => {
    const { board, groupAPoint, groupBPoint } = buildRace(2, 2)
    expect(raceBehindColor(board, groupAPoint, groupBPoint)).toBeNull()
  })

  it('null si alguno de los dos puntos no tiene una piedra', () => {
    const board = createBoard(SIZE)
    place(board, BLACK, [[3, 2]])
    expect(raceBehindColor(board, p(3, 2), p(5, 2))).toBeNull()
  })

  // Brecha de una sola libertad: raceBehindColor igual devuelve una
  // respuesta (compara numeros nada mas, sin juzgar si la brecha alcanza
  // para confiar en ella). tools/generate-semeai-liberty-problems.ts exige
  // una brecha >= 2 ademas de esto antes de aceptar un problema para
  // CONTAR_LIBERTADES_ANTES_DE_JUGAR, y encima confirma el resultado
  // jugando la carrera de verdad (ver su propio simulateRace) -- este
  // archivo no repite esa simulacion completa, solo documenta que a esta
  // funcion sola no le alcanza para ese estandar.
  it('brecha de 1: sigue dando una respuesta (la brecha minima confiable la exige el generador, no esta funcion)', () => {
    const { board, groupAPoint, groupBPoint } = buildRace(2, 3)
    expect(raceBehindColor(board, groupAPoint, groupBPoint)).toBe(BLACK)
  })
})

describe('sharedLibertiesOf', () => {
  it('la columna del hueco es libertad de los dos grupos a la vez', () => {
    const { board, groupAPoint, groupBPoint } = buildRace(2, 2)
    const shared = sharedLibertiesOf(board, groupAPoint, groupBPoint)
    expect(shared).not.toBeNull()
    expect(Array.from(shared ?? []).sort((a, b) => a - b)).toEqual([p(4, 2), p(4, 3)].sort((a, b) => a - b))
  })

  it('sin hueco compartido (grupos lejos entre si) no hay libertades compartidas', () => {
    const board = createBoard(SIZE)
    place(board, BLACK, [[0, 0]])
    place(board, WHITE, [[8, 8]])
    const shared = sharedLibertiesOf(board, p(0, 0), p(8, 8))
    expect(shared?.size).toBe(0)
  })

  it('null si alguno de los dos puntos no tiene una piedra', () => {
    const board = createBoard(SIZE)
    place(board, BLACK, [[3, 2]])
    expect(sharedLibertiesOf(board, p(3, 2), p(5, 2))).toBeNull()
  })
})

describe('un grupo con un ojo real no deberia compararse por conteo simple de libertades', () => {
  it('el punto del ojo real es ilegal para el rival (suicidio), aunque raceBehindColor lo cuente como una libertad mas', () => {
    // Anillo negro de 8 piedras alrededor de un punto real (ojo verdadero):
    // mismo mecanismo que EYE_BOARD en content/lessons/n10.ts. raceBehindColor
    // (conteo simple de getGroup) no distingue este punto de cualquier otra
    // libertad -- exactamente el motivo por el que
    // generate-semeai-liberty-problems.ts filtra estas posiciones con
    // computeAreaOwnership antes de confiar en el conteo (ver UN_OJO_GANA,
    // fuera de alcance de CONTAR_LIBERTADES_ANTES_DE_JUGAR). Se demuestra
    // aca contra el motor real, no solo se afirma: blanco no puede jugar en
    // el ojo, es suicidio puro.
    const board = createBoard(SIZE)
    const ring: Array<[number, number]> = [
      [2, 1], [3, 1], [4, 1],
      [2, 2], [4, 2],
      [2, 3], [3, 3], [4, 3],
    ]
    place(board, BLACK, ring)
    const eyePoint = p(3, 2)

    const state = gameStateFromBoard(board, WHITE)
    const result = applyMove(state, eyePoint)

    expect(result.legal).toBe(false)
    expect(result.reason).toBe('suicide')
  })
})
