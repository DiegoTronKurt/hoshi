import { diagonals, neighbors } from '../core/board'
import { getGroup } from '../core/groups'
import { EMPTY, opponent } from '../core/types'
import type { BoardState, Color, GameState } from '../core/types'

function groupsWithOneLiberty(board: BoardState, color: Color): number[] {
  const seen = new Set<number>()
  const points: number[] = []

  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] !== color || seen.has(p)) continue
    const group = getGroup(board, p)
    if (!group) continue
    for (const stone of group.stones) seen.add(stone)
    if (group.liberties.size === 1) {
      const [liberty] = group.liberties
      points.push(liberty)
    }
  }

  return points
}

/**
 * Heuristica de "ojo simple" para la politica de playout del bot: un punto
 * vacio rodeado ortogonalmente por piedras propias, con como maximo una
 * piedra rival en diagonal (ninguna si el punto esta en el borde). No es una
 * afirmacion sobre vida o muerte, solo evita que las partidas aleatorias del
 * bot rellenen sus propios ojos sin sentido.
 */
export function isSimpleEye(board: BoardState, point: number, color: Color): boolean {
  if (board.stones[point] !== EMPTY) return false

  for (const n of neighbors(board.size, point)) {
    if (board.stones[n] !== color) return false
  }

  const diags = diagonals(board.size, point)
  const opp = opponent(color)
  let oppDiagonalCount = 0
  for (const d of diags) {
    if (board.stones[d] === opp) oppDiagonalCount++
  }

  const maxAllowed = diags.length === 4 ? 1 : 0
  return oppDiagonalCount <= maxAllowed
}

/**
 * Puntos que salvarian a un grupo propio en atari (su unica libertad),
 * usados para que la politica de playout responda al atari en vez de
 * ignorarlo por completo.
 */
export function findAtariSavingMoves(state: GameState): number[] {
  return groupsWithOneLiberty(state.board, state.toMove)
}

/**
 * Puntos donde jugar ahora capturaria al menos un grupo rival (le quitaria
 * su ultima libertad), usados para que la politica de playout aproveche
 * capturas gratis en vez de ignorarlas por completo -- mismo patron que
 * findAtariSavingMoves, pero mirando los grupos del rival en vez de los
 * propios.
 */
export function findCapturingMoves(state: GameState): number[] {
  return groupsWithOneLiberty(state.board, opponent(state.toMove))
}

/**
 * True si, despues de jugar en `point`, el grupo propio recien formado ahi
 * queda en atari (una sola libertad). Se usa para que la politica de
 * playout evite auto-atarearse sin necesidad -- no es una lectura real, solo
 * evita el error mas obvio de una jugada verdaderamente al azar. `afterBoard`
 * es el tablero YA jugado (post-captura incluida), para no repetir el costo
 * de aplicar la jugada una segunda vez.
 */
export function resultsInSelfAtari(afterBoard: BoardState, point: number): boolean {
  const group = getGroup(afterBoard, point)
  return !!group && group.liberties.size === 1
}
