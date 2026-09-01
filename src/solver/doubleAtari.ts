import { neighbors } from '../core/board'
import { getGroup } from '../core/groups'
import { applyMove, gameStateFromBoard } from '../core/rules'
import { opponent } from '../core/types'
import type { BoardState, Color } from '../core/types'

/**
 * Un doble atari es un reconocimiento de una sola jugada, no una lectura
 * de varias jugadas: si el punto candidato es legal para `color` y, tras
 * jugarlo, deja a dos grupos rivales *distintos* con una sola libertad
 * cada uno (que no estaban ya en atari antes de la jugada), es un doble
 * atari. No usa el solucionador de vida-muerte ni el de escaleras, solo
 * `getGroup` directo, igual que ya hacen varios detectores de
 * `analysis/mistakes.ts`.
 */
export function isDoubleAtariMove(board: BoardState, point: number, color: Color): boolean {
  const before = gameStateFromBoard(board, color)
  const result = applyMove(before, point)
  if (!result.legal || !result.state) return false

  const rival = opponent(color)
  const afterBoard = result.state.board
  const seen = new Set<number>()
  let newAtaris = 0

  for (const n of neighbors(afterBoard.size, point)) {
    if (afterBoard.stones[n] !== rival || seen.has(n)) continue
    const groupAfter = getGroup(afterBoard, n)
    if (!groupAfter) continue
    for (const stone of groupAfter.stones) seen.add(stone)
    if (groupAfter.liberties.size !== 1) continue

    // Solo cuenta si la jugada realmente causo el atari: el mismo grupo,
    // visto desde el tablero anterior, tenia mas de una libertad.
    const groupBefore = getGroup(board, n)
    if ((groupBefore?.liberties.size ?? 0) > 1) newAtaris++
  }

  return newAtaris >= 2
}

/** Todos los puntos donde `color` puede jugar un doble atari en `board`. */
export function findDoubleAtariMoves(board: BoardState, color: Color): number[] {
  const moves: number[] = []
  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] !== 0) continue
    if (isDoubleAtariMove(board, p, color)) moves.push(p)
  }
  return moves
}
