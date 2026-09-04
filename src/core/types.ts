export const EMPTY = 0
export const BLACK = 1
export const WHITE = 2

export type Color = typeof BLACK | typeof WHITE
export type PointValue = typeof EMPTY | Color

export function opponent(color: Color): Color {
  return color === BLACK ? WHITE : BLACK
}

export interface BoardState {
  width: number
  height: number
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

/**
 * Lista enlazada inmutable de hashes de posiciones ya vistas en esta
 * partida (para el chequeo de superko), del hash actual (`hash`) hacia
 * atras via `prev`. Antes era un array (`bigint[]`) que se copiaba entero
 * (`[...history, hash]`) y se recorria entero (`.includes(hash)`) en CADA
 * jugada -- costoso en el bot, que aplica cientos de miles de jugadas
 * simuladas por movimiento real (ver tests/engine/_debug-mcts-perf.test.ts
 * y NOTAS.md). La lista enlazada agrega el hash nuevo sin copiar nada
 * (`{ hash, prev: state.history }`, O(1)); el chequeo de superko sigue
 * siendo un recorrido de principio a fin (ver historyContains en
 * core/rules.ts), pero ya no paga tambien el costo de la copia.
 */
export interface HistoryNode {
  hash: bigint
  prev: HistoryNode | null
}

export interface GameState {
  board: BoardState
  toMove: Color
  komi: number
  history: HistoryNode
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
