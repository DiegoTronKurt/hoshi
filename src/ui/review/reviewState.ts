import { toPoint } from '../../core/board'
import { applyMove, createGame } from '../../core/rules'
import type { RecordedMove } from '../../core/sgf'
import { opponent } from '../../core/types'
import type { GameState } from '../../core/types'
import { NN_LEN } from '../../eval/features'

/** Estado del motor de reglas tras aplicar moves[0..moveNumber-1]
 * INCLUSIVE de moves[moveNumber-1] -- si moveNumber viene de
 * ConceptOccurrence.moveNumber (= indice del error + 1, ver mistakes.ts),
 * el resultado ya incluye la jugada del error, no la posicion previa a
 * ella. toMove en el resultado es entonces el RIVAL de quien jugo esa
 * ultima jugada, no la misma persona -- importa para cualquier calculo
 * que dependa de la perspectiva (ver ReviewMistakeBoard, que pide un
 * ply antes por esta misma razon). moveNumber <= 0 devuelve el estado
 * inicial sin tocar, sin necesidad de guardas aparte. */
export function stateAtMove(width: number, height: number, komi: number, moves: RecordedMove[], moveNumber: number): GameState {
  let state = createGame(width, height, komi)
  for (let i = 0; i < moveNumber && i < moves.length; i++) {
    const result = applyMove(state, moves[i].point)
    if (!result.legal || !result.state) break
    state = result.state
  }
  return state
}

/**
 * Convierte el ownership crudo de la red (grilla NN fija de 19x19, ver
 * eval/features.ts) al mismo formato ternario que ya usa BoardCanvas para
 * el territorio de fin de partida (Int8Array EMPTY/BLACK/WHITE, ver
 * core/scoring.ts::computeAreaOwnership) -- se reusa el mismo prop/dibujo,
 * sin agregar un modo de render nuevo. Umbral 0.5: por debajo queda
 * neutral en vez de forzar un color con poca confianza.
 */
export function bucketOwnership(ownership: Float32Array, state: GameState): Int8Array {
  const { width, height } = state.board
  const territory = new Int8Array(width * height)
  for (let i = 0; i < NN_LEN * NN_LEN; i++) {
    const x = i % NN_LEN
    const y = Math.floor(i / NN_LEN)
    if (x >= width || y >= height) continue
    const value = ownership[i]
    if (value > 0.5) territory[toPoint(width, x, y)] = state.toMove
    else if (value < -0.5) territory[toPoint(width, x, y)] = opponent(state.toMove)
  }
  return territory
}
