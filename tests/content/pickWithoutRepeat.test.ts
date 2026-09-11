import { describe, expect, it } from 'vitest'
import { pickStratifiedByConcept, pickWithoutRepeat, recentWindowSize } from '../../src/content/pickWithoutRepeat'

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

describe('pickStratifiedByConcept', () => {
  // Un concepto de 369 problemas y uno de 4 (proporciones reales del banco:
  // PASE_PREMATURO vs. OJO_FALSO) -- si el sorteo fuera plano sobre el pool
  // combinado, 'chico' aparaceria en ~1% de los sorteos. Estratificado por
  // concepto, cada concepto deberia salir con probabilidad pareja.
  function bigSmallGroups() {
    const groups = new Map<string, { id: string }[]>()
    groups.set(
      'grande',
      Array.from({ length: 369 }, (_, i) => ({ id: `g${i}` })),
    )
    groups.set(
      'chico',
      Array.from({ length: 4 }, (_, i) => ({ id: `c${i}` })),
    )
    return groups
  }

  it('elige cada concepto con probabilidad pareja sin importar su tamano de pool', () => {
    const groups = bigSmallGroups()
    const counts = { grande: 0, chico: 0 }
    for (let i = 0; i < 400; i++) {
      const result = pickStratifiedByConcept(groups, [], [])
      expect(result).not.toBeNull()
      counts[result!.conceptId as 'grande' | 'chico']++
    }
    // Cada sorteo es independiente (recentConceptIds siempre []): con 400
    // intentos y p=0.5 real, un rango 30%-70% deja margen de sobra sin
    // permitir que domine el pool grande (lo que fallaria antes del fix,
    // donde 'chico' saldria ~1% de las veces).
    expect(counts.chico).toBeGreaterThan(120)
    expect(counts.grande).toBeGreaterThan(120)
  })

  it('nunca repite el mismo concepto si hay otro disponible', () => {
    const groups = bigSmallGroups()
    for (let i = 0; i < 50; i++) {
      const result = pickStratifiedByConcept(groups, [], ['grande'])
      expect(result?.conceptId).toBe('chico')
    }
  })

  it('devuelve un elemento que respeta recentIds dentro del concepto elegido', () => {
    const groups = new Map<string, { id: string }[]>()
    groups.set('unico', [{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    for (let i = 0; i < 50; i++) {
      const result = pickStratifiedByConcept(groups, ['a', 'b'], [])
      expect(result?.item.id).toBe('c')
    }
  })

  it('devuelve null con un mapa de grupos vacio', () => {
    expect(pickStratifiedByConcept(new Map(), [], [])).toBeNull()
  })
})
