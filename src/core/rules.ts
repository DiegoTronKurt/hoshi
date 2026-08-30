import { cloneBoard, createBoard, neighbors } from './board'
import { getGroup } from './groups'
import { BLACK, EMPTY, opponent } from './types'
import type { BoardState, Color, GameState, MoveResult } from './types'
import { getZobristTable, hashBoard, toggleStone } from './zobrist'

export function createGame(size: number, komi: number): GameState {
  const board = createBoard(size)
  const table = getZobristTable(size)
  return {
    board,
    toMove: BLACK,
    komi,
    history: [hashBoard(table, board)],
    moveNumber: 0,
    captures: { black: 0, white: 0 },
    consecutivePasses: 0,
    gameOver: false,
  }
}

function removeDeadNeighborGroups(board: BoardState, point: number, own: Color): number[] {
  const opp = opponent(own)
  const removed: number[] = []
  for (const n of neighbors(board.size, point)) {
    if (board.stones[n] !== opp) continue
    const group = getGroup(board, n)
    if (group && group.liberties.size === 0) {
      for (const stone of group.stones) {
        board.stones[stone] = EMPTY
        removed.push(stone)
      }
    }
  }
  return removed
}

/**
 * Juega en `point` (o pasa si `point` es null) para el color a quien le toca.
 * No muta `state`: devuelve un nuevo GameState en `result.state` si la jugada es legal.
 */
export function applyMove(state: GameState, point: number | null): MoveResult {
  if (state.gameOver) {
    return { legal: false, reason: 'game_over', captured: [] }
  }

  const color = state.toMove

  if (point === null) {
    const nextState: GameState = {
      ...state,
      toMove: opponent(color),
      moveNumber: state.moveNumber + 1,
      consecutivePasses: state.consecutivePasses + 1,
      gameOver: state.consecutivePasses + 1 >= 2,
    }
    return { legal: true, state: nextState, captured: [] }
  }

  if (state.board.stones[point] !== EMPTY) {
    return { legal: false, reason: 'occupied', captured: [] }
  }

  const board = cloneBoard(state.board)
  board.stones[point] = color

  const captured = removeDeadNeighborGroups(board, point, color)

  const ownGroup = getGroup(board, point)
  if (ownGroup && ownGroup.liberties.size === 0) {
    return { legal: false, reason: 'suicide', captured: [] }
  }

  const table = getZobristTable(board.size)
  let hash = toggleStone(table, state.history[state.history.length - 1], point, color)
  for (const stone of captured) {
    hash = toggleStone(table, hash, stone, opponent(color))
  }

  if (state.history.includes(hash)) {
    return { legal: false, reason: 'superko', captured: [] }
  }

  const captures = { ...state.captures }
  if (color === BLACK) captures.black += captured.length
  else captures.white += captured.length

  const nextState: GameState = {
    board,
    toMove: opponent(color),
    komi: state.komi,
    history: [...state.history, hash],
    moveNumber: state.moveNumber + 1,
    captures,
    consecutivePasses: 0,
    gameOver: false,
  }

  return { legal: true, state: nextState, captured }
}

/**
 * Todas las jugadas legales en la posicion actual, incluyendo pasar.
 * Util para el bot (MCTS) y para resaltar jugadas validas en la interfaz.
 */
export function listLegalMoves(state: GameState): Array<number | null> {
  const moves: Array<number | null> = []
  for (let p = 0; p < state.board.stones.length; p++) {
    if (state.board.stones[p] !== EMPTY) continue
    if (applyMove(state, p).legal) moves.push(p)
  }
  moves.push(null)
  return moves
}
