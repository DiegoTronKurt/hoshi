import { describe, expect, it } from 'vitest'
import { createBoard, toPoint } from '../../src/core/board'
import { BLACK, WHITE } from '../../src/core/types'
import type { BoardState, Color } from '../../src/core/types'
import { computeRegion } from '../../src/solver/region'
import { solve } from '../../src/solver/tsumego'

function place(board: BoardState, color: Color, points: Array<[number, number]>): void {
  for (const [x, y] of points) {
    board.stones[toPoint(board.size, x, y)] = color
  }
}

/**
 * Construye un tablero donde `wall` (negro) rodea completamente `eyespace`
 * (vacio), y todo el resto del tablero es blanco. Es la forma estandar de
 * plantear un problema de vida y muerte de esquina/borde: el grupo objetivo
 * queda acotado, y el resto del tablero pertenece claramente al rival, sin
 * el vacio sin dueño que distorsionaria el analisis de Benson.
 */
function buildEnclosedShape(size: number, wall: Array<[number, number]>, eyespace: Array<[number, number]>) {
  const board = createBoard(size)
  for (let p = 0; p < board.stones.length; p++) board.stones[p] = WHITE
  place(board, BLACK, wall)
  for (const [x, y] of eyespace) board.stones[toPoint(size, x, y)] = 0
  return { board, wallPoints: wall.map(([x, y]) => toPoint(size, x, y)) }
}

describe('solucionador de vida y muerte: formas clasicas verificadas', () => {
  // Recta de tres: tres puntos vacios en linea. Es un hecho establecido de
  // teoria de Go que esta forma vive si el dueno juega primero el punto
  // central (separa el espacio en dos ojos reales) y muere si el rival juega
  // primero ese mismo punto central (el espacio termina reducido a un solo
  // ojo real, insuficiente para vivir).
  describe('recta de tres', () => {
    const { board, wallPoints } = buildEnclosedShape(
      9,
      [
        [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
        [2, 4], [6, 4],
        [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
      ],
      [[3, 4], [4, 4], [5, 4]],
    )
    const region = computeRegion(board, wallPoints, 1)

    it('negro vive si juega primero el punto central', () => {
      const result = solve({
        board,
        region,
        targetPoints: wallPoints,
        targetColor: BLACK,
        toMove: BLACK,
        objective: 'live',
        maxDepth: 6,
      })
      expect(result.solved).toBe(true)
    })

    it('blanco mata si juega primero el punto central', () => {
      const result = solve({
        board,
        region,
        targetPoints: wallPoints,
        targetColor: BLACK,
        toMove: WHITE,
        objective: 'kill',
        maxDepth: 6,
      })
      expect(result.solved).toBe(true)
    })
  })

  // Cuadrado de cuatro: un bloque de 2x2 puntos vacios. Es una forma muerta
  // incondicional: no importa quien juegue primero, el defensor termina con
  // un solo ojo real. Si el defensor juega primero, reduce el espacio a una
  // forma de tres en L, pero le pasa el turno al rival sobre esa forma
  // reducida, que la mata igual que a la recta de tres.
  describe('cuadrado de cuatro', () => {
    const { board, wallPoints } = buildEnclosedShape(
      9,
      [
        [2, 3], [3, 3], [4, 3], [5, 3],
        [2, 4], [5, 4],
        [2, 5], [5, 5],
        [2, 6], [3, 6], [4, 6], [5, 6],
      ],
      [[3, 4], [4, 4], [3, 5], [4, 5]],
    )
    const region = computeRegion(board, wallPoints, 1)

    it('negro no puede vivir ni jugando primero', () => {
      const result = solve({
        board,
        region,
        targetPoints: wallPoints,
        targetColor: BLACK,
        toMove: BLACK,
        objective: 'live',
        maxDepth: 6,
      })
      expect(result.solved).toBe(false)
    })

    it('blanco mata sin importar que negro juegue primero', () => {
      const result = solve({
        board,
        region,
        targetPoints: wallPoints,
        targetColor: BLACK,
        toMove: WHITE,
        objective: 'kill',
        maxDepth: 6,
      })
      expect(result.solved).toBe(true)
    })
  })

  it('un grupo con dos ojos separados ya formados vive sin necesidad de jugar', () => {
    const { board, wallPoints } = buildEnclosedShape(
      9,
      [
        [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
        [2, 4], [4, 4], [6, 4],
        [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
      ],
      [[3, 4], [5, 4]],
    )
    const region = computeRegion(board, wallPoints, 1)

    const result = solve({
      board,
      region,
      targetPoints: wallPoints,
      targetColor: BLACK,
      toMove: WHITE,
      objective: 'kill',
    })
    expect(result.solved).toBe(false)
  })
})
