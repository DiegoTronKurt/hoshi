import { describe, expect, it } from 'vitest'
import { toPoint } from '../../src/core/board'
import { applyMove, createGame } from '../../src/core/rules'
import { gameRecordToSgf, parseSgf, pointToSgf, sgfToGameRecord, sgfToPoint, writeSgf } from '../../src/core/sgf'
import type { RecordedMove } from '../../src/core/sgf'
import type { GameState } from '../../src/core/types'

describe('SGF', () => {
  it('conserva propiedades genericas en un round trip: leer, escribir, releer', () => {
    const original = parseSgf(
      '(;GM[1]FF[4]SZ[9]KM[6.5]RU[Chinese]AB[cd][ee]AW[gg];B[cc]C[Primera jugada]LB[cc:A]TR[dd]SQ[ee])',
    )
    const reparsed = parseSgf(writeSgf(original))

    expect(reparsed).toEqual(original)
    expect(reparsed.root.properties.SZ).toEqual(['9'])
    expect(reparsed.root.properties.AB).toEqual(['cd', 'ee'])
    expect(reparsed.root.properties.AW).toEqual(['gg'])

    const child = reparsed.root.children[0]
    expect(child.properties.B).toEqual(['cc'])
    expect(child.properties.C).toEqual(['Primera jugada'])
    expect(child.properties.LB).toEqual(['cc:A'])
    expect(child.properties.TR).toEqual(['dd'])
    expect(child.properties.SQ).toEqual(['ee'])
  })

  it('una partida jugada, guardada en SGF y vuelta a leer reproduce la misma posicion', () => {
    let state = createGame(9, 9, 6.5)
    const moves: RecordedMove[] = []

    function play(point: number | null): void {
      const color = state.toMove
      const result = applyMove(state, point)
      if (!result.legal || !result.state) {
        throw new Error('jugada ilegal al construir la partida de prueba')
      }
      state = result.state
      moves.push({ color, point })
    }

    play(toPoint(9, 2, 2))
    play(toPoint(9, 6, 6))
    play(toPoint(9, 2, 3))
    play(null) // blanco pasa
    play(toPoint(9, 3, 2))

    const sgfText = gameRecordToSgf(9, 9, 6.5, moves)
    const parsed = sgfToGameRecord(sgfText)

    expect(parsed.width).toBe(9)
    expect(parsed.height).toBe(9)
    expect(parsed.komi).toBe(6.5)
    expect(parsed.moves).toEqual(moves)

    let replay: GameState = createGame(parsed.width, parsed.height, parsed.komi)
    for (const move of parsed.moves) {
      const result = applyMove(replay, move.point)
      if (!result.legal || !result.state) {
        throw new Error('la partida reproducida desde SGF tiene una jugada ilegal')
      }
      replay = result.state
    }

    expect(Array.from(replay.board.stones)).toEqual(Array.from(state.board.stones))
    expect(replay.captures).toEqual(state.captures)
  })

  it('las coordenadas de la ultima fila/columna hacen ida y vuelta en 13x13 y 19x19', () => {
    // v1.5 (roadmap maestro, seccion 8): red de seguridad barata a tamanos
    // todavia sin ejercitar -- el punto mas lejano del origen es el que
    // ejercita el limite real de COORDINATE_LETTERS (26 letras).
    for (const size of [13, 19]) {
      const points = [toPoint(size, 0, 0), toPoint(size, size - 1, size - 1), toPoint(size, size - 1, 0)]
      for (const point of points) {
        const coord = pointToSgf(size, point)
        expect(sgfToPoint(size, coord)).toBe(point)
      }
    }
  })
})
