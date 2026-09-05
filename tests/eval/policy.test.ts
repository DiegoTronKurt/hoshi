import { describe, expect, it } from 'vitest'
import { toPoint } from '../../src/core/board'
import { POLICY_PASS_INDEX, legalPolicyDistribution } from '../../src/eval/policy'

// Regresion del bug real encontrado en esta sesion: legalPolicyDistribution
// indexaba `policy[p]` con `p` en la convencion del tablero real
// (y*width+x), pero `policy` viene indexada en la grilla fija de la red
// (y*19+x) -- ambas coinciden solo si width===19 o en la fila 0. El unico
// llamador (ReviewMistakeBoard) le pasaba un tablero 9x9, asi que el
// "punto sugerido por la IA" apuntaba al lugar equivocado para cualquier
// fila > 0.
describe('legalPolicyDistribution (conversion tablero <-> grilla de la red)', () => {
  it('en un tablero 9x9, fila > 0, elige el punto correcto en espacio de tablero, no el indice de la grilla', () => {
    const width = 9
    const target = toPoint(width, 2, 5) // fila 5: distinto en ambas convenciones
    const nnIndexOfTarget = 5 * 19 + 2 // 97
    const nnIndexIfBuggy = 5 * width + 2 // 47 -- lo que el codigo viejo hubiera leido

    const policy = new Float32Array(362)
    policy[nnIndexOfTarget] = 0.9
    policy[nnIndexIfBuggy] = 0.01 // casi nada, para confirmar que no es esto lo que se lee
    policy[POLICY_PASS_INDEX] = 0.01

    const legalPoints: number[] = []
    for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) legalPoints.push(toPoint(width, x, y))

    const distribution = legalPolicyDistribution(policy, legalPoints, true, width)
    let topPoint: number | null = null
    let topProb = -1
    for (const [point, prob] of distribution) {
      if (prob > topProb) {
        topProb = prob
        topPoint = point
      }
    }

    expect(topPoint).toBe(target)
  })

  it('en la fila 0, ambas convenciones coinciden (caso donde el bug viejo pasaba desapercibido)', () => {
    const width = 9
    const target = toPoint(width, 3, 0)

    const policy = new Float32Array(362)
    policy[3] = 0.9 // y=0: y*19+x === y*width+x

    const legalPoints = [target, toPoint(width, 0, 0), toPoint(width, 8, 0)]
    const distribution = legalPolicyDistribution(policy, legalPoints, false, width)
    let topPoint: number | null = null
    let topProb = -1
    for (const [point, prob] of distribution) {
      if (prob > topProb) {
        topProb = prob
        topPoint = point
      }
    }

    expect(topPoint).toBe(target)
  })

  it('en un tablero 19x19 (identidad), sigue funcionando igual que antes', () => {
    const width = 19
    const target = toPoint(width, 4, 10)

    const policy = new Float32Array(362)
    policy[10 * 19 + 4] = 0.9

    const legalPoints = [target, toPoint(width, 0, 0)]
    const distribution = legalPolicyDistribution(policy, legalPoints, false, width)
    let topPoint: number | null = null
    let topProb = -1
    for (const [point, prob] of distribution) {
      if (prob > topProb) {
        topProb = prob
        topPoint = point
      }
    }

    expect(topPoint).toBe(target)
  })

  it('reparte parejo entre las legales si ninguna tiene probabilidad (caso degenerado)', () => {
    const width = 9
    const policy = new Float32Array(362)
    const legalPoints = [toPoint(width, 0, 0), toPoint(width, 1, 0)]

    const distribution = legalPolicyDistribution(policy, legalPoints, true, width)
    expect(distribution.get(legalPoints[0])).toBeCloseTo(1 / 3)
    expect(distribution.get(legalPoints[1])).toBeCloseTo(1 / 3)
    expect(distribution.get(null)).toBeCloseTo(1 / 3)
  })
})
