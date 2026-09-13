import { applyMove, createGame } from '../../core/rules'
import type { RecordedMove } from '../../core/sgf'
import type { Color, GameState } from '../../core/types'
import type { EvalPosition } from '../../eval/features'

/**
 * Una posicion de evaluacion por cada ply de la partida, incluida la
 * inicial (indice 0, antes de cualquier jugada) -- N jugadas producen N+1
 * posiciones, mismo indexado que ConceptOccurrence.moveNumber en
 * analysis/mistakes.ts (0 = posicion inicial). Recorrido unico de
 * principio a fin: llamar a stateAtMove por cada indice repetiria el
 * replay desde cero N veces (O(N^2)) para una partida real de ~200
 * jugadas -- aca cada estado se calcula una sola vez.
 *
 * Una jugada ilegal corta la reproduccion ahi, igual que stateAtMove (no
 * deberia pasar con una partida guardada real, ya validada al guardarse o
 * importarse, pero es la misma guarda defensiva ya establecida en vez de
 * lanzar sobre datos inesperados).
 */
export function buildFullGameEvalPositions(
  width: number,
  height: number,
  komi: number,
  moves: RecordedMove[],
): EvalPosition[] {
  const states: GameState[] = [createGame(width, height, komi)]
  for (const move of moves) {
    const applied = applyMove(states[states.length - 1], move.point)
    if (!applied.legal || !applied.state) break
    states.push(applied.state)
  }

  return states.map((state, i) => ({
    state,
    recentMoves: moves.slice(Math.max(0, i - 5), i),
    // Tableros de 1 y 2 jugadas atras (ver EvalPosition en eval/features.ts).
    // Al principio de la partida no hay tanto historial real: se satura en
    // el estado inicial en vez de omitir el campo, mejor aproximacion que
    // dejar los canales de escalera historica vacios de entrada.
    priorBoards: [states[Math.max(0, i - 2)].board, states[Math.max(0, i - 1)].board],
  }))
}

export interface WinRatePoint {
  /** 0 = posicion inicial, N = tras las N jugadas de la partida. */
  moveNumber: number
  /** Probabilidad de que gane NEGRO en esta posicion -- perspectiva fija
   * para poder graficar una sola curva, a diferencia de value[0] (siempre
   * la perspectiva de quien tiene el turno en ESA posicion). */
  blackWinProbability: number
}

export interface WinRateSwing {
  /** Numero de jugada que causo la caida, 1-indexado (mismo formato que
   * ConceptOccurrence.moveNumber). */
  moveNumber: number
  color: Color
  point: number | null
  /** Cuanto bajo la probabilidad de ganar DE QUIEN JUGO esa jugada, entre
   * justo antes y justo despues de jugarla. En [-1,1]; positivo es una
   * jugada que la red juzga peor para quien la hizo, no necesariamente un
   * error real (ver el disclaimer ya existente: opinion de la red, no un
   * hecho verificado). */
  swing: number
}

/**
 * `values[i]` debe ser value[0] (P(gana quien tiene el turno), ver
 * RawEvalOutput en eval/model.ts) de evaluar buildFullGameEvalPositions()[i]
 * -- misma longitud, mismo orden. Funcion pura: no vuelve a tocar el motor
 * de reglas ni la red, solo reinterpreta numeros ya calculados.
 *
 * El motor arranca siempre con negro y alterna el turno cada ply sin
 * excepcion (pase o no, con o sin captura -- ver core/rules.ts), asi que
 * alcanza con la paridad del indice para saber a quien le tocaba en cada
 * posicion, sin necesitar el GameState real.
 */
export function summarizeWinRates(moves: RecordedMove[], values: number[]): { curve: WinRatePoint[]; swings: WinRateSwing[] } {
  const curve: WinRatePoint[] = values.map((v, i) => ({
    moveNumber: i,
    blackWinProbability: i % 2 === 0 ? v : 1 - v,
  }))

  const swings: WinRateSwing[] = []
  for (let k = 1; k < values.length; k++) {
    const pBeforeMover = values[k - 1]
    const pMoverAfter = 1 - values[k]
    swings.push({
      moveNumber: k,
      color: moves[k - 1].color,
      point: moves[k - 1].point,
      swing: pBeforeMover - pMoverAfter,
    })
  }
  swings.sort((a, b) => b.swing - a.swing)

  return { curve, swings }
}
