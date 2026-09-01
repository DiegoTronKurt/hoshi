import { describe, expect, it } from 'vitest'
import { toPoint } from '../../src/core/board'
import { BLACK, WHITE } from '../../src/core/types'
import type { RecordedMove } from '../../src/core/sgf'
import { analyzeGame } from '../../src/analysis/mistakes'

const SIZE = 9
const p = (x: number, y: number) => toPoint(SIZE, x, y)

function moves(...entries: Array<[number, number] | [number, number] | 'pass'>): RecordedMove[] {
  const result: RecordedMove[] = []
  let color = BLACK
  for (const entry of entries) {
    if (entry === 'pass') {
      result.push({ color, point: null })
    } else {
      const [x, y] = entry
      result.push({ color, point: p(x, y) })
    }
    color = color === BLACK ? WHITE : BLACK
  }
  return result
}

function has(events: ReturnType<typeof analyzeGame>, conceptId: string, moveNumber: number): boolean {
  return events.some((e) => e.conceptId === conceptId && e.moveNumber === moveNumber)
}

describe('detectores de errores', () => {
  it('ATARI_IGNORADO: un grupo en atari no se defiende y termina capturado', () => {
    const m = moves([1, 2], [0, 2], [3, 3], [1, 1], [3, 4], [1, 3], [4, 4], [2, 2])
    const events = analyzeGame(SIZE, 0, m)
    expect(has(events, 'ATARI_IGNORADO', 7)).toBe(true)
  })

  it('ATARI_IGNORADO: no se reporta como incorrecto si el grupo se defiende', () => {
    const m = moves([1, 2], [0, 2], [3, 3], [1, 1], [3, 4], [1, 3], [2, 2])
    const events = analyzeGame(SIZE, 0, m)
    expect(events.some((e) => e.conceptId === 'ATARI_IGNORADO' && e.result === 'incorrect')).toBe(false)
  })

  it('ATARI_IGNORADO: se reporta como correcto si el grupo se defiende', () => {
    const m = moves([1, 2], [0, 2], [3, 3], [1, 1], [3, 4], [1, 3], [2, 2])
    const events = analyzeGame(SIZE, 0, m)
    const event = events.find((e) => e.conceptId === 'ATARI_IGNORADO')
    expect(event?.result).toBe('correct')
    expect(event?.context).toBe('game')
    expect(event?.severity).toBeUndefined()
  })

  it('AUTOATARI: la jugada deja al propio grupo recien formado en atari sin capturar', () => {
    const m = moves([0, 0], [1, 2], [0, 1], [3, 2], [0, 2], [2, 1], [2, 2])
    const events = analyzeGame(SIZE, 0, m)
    expect(has(events, 'AUTOATARI', 7)).toBe(true)
  })

  it('AUTOATARI: no se reporta una jugada normal', () => {
    const m = moves([4, 4])
    const events = analyzeGame(SIZE, 0, m)
    expect(events.some((e) => e.conceptId === 'AUTOATARI')).toBe(false)
  })

  it('CAPTURA_PERDIDA: existia una captura y no se jugo, el grupo sobrevive', () => {
    const m = moves([1, 2], [2, 2], [3, 2], [4, 4], [2, 1], [4, 3], [0, 4], [4, 2])
    const events = analyzeGame(SIZE, 0, m)
    expect(has(events, 'CAPTURA_PERDIDA', 7)).toBe(true)
  })

  it('CAPTURA_PERDIDA: no se reporta si se juega la captura', () => {
    const m = moves([1, 2], [2, 2], [3, 2], [4, 4], [2, 1], [4, 3], [2, 3])
    const events = analyzeGame(SIZE, 0, m)
    expect(events.some((e) => e.conceptId === 'CAPTURA_PERDIDA')).toBe(false)
  })

  it('RELLENO_OJO_PROPIO: la jugada ocupa un ojo simple propio sin capturar', () => {
    const m = moves([1, 2], [4, 4], [3, 2], [4, 3], [2, 1], [4, 2], [2, 3], [4, 1], [2, 2])
    const events = analyzeGame(SIZE, 0, m)
    expect(has(events, 'RELLENO_OJO_PROPIO', 9)).toBe(true)
  })

  it('RELLENO_OJO_PROPIO: no se reporta si se juega en otro lado', () => {
    const m = moves([1, 2], [4, 4], [3, 2], [4, 3], [2, 1], [4, 2], [2, 3], [4, 1], [6, 6])
    const events = analyzeGame(SIZE, 0, m)
    expect(events.some((e) => e.conceptId === 'RELLENO_OJO_PROPIO')).toBe(false)
  })

  it('ESCALERA_FALLIDA: la jugada inicia una escalera que el rival escapa', () => {
    const m = moves([2, 2], [0, 0], [7, 7], [3, 2], [7, 6], [2, 1], [7, 5], [1, 2])
    const events = analyzeGame(SIZE, 0, m)
    expect(has(events, 'ESCALERA_FALLIDA', 8)).toBe(true)
  })

  it('ESCALERA_FALLIDA: no se reporta si la escalera si funciona', () => {
    const m = moves([1, 1], [5, 5], [7, 7], [2, 1], [7, 6], [1, 2], [7, 5], [1, 0])
    const events = analyzeGame(SIZE, 0, m)
    expect(events.some((e) => e.conceptId === 'ESCALERA_FALLIDA')).toBe(false)
  })

  it('ESCALERA: se reporta como correcta cuando la escalera si funciona', () => {
    const m = moves([1, 1], [5, 5], [7, 7], [2, 1], [7, 6], [1, 2], [7, 5], [1, 0])
    const events = analyzeGame(SIZE, 0, m)
    expect(has(events, 'ESCALERA', 8)).toBe(true)
    const event = events.find((e) => e.conceptId === 'ESCALERA')
    expect(event?.result).toBe('correct')
  })

  it('TRIANGULO_VACIO: la jugada cierra un triangulo vacio', () => {
    const m = moves([2, 2], [7, 7], [3, 3], [7, 6], [2, 3])
    const events = analyzeGame(SIZE, 0, m)
    expect(has(events, 'TRIANGULO_VACIO', 5)).toBe(true)
  })

  it('TRIANGULO_VACIO: no se reporta una jugada sin relacion', () => {
    const m = moves([2, 2], [7, 7], [3, 3], [7, 6], [6, 6])
    const events = analyzeGame(SIZE, 0, m)
    expect(events.some((e) => e.conceptId === 'TRIANGULO_VACIO')).toBe(false)
  })

  it('PRIMERA_LINEA_TEMPRANA: jugada en el borde antes de la jugada 15, sin rival cerca', () => {
    const m = moves([0, 4])
    const events = analyzeGame(SIZE, 0, m)
    expect(has(events, 'PRIMERA_LINEA_TEMPRANA', 1)).toBe(true)
  })

  it('PRIMERA_LINEA_TEMPRANA: no se reporta una jugada central', () => {
    const m = moves([4, 4])
    const events = analyzeGame(SIZE, 0, m)
    expect(events.some((e) => e.conceptId === 'PRIMERA_LINEA_TEMPRANA')).toBe(false)
  })

  it('CORTE_NO_DEFENDIDO: el rival corta un punto de corte dejado por la jugada y el corte se mantiene', () => {
    const m = moves([2, 2], [7, 7], [3, 3], [2, 3], [7, 6], [7, 4])
    const events = analyzeGame(SIZE, 0, m)
    expect(has(events, 'CORTE_NO_DEFENDIDO', 3)).toBe(true)
  })

  it('CORTE_NO_DEFENDIDO: no se reporta si el rival nunca corta', () => {
    const m = moves([2, 2], [7, 7], [3, 3], [7, 6], [7, 5], [7, 4])
    const events = analyzeGame(SIZE, 0, m)
    expect(events.some((e) => e.conceptId === 'CORTE_NO_DEFENDIDO')).toBe(false)
  })

  it('GRUPO_MURIO_SIN_OJOS: un grupo de 4+ piedras muere sin haber tenido dos ojos', () => {
    // Cuatro piedras blancas en linea, negro las rodea por completo y las
    // captura sin que el grupo blanco haya tenido nunca dos ojos.
    const m: RecordedMove[] = [
      { color: BLACK, point: p(1, 1) },
      { color: WHITE, point: p(2, 2) },
      { color: BLACK, point: p(2, 1) },
      { color: WHITE, point: p(3, 2) },
      { color: BLACK, point: p(4, 1) },
      { color: WHITE, point: p(4, 2) },
      { color: BLACK, point: p(5, 1) },
      { color: WHITE, point: p(5, 2) },
      { color: BLACK, point: p(1, 2) },
      { color: WHITE, point: p(7, 7) },
      { color: BLACK, point: p(2, 3) },
      { color: WHITE, point: p(7, 6) },
      { color: BLACK, point: p(3, 3) },
      { color: WHITE, point: p(7, 5) },
      { color: BLACK, point: p(4, 3) },
      { color: WHITE, point: p(7, 4) },
      { color: BLACK, point: p(5, 3) },
      { color: WHITE, point: p(7, 3) },
      { color: BLACK, point: p(6, 2) },
      { color: WHITE, point: p(7, 2) },
      { color: BLACK, point: p(3, 1) },
    ]
    const events = analyzeGame(SIZE, 0, m)
    expect(events.some((e) => e.conceptId === 'GRUPO_MURIO_SIN_OJOS')).toBe(true)
  })

  it('PASE_PREMATURO: se paso existiendo una jugada que cambia el area en mas de 2 puntos', () => {
    // Grupo blanco de 2 piedras conectadas en atari; negro pasa en vez de capturar.
    const m: RecordedMove[] = [
      { color: BLACK, point: p(1, 2) },
      { color: WHITE, point: p(2, 2) },
      { color: BLACK, point: p(2, 1) },
      { color: WHITE, point: p(3, 2) },
      { color: BLACK, point: p(3, 1) },
      { color: WHITE, point: p(7, 7) },
      { color: BLACK, point: p(2, 3) },
      { color: WHITE, point: p(7, 6) },
      { color: BLACK, point: p(3, 3) },
      { color: WHITE, point: p(7, 5) },
      { color: BLACK, point: null },
    ]
    const events = analyzeGame(SIZE, 0, m)
    expect(has(events, 'PASE_PREMATURO', 11)).toBe(true)
  })

  it('PASE_PREMATURO: no se reporta si ningun movimiento cambia el area de forma relevante', () => {
    const m: RecordedMove[] = [
      { color: BLACK, point: p(0, 0) },
      { color: WHITE, point: p(8, 8) },
      { color: BLACK, point: null },
    ]
    const events = analyzeGame(SIZE, 0, m)
    expect(events.some((e) => e.conceptId === 'PASE_PREMATURO')).toBe(false)
  })

  it('RELLENO_TERRITORIO_PROPIO: la jugada cae en territorio ya pass-alive propio', () => {
    const m: RecordedMove[] = [
      { color: BLACK, point: p(1, 1) },
      { color: WHITE, point: p(8, 0) },
      { color: BLACK, point: p(1, 0) },
      { color: WHITE, point: p(8, 1) },
      { color: BLACK, point: p(0, 1) },
      { color: WHITE, point: p(8, 2) },
      { color: BLACK, point: p(1, 2) },
      { color: WHITE, point: p(8, 3) },
      { color: BLACK, point: p(1, 3) },
      { color: WHITE, point: p(8, 4) },
      { color: BLACK, point: p(0, 3) },
      { color: WHITE, point: p(8, 5) },
      { color: BLACK, point: p(0, 0) },
    ]
    const events = analyzeGame(SIZE, 0, m)
    expect(has(events, 'RELLENO_TERRITORIO_PROPIO', 13)).toBe(true)
  })

  it('RELLENO_TERRITORIO_PROPIO: no se reporta una jugada fuera del territorio', () => {
    const m: RecordedMove[] = [
      { color: BLACK, point: p(1, 1) },
      { color: WHITE, point: p(8, 0) },
      { color: BLACK, point: p(1, 0) },
      { color: WHITE, point: p(8, 1) },
      { color: BLACK, point: p(0, 1) },
      { color: WHITE, point: p(8, 2) },
      { color: BLACK, point: p(1, 2) },
      { color: WHITE, point: p(8, 3) },
      { color: BLACK, point: p(1, 3) },
      { color: WHITE, point: p(8, 4) },
      { color: BLACK, point: p(0, 3) },
      { color: WHITE, point: p(8, 5) },
      { color: BLACK, point: p(6, 6) },
    ]
    const events = analyzeGame(SIZE, 0, m)
    expect(events.some((e) => e.conceptId === 'RELLENO_TERRITORIO_PROPIO')).toBe(false)
  })

  it('analyzeGame: los eventos quedan ordenados por numero de jugada', () => {
    const m = moves([1, 2], [0, 2], [3, 3], [1, 1], [3, 4], [1, 3], [4, 4], [2, 2])
    const events = analyzeGame(SIZE, 0, m)
    for (let i = 1; i < events.length; i++) {
      expect(events[i].moveNumber).toBeGreaterThanOrEqual(events[i - 1].moveNumber)
    }
  })
})
