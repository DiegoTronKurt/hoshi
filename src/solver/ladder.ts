import { getGroup } from '../core/groups'
import { applyMove, gameStateFromBoard } from '../core/rules'
import { opponent } from '../core/types'
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
  /** A quien le toca jugar en `board`. Por defecto chaserColor (inicio de
   * la escalera); se pasa explicito para retomar la lectura a mitad de
   * camino, con el que huye a punto de jugar. */
  toMove?: Color
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
  const initialState = gameStateFromBoard(board, request.toMove ?? chaserColor)

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

export interface LadderStep {
  captured: boolean
  /** Todas las jugadas del perseguidor, en orden (una por cada clic real
   * que necesita el ejercicio interactivo). */
  chaserMoves: number[]
}

/**
 * Recorre la escalera turno a turno, igual que el ejercicio interactivo:
 * en cada turno del perseguidor busca, entre las libertades actuales, una
 * jugada que solveLadder confirme que sigue llevando a la captura; en cada
 * turno del que huye juega la extension que solveLadder eligio o, si
 * ninguna libertad es legal para el (todas serian suicidio: esta acorralado
 * en una esquina sin escape real), pasa el turno sin jugar. Ese ultimo caso
 * es la razon de existir de esta funcion: solveLadder(), llamado una sola
 * vez desde el principio, no distingue "ya esta capturado" de "esta muerto
 * pero el perseguidor todavia tiene que jugar ahi" (ver
 * useSolvableExercise.ts, rama 'ladder'), asi que el conteo de jugadas para
 * el mensaje "se resuelve en N jugadas" tiene que simularse paso a paso como
 * ya hace el ejercicio, no derivarse de una sola llamada.
 */
export function simulateLadder(request: LadderRequest): LadderStep {
  const { board, runnerPoint, chaserColor } = request
  const limit = request.maxMoves ?? MAX_LADDER_MOVES
  let state = gameStateFromBoard(board, request.toMove ?? chaserColor)
  const chaserMoves: number[] = []

  for (let step = 0; step < limit; step++) {
    const group = getGroup(state.board, runnerPoint)
    if (!group || group.liberties.size === 0) return { captured: true, chaserMoves }
    if (group.liberties.size >= ESCAPE_LIBERTY_THRESHOLD) return { captured: false, chaserMoves }

    if (state.toMove !== chaserColor) {
      const outcome = solveLadder({
        board: state.board,
        runnerPoint,
        chaserColor,
        toMove: state.toMove,
        maxMoves: limit - step,
      })
      const runnerMove = outcome.moves[0] ?? null
      const applied = runnerMove !== null ? applyMove(state, runnerMove) : applyMove(state, null)
      if (applied.legal && applied.state) state = applied.state
      if (!outcome.captured) return { captured: false, chaserMoves }
      continue
    }

    let played = false
    for (const candidate of group.liberties) {
      const result = applyMove(state, candidate)
      if (!result.legal || !result.state) continue
      const outcome = solveLadder({
        board: result.state.board,
        runnerPoint,
        chaserColor,
        toMove: opponent(chaserColor),
        maxMoves: limit - step,
      })
      if (!outcome.captured) continue
      state = result.state
      chaserMoves.push(candidate)
      played = true
      break
    }
    if (!played) return { captured: false, chaserMoves }
  }

  return { captured: false, chaserMoves }
}
