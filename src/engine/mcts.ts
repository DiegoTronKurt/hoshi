import { applyMove, listLegalMoves } from '../core/rules'
import { computeAreaScore } from '../core/scoring'
import { BLACK, EMPTY, WHITE, opponent } from '../core/types'
import type { Color, GameState } from '../core/types'
import { createRng, shuffle, shuffledIndices } from './random'
import type { RandomFn } from './random'
import { findAtariSavingMoves, isSimpleEye } from './playoutPolicy'

const EXPLORATION_CONSTANT = 1.4
const ATARI_RESPONSE_PROBABILITY = 0.9
const DEFAULT_MAX_TIME_MS = 15000

interface MctsNode {
  move: number | null
  parent: MctsNode | null
  children: MctsNode[]
  untriedMoves: Array<number | null>
  visits: number
  wins: number
  toMove: Color
}

function createNode(move: number | null, parent: MctsNode | null, state: GameState): MctsNode {
  return {
    move,
    parent,
    children: [],
    untriedMoves: state.gameOver ? [] : listLegalMoves(state),
    visits: 0,
    wins: 0,
    toMove: state.toMove,
  }
}

function selectUctChild(node: MctsNode, random: RandomFn): MctsNode {
  let best: MctsNode | null = null
  let bestScore = -Infinity
  for (const child of shuffle(node.children, random)) {
    const exploitation = child.wins / child.visits
    const exploration = EXPLORATION_CONSTANT * Math.sqrt(Math.log(node.visits) / child.visits)
    const score = exploitation + exploration
    if (score > bestScore) {
      bestScore = score
      best = child
    }
  }
  return best as MctsNode
}

function choosePlayoutMove(state: GameState, random: RandomFn): GameState {
  const atariSaves = findAtariSavingMoves(state)
  if (atariSaves.length > 0 && random() < ATARI_RESPONSE_PROBABILITY) {
    for (const point of shuffle(atariSaves, random)) {
      const result = applyMove(state, point)
      if (result.legal) return result.state as GameState
    }
  }

  const size = state.board.size
  for (const point of shuffledIndices(size * size, random)) {
    if (state.board.stones[point] !== EMPTY) continue
    if (isSimpleEye(state.board, point, state.toMove)) continue
    const result = applyMove(state, point)
    if (result.legal) return result.state as GameState
  }

  return applyMove(state, null).state as GameState
}

function simulatePlayout(initialState: GameState, random: RandomFn): GameState {
  let state = initialState
  const maxMoves = state.board.size * state.board.size * 3
  let played = 0
  while (!state.gameOver && played < maxMoves) {
    state = choosePlayoutMove(state, random)
    played++
  }
  return state
}

export interface MctsOptions {
  playouts: number
  randomSeed?: number
  maxTimeMs?: number
}

export interface MctsResult {
  move: number | null
  visits: number
  winRate: number
  playoutsRun: number
}

export function chooseMove(rootState: GameState, options: MctsOptions): MctsResult {
  if (rootState.gameOver) {
    return { move: null, visits: 0, winRate: 0, playoutsRun: 0 }
  }

  const random = createRng(options.randomSeed ?? Date.now())
  const maxTimeMs = options.maxTimeMs ?? DEFAULT_MAX_TIME_MS
  const root = createNode(null, null, rootState)
  const startedAt = Date.now()
  let playoutsRun = 0

  for (let i = 0; i < options.playouts; i++) {
    if (Date.now() - startedAt > maxTimeMs) break

    let node = root
    let state = rootState
    const path: MctsNode[] = [node]

    while (node.untriedMoves.length === 0 && node.children.length > 0) {
      node = selectUctChild(node, random)
      state = applyMove(state, node.move).state as GameState
      path.push(node)
    }

    if (node.untriedMoves.length > 0) {
      const index = Math.floor(random() * node.untriedMoves.length)
      const move = node.untriedMoves[index]
      node.untriedMoves.splice(index, 1)
      state = applyMove(state, move).state as GameState
      const child = createNode(move, node, state)
      node.children.push(child)
      node = child
      path.push(node)
    }

    const finalState = simulatePlayout(state, random)
    const score = computeAreaScore(finalState.board, finalState.komi)
    const winner: Color = score.black > score.white ? BLACK : WHITE

    for (const n of path) {
      n.visits++
      if (opponent(n.toMove) === winner) n.wins++
    }

    playoutsRun++
  }

  let bestChild: MctsNode | null = null
  for (const child of root.children) {
    if (!bestChild || child.visits > bestChild.visits) bestChild = child
  }

  if (!bestChild) {
    return { move: null, visits: 0, winRate: 0, playoutsRun }
  }

  return {
    move: bestChild.move,
    visits: bestChild.visits,
    winRate: bestChild.wins / bestChild.visits,
    playoutsRun,
  }
}
