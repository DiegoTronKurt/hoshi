import { describe, expect, it } from 'vitest'
import { pickWithoutRepeat, recentWindowSize } from '../../src/content/pickWithoutRepeat'

interface Entry {
  id: string
}

const entries: Entry[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('pickWithoutRepeat', () => {
  it('nunca devuelve un id en recentIds si hay alternativa', () => {
    for (let i = 0; i < 50; i++) {
      const picked = pickWithoutRepeat(entries, ['a', 'b'])
      expect(picked?.id).toBe('c')
    }
  })

  it('vuelve al pool completo si la exclusion lo dejaria vacio', () => {
    for (let i = 0; i < 50; i++) {
      const picked = pickWithoutRepeat(entries, ['a', 'b', 'c'])
      expect(['a', 'b', 'c']).toContain(picked?.id)
    }
  })

  it('devuelve null con un pool vacio', () => {
    expect(pickWithoutRepeat([], [])).toBeNull()
  })

  it('con recentIds vacio elige de todo el pool', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 100; i++) {
      seen.add(pickWithoutRepeat(entries, [])?.id ?? '')
    }
    expect(seen).toEqual(new Set(['a', 'b', 'c']))
  })
})

describe('recentWindowSize', () => {
  it('nunca excluye el pool entero', () => {
    expect(recentWindowSize(8, 5)).toBe(5)
    expect(recentWindowSize(3, 5)).toBe(2)
    expect(recentWindowSize(1, 5)).toBe(0)
    expect(recentWindowSize(0, 5)).toBe(0)
  })
})
