import { describe, expect, it } from 'vitest'
import { createRng, shuffledIndices } from '../../src/engine/random'

describe('generador aleatorio con semilla', () => {
  it('con la misma semilla produce siempre la misma secuencia', () => {
    const a = createRng(42)
    const b = createRng(42)
    const sequenceA = Array.from({ length: 5 }, () => a())
    const sequenceB = Array.from({ length: 5 }, () => b())
    expect(sequenceA).toEqual(sequenceB)
  })

  it('semillas distintas producen secuencias distintas', () => {
    const a = createRng(1)
    const b = createRng(2)
    expect(a()).not.toBe(b())
  })

  it('shuffledIndices devuelve una permutacion valida de 0..n-1', () => {
    const random = createRng(7)
    const indices = shuffledIndices(20, random)
    expect(indices.length).toBe(20)
    expect(new Set(indices)).toEqual(new Set(Array.from({ length: 20 }, (_, i) => i)))
  })
})
