import type { EvalMove, EvalPosition } from './features'
import type { RawEvalOutput } from './model'
import type { BoardState, Captures, Color, GameState, HistoryNode } from '../core/types'

/**
 * Codec JSON para EvalPosition/RawEvalOutput -- necesario para E3 (inferencia
 * remota opcional): el RPC del Worker local usa clonado estructurado (los
 * Int8Array/Float32Array/bigint de GameState/RawEvalOutput viajan tal cual),
 * pero una peticion HTTP a un servidor remoto solo tiene JSON. `history`
 * (lista enlazada de hashes bigint, para el chequeo real de superko -- ver
 * el comentario de HistoryNode en core/types.ts) es la parte no trivial: se
 * aplana a un arreglo de strings (bigint no es serializable en JSON), de mas
 * nuevo a mas viejo, y se reconstruye la lista enlazada al decodificar.
 */

interface WireBoardState {
  width: number
  height: number
  stones: number[]
}

export interface WireGameState {
  board: WireBoardState
  toMove: Color
  komi: number
  /** Hashes de HistoryNode como strings decimales, del actual (`[0]`) hacia
   * atras -- el mismo orden en que ya se recorre la lista enlazada real. */
  history: string[]
  moveNumber: number
  captures: Captures
  consecutivePasses: number
  gameOver: boolean
}

export interface WireEvalPosition {
  state: WireGameState
  recentMoves?: EvalMove[]
  priorBoards?: WireBoardState[]
}

export interface WireRawEvalOutput {
  policy: number[]
  value: [number, number, number]
  ownership: number[]
}

function encodeBoardState(board: BoardState): WireBoardState {
  return { width: board.width, height: board.height, stones: Array.from(board.stones) }
}

function decodeBoardState(wire: WireBoardState): BoardState {
  return { width: wire.width, height: wire.height, stones: Int8Array.from(wire.stones) }
}

function encodeHistory(history: HistoryNode): string[] {
  const hashes: string[] = []
  let node: HistoryNode | null = history
  while (node) {
    hashes.push(node.hash.toString())
    node = node.prev
  }
  return hashes
}

/** Asume `hashes` no vacio -- valido siempre que venga de encodeHistory,
 * que siempre agrega al menos el hash actual (GameState.history nunca es
 * null, ver core/types.ts). */
function decodeHistory(hashes: string[]): HistoryNode {
  let node: HistoryNode = { hash: BigInt(hashes[hashes.length - 1]), prev: null }
  for (let i = hashes.length - 2; i >= 0; i--) {
    node = { hash: BigInt(hashes[i]), prev: node }
  }
  return node
}

export function encodeEvalPosition(position: EvalPosition): WireEvalPosition {
  const { state } = position
  return {
    state: {
      board: encodeBoardState(state.board),
      toMove: state.toMove,
      komi: state.komi,
      history: encodeHistory(state.history),
      moveNumber: state.moveNumber,
      captures: state.captures,
      consecutivePasses: state.consecutivePasses,
      gameOver: state.gameOver,
    },
    recentMoves: position.recentMoves,
    priorBoards: position.priorBoards?.map(encodeBoardState),
  }
}

export function decodeEvalPosition(wire: WireEvalPosition): EvalPosition {
  const state: GameState = {
    board: decodeBoardState(wire.state.board),
    toMove: wire.state.toMove,
    komi: wire.state.komi,
    history: decodeHistory(wire.state.history),
    moveNumber: wire.state.moveNumber,
    captures: wire.state.captures,
    consecutivePasses: wire.state.consecutivePasses,
    gameOver: wire.state.gameOver,
  }
  return {
    state,
    recentMoves: wire.recentMoves,
    priorBoards: wire.priorBoards?.map(decodeBoardState),
  }
}

export function encodeRawEvalOutput(output: RawEvalOutput): WireRawEvalOutput {
  return { policy: Array.from(output.policy), value: output.value, ownership: Array.from(output.ownership) }
}

export function decodeRawEvalOutput(wire: WireRawEvalOutput): RawEvalOutput {
  return { policy: Float32Array.from(wire.policy), value: wire.value, ownership: Float32Array.from(wire.ownership) }
}
