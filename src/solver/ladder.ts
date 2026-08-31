import { getGroup } from '../core/groups'
import { applyMove, gameStateFromBoard } from '../core/rules'
import type { BoardState, Color, GameState } from '../core/types'

export const MAX_LADDER_MOVES = 80

/** A partir de esta cantidad de libertades se considera que el grupo escapo:
 * ya tiene espacio suficiente para que el perseguidor no pueda forzarlo mas. */
const ESCAPE_LIBERTY_THRESHOLD = 3

export type LadderReason = 'captured' | 'escaped' | 'move_limit'

export interface LadderRequest {
  board: BoardState
  /** Un punto cualquiera del grupo que huye. */
  runnerPoint: number
  /** El color que persigue (quiere capturar). Juega primero. */
  chaserColor: Color
  maxMoves?: number
}

export interface LadderResult {
  captured: boolean
  moves: number[]
  reason: LadderReason
}

/**
 * Solucionador de escaleras (shicho): en cada turno, ambos bandos solo
 * consideran jugar en una de las libertades actuales del grupo perseguido
 * (el perseguidor para reducirlas, el que huye para extenderse). Es la
 * restriccion que define a una escalera "simple": ni capturar una piedra del
 * perseguidor en otro lugar ni conectar con otro grupo cuentan aqui, eso ya
 * seria un recurso tactico aparte. Si el grupo llega a 4 libertades se
 * considera escapado: tiene espacio suficiente para que ya no se lo pueda
 * forzar mas por este camino.
 */
export function solveLadder(request: LadderRequest): LadderResult {
  const { board, runnerPoint, chaserColor } = request
  const maxMoves = request.maxMoves ?? MAX_LADDER_MOVES
  const initialState = gameStateFromBoard(board, chaserColor)

  function run(state: GameState, movesLeft: number, movesSoFar: number[]): LadderResult {
    const group = getGroup(state.board, runnerPoint)
    if (!group) {
      return { captured: true, moves: movesSoFar, reason: 'captured' }
    }
    if (group.liberties.size === 0) {
      return { captured: true, moves: movesSoFar, reason: 'captured' }
    }
    if (group.liberties.size >= ESCAPE_LIBERTY_THRESHOLD) {
      return { captured: false, moves: movesSoFar, reason: 'escaped' }
    }
    if (movesLeft <= 0) {
      return { captured: false, moves: movesSoFar, reason: 'move_limit' }
    }

    const chaserToMove = state.toMove === chaserColor
    let lastOutcome: LadderResult | null = null

    for (const move of group.liberties) {
      const result = applyMove(state, move)
      if (!result.legal || !result.state) continue

      const outcome = run(result.state, movesLeft - 1, [...movesSoFar, move])
      lastOutcome = outcome
      if (chaserToMove && outcome.captured) return outcome
      if (!chaserToMove && !outcome.captured) return outcome
    }

    // El perseguidor no encontro ninguna jugada que capture, o el que huye no
    // encontro ninguna que lo salve: gana el otro bando en este nodo. Todas
    // las jugadas probadas comparten el mismo resultado final, asi que
    // cualquiera de ellas (la ultima) ya trae la secuencia completa correcta.
    if (lastOutcome) return lastOutcome
    return { captured: !chaserToMove, moves: movesSoFar, reason: chaserToMove ? 'escaped' : 'captured' }
  }

  return run(initialState, maxMoves, [])
}
