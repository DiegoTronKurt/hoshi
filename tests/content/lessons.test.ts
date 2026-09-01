import { describe, expect, it } from 'vitest'
import { cuadradoDeCuatro, dosOjosSeparados, piramideDeCuatro, rectaDeTres } from '../../src/content/seeds'
import { BLACK, WHITE } from '../../src/core/types'
import { computeRegion } from '../../src/solver/region'
import { solve } from '../../src/solver/tsumego'

/**
 * Las lecciones de Nivel 2 (Fase 6) afirman el estado de vida y muerte de
 * formas concretas. Principio 1 del documento de diseno: ninguna afirmacion
 * de este tipo se escribe a mano sin un test que la respalde con el
 * solucionador. rectaDeTres, cuadradoDeCuatro y piramideDeCuatro ya se
 * verifican en tests/solver/tsumego.test.ts (son las mismas posiciones,
 * reexportadas desde src/content/seeds.ts); aca se verifica la unica forma
 * que las lecciones introducen sin un test previo.
 */
describe('formas de las lecciones de Nivel 2: verificacion con el solucionador', () => {
  it('dos ojos separados ya formados: blanco no puede matar aunque juegue primero', () => {
    const { board, wallPoints } = dosOjosSeparados
    const region = computeRegion(board, wallPoints, 1)
    const result = solve({
      board,
      region,
      targetPoints: wallPoints,
      targetColor: BLACK,
      toMove: WHITE,
      objective: 'kill',
      maxDepth: 6,
    })
    expect(result.solved).toBe(false)
  })

  it('recta de tres: el punto vital reutilizado en n2-l5/n2-l6/n2-l7 sigue verificado', () => {
    const { board, wallPoints } = rectaDeTres
    const region = computeRegion(board, wallPoints, 1)
    expect(
      solve({ board, region, targetPoints: wallPoints, targetColor: BLACK, toMove: BLACK, objective: 'live', maxDepth: 6 })
        .solved,
    ).toBe(true)
    expect(
      solve({ board, region, targetPoints: wallPoints, targetColor: BLACK, toMove: WHITE, objective: 'kill', maxDepth: 6 })
        .solved,
    ).toBe(true)
  })

  it('cuadrado de cuatro: nakade reutilizado en n2-l7/n2-l8 sigue verificado como muerte incondicional', () => {
    const { board, wallPoints } = cuadradoDeCuatro
    const region = computeRegion(board, wallPoints, 1)
    expect(
      solve({ board, region, targetPoints: wallPoints, targetColor: BLACK, toMove: BLACK, objective: 'live', maxDepth: 6 })
        .solved,
    ).toBe(false)
    expect(
      solve({ board, region, targetPoints: wallPoints, targetColor: BLACK, toMove: WHITE, objective: 'kill', maxDepth: 6 })
        .solved,
    ).toBe(true)
  })

  it('piramide de cuatro: punto vital reutilizado en n2-l6/n2-l7 sigue verificado', () => {
    const { board, wallPoints } = piramideDeCuatro
    const region = computeRegion(board, wallPoints, 1)
    expect(
      solve({ board, region, targetPoints: wallPoints, targetColor: BLACK, toMove: BLACK, objective: 'live', maxDepth: 8 })
        .solved,
    ).toBe(true)
    expect(
      solve({ board, region, targetPoints: wallPoints, targetColor: BLACK, toMove: WHITE, objective: 'kill', maxDepth: 8 })
        .solved,
    ).toBe(true)
  })
})
