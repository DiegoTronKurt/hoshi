import { describe, expect, it } from 'vitest'
import { classifyInfluence, estimateInfluence } from '../../src/analysis/influence'
import { createBoard, toPoint } from '../../src/core/board'
import { BLACK, EMPTY, WHITE } from '../../src/core/types'

// Propiedades verificadas contra un script de depuracion antes de escribir
// estos tests (ver NOTAS.md): no se asumio que la reconstruccion del
// algoritmo de Bouzy se comportaba como promete solo por la cita, se
// corrio y se inspecciono el resultado real primero.
describe('estimateInfluence (dilatacion/erosion tipo Bouzy)', () => {
  it('una piedra aislada, sin nada que la respalde, no gana territorio real mas alla de si misma', () => {
    const board = createBoard(9)
    const stone = toPoint(9, 4, 4)
    board.stones[stone] = BLACK

    const map = estimateInfluence(board)
    const owners = classifyInfluence(map)

    expect(map.values[stone]).toBeGreaterThan(0)
    for (let p = 0; p < owners.length; p++) {
      if (p === stone) continue
      expect(owners[p]).toBe(EMPTY)
    }
  })

  it('una pared solida y conectada si retiene influencia real a lo largo de todo el grupo', () => {
    const board = createBoard(9)
    for (let x = 0; x < 9; x++) board.stones[toPoint(9, x, 0)] = BLACK

    const map = estimateInfluence(board)
    const owners = classifyInfluence(map)

    for (let x = 0; x < 9; x++) {
      expect(owners[toPoint(9, x, 0)]).toBe(BLACK)
      expect(map.values[toPoint(9, x, 0)]).toBeGreaterThan(0)
    }
  })

  it('un punto igualmente disputado entre negro y blanco termina neutral, no de ningun color', () => {
    const board = createBoard(9)
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x <= 3; x++) board.stones[toPoint(9, x, y)] = BLACK
      for (let x = 5; x <= 8; x++) board.stones[toPoint(9, x, y)] = WHITE
    }

    const map = estimateInfluence(board)
    const owners = classifyInfluence(map)
    const centerColumn = 4

    for (let y = 0; y < 9; y++) {
      const p = toPoint(9, centerColumn, y)
      expect(map.values[p]).toBe(0)
      expect(owners[p]).toBe(EMPTY)
    }
    // Y cada lado inclina hacia su propio color, sin cruzar al otro.
    expect(owners[toPoint(9, 0, 4)]).toBe(BLACK)
    expect(owners[toPoint(9, 8, 4)]).toBe(WHITE)
  })

  it('es simetrico entre colores: negar todas las piedras niega el resultado exacto', () => {
    const board = createBoard(9)
    board.stones[toPoint(9, 4, 4)] = BLACK
    board.stones[toPoint(9, 2, 2)] = WHITE

    const mirrored = createBoard(9)
    mirrored.stones[toPoint(9, 4, 4)] = WHITE
    mirrored.stones[toPoint(9, 2, 2)] = BLACK

    const map = estimateInfluence(board)
    const mirroredMap = estimateInfluence(mirrored)

    for (let p = 0; p < map.values.length; p++) {
      expect(mirroredMap.values[p] + map.values[p]).toBe(0)
    }
  })

  it('un tablero vacio queda completamente neutral', () => {
    const board = createBoard(9)
    const map = estimateInfluence(board)
    expect(map.values.every((v) => v === 0)).toBe(true)
  })

  it('funciona igual en un tablero rectangular (9x13, nivel Forma)', () => {
    const board = createBoard(9, 13)
    for (let x = 0; x < 9; x++) board.stones[toPoint(9, x, 0)] = BLACK

    const map = estimateInfluence(board)
    expect(map.values.length).toBe(9 * 13)
    const owners = classifyInfluence(map)
    for (let x = 0; x < 9; x++) {
      expect(owners[toPoint(9, x, 0)]).toBe(BLACK)
    }
  })
})
