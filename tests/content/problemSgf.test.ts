import { describe, expect, it } from 'vitest'
import { cuadradoDeCuatro } from '../../src/content/seeds'
import { problemToSgf } from '../../src/content/problemSgf'
import { computeRegion } from '../../src/solver/region'
import { solve } from '../../src/solver/tsumego'
import { BLACK, WHITE } from '../../src/core/types'

// Cuadrado de cuatro esta muerto sin importar quien juegue primero: TODOS
// los intentos de defensa del color objetivo llevan igual a la muerte. Sin
// un limite en los nodos del defensor, problemToSgf registraba cada uno de
// esos intentos (y los suyos, recursivamente), inflando una sola entrada a
// mas de 200KB. Guarda contra que esa explosion vuelva.
describe('problemToSgf: tamano acotado', () => {
  it('una forma muerta sin importar el turno no infla el SGF guardado', () => {
    const region = computeRegion(cuadradoDeCuatro.board, cuadradoDeCuatro.wallPoints, 1)
    const result = solve({
      board: cuadradoDeCuatro.board,
      region,
      targetPoints: cuadradoDeCuatro.wallPoints,
      targetColor: BLACK,
      toMove: WHITE,
      objective: 'kill',
      maxDepth: 8,
    })
    expect(result.solved).toBe(true)

    const sgf = problemToSgf({
      conceptId: 'NAKADE',
      board: cuadradoDeCuatro.board,
      targetPoints: cuadradoDeCuatro.wallPoints,
      targetColor: BLACK,
      toMove: WHITE,
      objective: 'kill',
      tree: result.root,
    })

    expect(sgf.length).toBeLessThan(10000)
  })
})
