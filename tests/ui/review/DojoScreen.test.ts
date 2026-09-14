import { describe, expect, it } from 'vitest'
import { BLACK, EMPTY, WHITE } from '../../../src/core/types'
import { cycleStone } from '../../../src/ui/review/DojoScreen'

describe('cycleStone', () => {
  it('en un punto vacio, pone la piedra de "a quien le toca" seleccionada, no siempre negro', () => {
    expect(cycleStone(EMPTY, WHITE)).toBe(WHITE)
    expect(cycleStone(EMPTY, BLACK)).toBe(BLACK)
  })

  it('cicla al color contrario, despues a vacio, sin importar cual color este seleccionado', () => {
    expect(cycleStone(WHITE, WHITE)).toBe(BLACK)
    expect(cycleStone(BLACK, WHITE)).toBe(EMPTY)
    expect(cycleStone(BLACK, BLACK)).toBe(WHITE)
    expect(cycleStone(WHITE, BLACK)).toBe(EMPTY)
  })
})
