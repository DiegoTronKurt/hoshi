import { describe, expect, it } from 'vitest'
import { buildImportedGameRecord } from '../../src/content/sgfImport'

describe('buildImportedGameRecord', () => {
  it('acepta una partida real con resultado numerico', () => {
    const sgf = '(;GM[1]FF[4]SZ[9]KM[6.5]RE[B+3.5];B[cc];W[gg];B[cd])'
    const imported = buildImportedGameRecord(sgf)

    expect(imported.ok).toBe(true)
    if (!imported.ok) return
    expect(imported.record).toEqual({
      createdAt: expect.any(String),
      width: 9,
      height: 9,
      komi: 6.5,
      mode: 'local',
      result: { black: 3.5, white: 0, winner: 'black' },
      sgf,
    })
  })

  it('rechaza texto que no es SGF valido', () => {
    const imported = buildImportedGameRecord('esto no es un archivo SGF')
    expect(imported).toEqual({ ok: false, error: 'parse' })
  })

  it('rechaza una partida sin ninguna jugada', () => {
    const imported = buildImportedGameRecord('(;GM[1]FF[4]SZ[9]KM[6.5]RE[B+3.5])')
    expect(imported).toEqual({ ok: false, error: 'parse' })
  })

  it('rechaza partidas de handicap (AB/AW) en vez de asignar mal los colores', () => {
    const imported = buildImportedGameRecord('(;GM[1]FF[4]SZ[9]KM[0.5]AB[cc][gg]RE[W+0.5];W[aa])')
    expect(imported).toEqual({ ok: false, error: 'handicap-unsupported' })
  })

  it('rechaza una secuencia con dos jugadas del mismo color seguidas', () => {
    const imported = buildImportedGameRecord('(;GM[1]FF[4]SZ[9]KM[6.5]RE[B+3.5];B[cc];B[gg])')
    expect(imported).toEqual({ ok: false, error: 'parse' })
  })

  it('rechaza una secuencia con una jugada ilegal (punto ya ocupado)', () => {
    const imported = buildImportedGameRecord('(;GM[1]FF[4]SZ[9]KM[6.5]RE[B+3.5];B[cc];W[gg];B[cc])')
    expect(imported).toEqual({ ok: false, error: 'parse' })
  })

  it('rechaza una partida legal sin resultado (RE ausente o no numerico)', () => {
    const withoutRe = buildImportedGameRecord('(;GM[1]FF[4]SZ[9]KM[6.5];B[cc];W[gg])')
    expect(withoutRe).toEqual({ ok: false, error: 'no-result' })

    const resignation = buildImportedGameRecord('(;GM[1]FF[4]SZ[9]KM[6.5]RE[B+R];B[cc];W[gg])')
    expect(resignation).toEqual({ ok: false, error: 'no-result' })
  })
})
