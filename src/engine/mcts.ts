import { applyMove, listLegalMoves } from '../core/rules'
import { computeAreaScore } from '../core/scoring'
import { BLACK, EMPTY, WHITE, opponent } from '../core/types'
import type { Color, GameState } from '../core/types'
import { prepareStyleContext, styleWeight } from './botStyles'
import type { BotStyleId, StyleContext } from './botStyles'
import { createRng, shuffle, shuffledIndices } from './random'
import type { RandomFn } from './random'
import { findAtariSavingMoves, findCapturingMoves, isSimpleEye, resultsInSelfAtari } from './playoutPolicy'

const EXPLORATION_CONSTANT = 1.4
const ATARI_RESPONSE_PROBABILITY = 0.9
const CAPTURE_PROBABILITY = 0.9
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

/** Elige, entre los candidatos legales de `points`, uno al azar ponderado por
 * `styleWeight` (sin reemplazo: si el elegido resulta ilegal, se descarta y
 * se reintenta entre el resto). Casi siempre acierta a la primera, ya que
 * las unicas jugadas ilegales entre puntos vacios sin ojo simple son
 * superko o suicidio real, ambos poco frecuentes.
 *
 * Ademas evita auto-atari cuando hay alternativa: si el candidato elegido
 * deja a su propio grupo con una sola libertad y no capturo nada, se
 * recuerda como respaldo y se reintenta entre el resto en vez de jugarlo de
 * una -- el mismo applyMove ya calculado se reutiliza, sin costo extra. */
function pickWeightedMove(state: GameState, points: number[], ctx: StyleContext, random: RandomFn): GameState | null {
  let remaining = points
  let weights = points.map((p) => styleWeight(ctx, state.board, p))
  let fallback: GameState | null = null

  while (remaining.length > 0) {
    const total = weights.reduce((sum, w) => sum + w, 0)
    let roll = random() * total
    let index = remaining.length - 1
    for (let i = 0; i < remaining.length; i++) {
      roll -= weights[i]
      if (roll <= 0) {
        index = i
        break
      }
    }

    const point = remaining[index]
    const result = applyMove(state, point)
    if (result.legal && result.state) {
      const selfAtari = result.captured.length === 0 && resultsInSelfAtari(result.state.board, point)
      if (!selfAtari) return result.state
      if (!fallback) fallback = result.state
      if (remaining.length === 1) return fallback
    }

    remaining = remaining.filter((_, i) => i !== index)
    weights = weights.filter((_, i) => i !== index)
  }

  return fallback
}

function choosePlayoutMove(state: GameState, random: RandomFn, style: BotStyleId): GameState {
  const capturingMoves = findCapturingMoves(state)
  if (capturingMoves.length > 0 && random() < CAPTURE_PROBABILITY) {
    for (const point of shuffle(capturingMoves, random)) {
      const result = applyMove(state, point)
      if (result.legal) return result.state as GameState
    }
  }

  const atariSaves = findAtariSavingMoves(state)
  if (atariSaves.length > 0 && random() < ATARI_RESPONSE_PROBABILITY) {
    for (const point of shuffle(atariSaves, random)) {
      const result = applyMove(state, point)
      if (result.legal) return result.state as GameState
    }
  }

  if (style === 'standard') {
    // Ruta identica a la de siempre, sin el costo de preparar un contexto de
    // estilo: el bot "Estandar" debe comportarse exactamente como antes de
    // que existieran los estilos. Recorre las candidatas en orden al azar y
    // prefiere la primera que no sea auto-atari, pero guarda la primera
    // legal como respaldo por si todas lo fueran (jugada forzada).
    let fallback: GameState | null = null
    for (const point of shuffledIndices(state.board.stones.length, random)) {
      if (state.board.stones[point] !== EMPTY) continue
      if (isSimpleEye(state.board, point, state.toMove)) continue
      const result = applyMove(state, point)
      if (!result.legal || !result.state) continue
      if (!fallback) fallback = result.state
      if (result.captured.length > 0 || !resultsInSelfAtari(result.state.board, point)) return result.state
    }
    return fallback ?? (applyMove(state, null).state as GameState)
  }

  const candidates: number[] = []
  for (const point of shuffledIndices(state.board.stones.length, random)) {
    if (state.board.stones[point] !== EMPTY) continue
    if (isSimpleEye(state.board, point, state.toMove)) continue
    candidates.push(point)
  }

  if (candidates.length > 0) {
    const ctx = prepareStyleContext(style, state.board, state.toMove)
    const picked = pickWeightedMove(state, candidates, ctx, random)
    if (picked) return picked
  }

  return applyMove(state, null).state as GameState
}

function simulatePlayout(initialState: GameState, random: RandomFn, style: BotStyleId): GameState {
  let state = initialState
  const maxMoves = state.board.stones.length * 3
  let played = 0
  while (!state.gameOver && played < maxMoves) {
    state = choosePlayoutMove(state, random, style)
    played++
  }
  return state
}

export interface MctsOptions {
  playouts: number
  randomSeed?: number
  maxTimeMs?: number
  /** Estilo de juego elegido a mano para el bot (ver engine/botStyles.ts).
   * 'standard' por defecto: el comportamiento de siempre, sin sesgo. */
  style?: BotStyleId
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
  const style = options.style ?? 'standard'
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

    const finalState = simulatePlayout(state, random, style)
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
