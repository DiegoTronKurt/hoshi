import { describe, expect, it } from 'vitest'
import { encodeInput } from '../../src/eval/features'
import { createBoard, toPoint } from '../../src/core/board'
import { applyMove, createGame, gameStateFromBoard } from '../../src/core/rules'
import { BLACK, WHITE } from '../../src/core/types'
import type { GameState } from '../../src/core/types'

function readCell(spatial: Float32Array, x: number, y: number, channel: number): number {
  return spatial[(y * 19 + x) * 22 + channel]
}

function play(state: GameState, x: number, y: number): GameState {
  const result = applyMove(state, toPoint(state.board.width, x, y))
  if (!result.legal || !result.state) throw new Error(`jugada ilegal en (${x},${y}): ${result.reason}`)
  return result.state
}

// Cada propiedad verificada aca se corrio primero en un script de
// depuracion contra casos ya conocidos de otros tests (ko-superko.test.ts,
// ladder.test.ts, scoring.test.ts) antes de escribirla como asercion -- ver
// NOTAS.md. Un bug real se encontro asi: la primera version de
// findSuperKoBannedPoints armaba un historial sintetico de un solo hash,
// que nunca podia detectar un ko real (la posicion que se recrearia es
// anterior a la actual, no la actual misma).
describe('encodeInput (features V7 de KataGo, reconstruidas)', () => {
  it('marca "en tablero" solo los puntos reales, y arma los globales fijos de la configuracion de reglas de Hoshi', () => {
    const state = createGame(9, 9, 6.5)
    const enc = encodeInput({ state })

    let onBoardCount = 0
    for (let y = 0; y < 19; y++) for (let x = 0; x < 19; x++) if (readCell(enc.spatial, x, y, 0) === 1) onBoardCount++
    expect(onBoardCount).toBe(81)

    expect(enc.global[5]).toBeCloseTo(-6.5 / 20) // selfKomi desde la perspectiva de negro: negativo
    expect(enc.global[6]).toBe(1) // regla de ko: superko posicional
    expect(enc.global[7]).toBe(0.5)
    expect(enc.global[8]).toBe(0) // suicidio: nunca permitido
    expect(enc.global[9]).toBe(0) // conteo: siempre area (chinas)
    expect(enc.global[10]).toBe(0) // sin impuesto de grupo
    expect(enc.global[11]).toBe(0)
    expect(enc.global[12]).toBe(0) // sin fase de encore
    expect(enc.global[13]).toBe(0)
    expect(enc.global[14]).toBe(0) // nadie paso todavia
    expect(enc.global[15]).toBe(0) // sin sesgo de handicap
    expect(enc.global[16]).toBe(0)
    expect(enc.global[17]).toBe(0) // sin boton
  })

  it('marca piedra propia/rival y libertades 1-3 correctamente', () => {
    const board = createBoard(9)
    board.stones[toPoint(9, 4, 4)] = BLACK
    board.stones[toPoint(9, 3, 4)] = WHITE
    board.stones[toPoint(9, 5, 4)] = WHITE
    board.stones[toPoint(9, 4, 3)] = WHITE
    // (4,5) libre: la piedra negra queda con exactamente 1 libertad (atari)
    const state = gameStateFromBoard(board, BLACK, 0)
    const enc = encodeInput({ state })

    expect(readCell(enc.spatial, 4, 4, 1)).toBe(1) // piedra propia
    expect(readCell(enc.spatial, 4, 4, 3)).toBe(1) // 1 libertad
    expect(readCell(enc.spatial, 4, 4, 4)).toBe(0)
    expect(readCell(enc.spatial, 4, 4, 5)).toBe(0)
    expect(readCell(enc.spatial, 3, 4, 2)).toBe(1) // piedra rival
  })

  it('marca el punto de ko real vetado por superko, no cualquier punto vacio', () => {
    let state = createGame(5, 5, 0)
    state = play(state, 1, 2)
    state = play(state, 2, 2)
    state = play(state, 2, 1)
    state = play(state, 4, 2)
    state = play(state, 2, 3)
    state = play(state, 3, 1)
    state = play(state, 0, 0)
    state = play(state, 3, 3)
    const captured = applyMove(state, toPoint(5, 3, 2))
    state = captured.state as GameState

    const enc = encodeInput({ state })
    expect(readCell(enc.spatial, 2, 2, 6)).toBe(1) // el punto de ko real
    expect(readCell(enc.spatial, 0, 4, 6)).toBe(0) // control: punto lejano, no vetado
  })

  it('marca una escalera activa (misma forma verificada en solver/ladder.test.ts)', () => {
    const board = createBoard(9)
    board.stones[toPoint(9, 1, 1)] = BLACK
    board.stones[toPoint(9, 2, 1)] = WHITE
    board.stones[toPoint(9, 1, 2)] = WHITE
    const state = gameStateFromBoard(board, WHITE, 0)

    const enc = encodeInput({ state })
    expect(readCell(enc.spatial, 1, 1, 14)).toBe(1)
  })

  it('no marca ninguna escalera cuando el grupo ya escapo', () => {
    const board = createBoard(9)
    board.stones[toPoint(9, 4, 4)] = BLACK
    board.stones[toPoint(9, 3, 4)] = WHITE
    board.stones[toPoint(9, 4, 3)] = WHITE
    const state = gameStateFromBoard(board, WHITE, 0)

    const enc = encodeInput({ state })
    expect(readCell(enc.spatial, 4, 4, 14)).toBe(0)
  })

  it('codifica las ultimas jugadas en los canales espaciales correctos, alternando color', () => {
    const board = createBoard(9)
    board.stones[toPoint(9, 2, 2)] = BLACK
    board.stones[toPoint(9, 6, 6)] = WHITE
    const state = gameStateFromBoard(board, BLACK, 0)

    const enc = encodeInput({
      state,
      recentMoves: [
        { color: BLACK, point: toPoint(9, 2, 2) },
        { color: WHITE, point: toPoint(9, 6, 6) },
      ],
    })
    expect(readCell(enc.spatial, 6, 6, 9)).toBe(1) // jugada -1: blanco
    expect(readCell(enc.spatial, 2, 2, 10)).toBe(1) // jugada -2: negro
  })

  it('un pase marca el canal global correspondiente, no un canal espacial', () => {
    const board = createBoard(9)
    const state = gameStateFromBoard(board, BLACK, 0)
    const enc = encodeInput({ state, recentMoves: [{ color: WHITE, point: null }] })
    expect(enc.global[0]).toBe(1)
  })

  it('territorio (canales 18/19) coincide con computeAreaOwnership', () => {
    const board = createBoard(5)
    for (const [x, y] of [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1]] as const) {
      board.stones[toPoint(5, x, y)] = BLACK
    }
    for (const [x, y] of [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]] as const) {
      board.stones[toPoint(5, x, y)] = WHITE
    }
    const state = gameStateFromBoard(board, BLACK, 0)
    const enc = encodeInput({ state })

    expect(readCell(enc.spatial, 2, 1, 18)).toBe(1) // territorio propio (negro)
    expect(readCell(enc.spatial, 2, 3, 19)).toBe(1) // territorio rival (blanco)
    expect(readCell(enc.spatial, 2, 2, 18)).toBe(0) // fila neutral (dame)
    expect(readCell(enc.spatial, 2, 2, 19)).toBe(0)
  })

  it('pase con historial vacio o corto no revienta, degrada a "sin historial"', () => {
    const state = createGame(9, 9, 0)
    expect(() => encodeInput({ state })).not.toThrow()
    expect(() => encodeInput({ state, recentMoves: [] })).not.toThrow()
  })

  it('funciona en un tablero rectangular (9x13, nivel Forma), acomodado en la esquina de la grilla fija 19x19', () => {
    const board = createBoard(9, 13)
    board.stones[toPoint(9, 0, 0)] = BLACK
    const state = gameStateFromBoard(board, WHITE, 0)
    const enc = encodeInput({ state })

    let onBoardCount = 0
    for (let y = 0; y < 19; y++) for (let x = 0; x < 19; x++) if (readCell(enc.spatial, x, y, 0) === 1) onBoardCount++
    expect(onBoardCount).toBe(9 * 13)
    expect(readCell(enc.spatial, 0, 0, 2)).toBe(1) // piedra rival (blanco a jugar)
    expect(readCell(enc.spatial, 9, 0, 0)).toBe(0) // justo afuera del ancho real: fuera de tablero
  })
})
