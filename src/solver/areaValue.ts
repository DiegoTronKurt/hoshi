import { bensonPassAlive } from '../core/benson'
import { applyMove, gameStateFromBoard } from '../core/rules'
import { computeAreaScore } from '../core/scoring'
import { BLACK, EMPTY } from '../core/types'
import type { BoardState, Color } from '../core/types'

/** Mismo komi fijo que usa el resto del banco generado (ver BOARD_SIZE en
 * generate-problems.ts). El delta de area entre dos jugadas del mismo color
 * no depende del komi (se cancela: es una constante en ambos lados de la
 * resta), asi que no hace falta guardarlo por problema. */
const KOMI = 6.5

/** Mismo umbral que detectPasePrematuro en analysis/mistakes.ts: una
 * jugada solo cuenta como "vale la pena" si mejora el area en mas de 2
 * puntos. Todo este archivo (generador y validacion en vivo) usa esta
 * misma constante para no ensenar una regla distinta a la que aplica el
 * detector de partida real. */
export const PASS_VALUE_THRESHOLD = 2

function colorKey(color: Color): 'black' | 'white' {
  return color === BLACK ? 'black' : 'white'
}

/** Diferencia de area que deja jugar `point` para `color`, contra la
 * posicion actual. null si `point` no es una jugada legal. */
export function areaDeltaForPoint(board: BoardState, point: number, color: Color): number | null {
  const key = colorKey(color)
  const baseline = computeAreaScore(board, KOMI)[key]
  const state = gameStateFromBoard(board, color)
  const result = applyMove(state, point)
  if (!result.legal || !result.state) return null
  const score = computeAreaScore(result.state.board, KOMI)[key]
  return score - baseline
}

/**
 * La mejor jugada disponible para `color` medida en diferencia de area
 * (mismo calculo que detectPasePrematuro): null si ninguna supera el
 * umbral, es decir, si pasar es la jugada correcta.
 */
export function bestAreaMove(board: BoardState, color: Color): { point: number; delta: number } | null {
  let best: { point: number; delta: number } | null = null
  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] !== EMPTY) continue
    const delta = areaDeltaForPoint(board, p, color)
    if (delta !== null && delta > PASS_VALUE_THRESHOLD && (!best || delta > best.delta)) {
      best = { point: p, delta }
    }
  }
  return best
}

/**
 * True si `point` cae dentro del territorio pass-alive propio de `color`
 * (mismo chequeo que detectRellenoTerritorioPropio: sin cadenas pass-alive
 * todavia, no hay territorio que rellenar).
 */
export function isOwnTerritory(board: BoardState, point: number, color: Color): boolean {
  const { chains, territoryPoints } = bensonPassAlive(board, color)
  if (chains.length === 0) return false
  return territoryPoints.includes(point)
}
