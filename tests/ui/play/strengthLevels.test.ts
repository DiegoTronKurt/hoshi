import { describe, expect, it } from 'vitest'
import { STRENGTH_LEVELS, approxKyuForStrengthId } from '../../../src/ui/play/strengthLevels'

describe('STRENGTH_LEVELS', () => {
  it('ningun nivel de motor net tiene un kyu inventado (mismo principio de honestidad que maxima)', () => {
    const netLevels = STRENGTH_LEVELS.filter((level) => level.engine === 'net')
    expect(netLevels.length).toBeGreaterThan(0)
    for (const level of netLevels) expect(level.approxKyu).toBeNull()
  })

  it("'expert' (Fase 3, A4) esta entre 'veryStrong' y 'maxima', mismo orden que la UI (PlayConfigScreen renderiza en orden de array)", () => {
    const ids = STRENGTH_LEVELS.map((level) => level.id)
    const veryStrongIndex = ids.indexOf('veryStrong')
    const expertIndex = ids.indexOf('expert')
    const maximaIndex = ids.indexOf('maxima')
    expect(expertIndex).toBeGreaterThan(veryStrongIndex)
    expect(expertIndex).toBeLessThan(maximaIndex)
  })

  it("'expert' usa el motor 'net' con menos playouts y menos tiempo maximo que 'maxima'", () => {
    const expert = STRENGTH_LEVELS.find((level) => level.id === 'expert')!
    const maxima = STRENGTH_LEVELS.find((level) => level.id === 'maxima')!
    expect(expert.engine).toBe('net')
    expect(expert.playouts).toBeLessThan(maxima.playouts)
    expect(expert.maxTimeMs).toBeLessThan(maxima.maxTimeMs)
  })

  it('approxKyuForStrengthId devuelve null para cualquier nivel de motor net, un kyu real para los clasicos', () => {
    expect(approxKyuForStrengthId('expert')).toBeNull()
    expect(approxKyuForStrengthId('maxima')).toBeNull()
    expect(approxKyuForStrengthId('veryStrong')).toBe(10)
  })
})
