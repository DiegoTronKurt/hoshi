export const EMPTY = 0
export const BLACK = 1
export const WHITE = 2

export type Color = typeof BLACK | typeof WHITE
export type PointValue = typeof EMPTY | Color

export function opponent(color: Color): Color {
  return color === BLACK ? WHITE : BLACK
}

export interface BoardState {
  size: number
  stones: Int8Array
}

export interface Group {
  color: Color
  stones: number[]
  liberties: Set<number>
}

export interface Captures {
  black: number
  white: number
}

export type IllegalReason = 'occupied' | 'suicide' | 'superko' | 'game_over'

export interface GameState {
  board: BoardState
  toMove: Color
  komi: number
  history: bigint[]
  moveNumber: number
  captures: Captures
  consecutivePasses: number
  gameOver: boolean
}

export interface MoveResult {
  legal: boolean
  reason?: IllegalReason
  state?: GameState
  captured: number[]
}
