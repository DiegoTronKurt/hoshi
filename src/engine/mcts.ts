import { applyMove, listLegalMoves } from '../core/rules'
import { computeAreaScore } from '../core/scoring'
import { BLACK, EMPTY, WHITE, opponent } from '../core/types'
import type { BoardState, Color, GameState } from '../core/types'
import { prepareStyleContext, styleWeight } from './botStyles'
import type { BotStyleId, StyleContext } from './botStyles'
import { createRng, shuffle } from './random'
import type { RandomFn } from './random'
import { findOneLibertyPoints, isSimpleEye, resultsInSelfAtari } from './playoutPolicy'

const EXPLORATION_CONSTANT = 1.4
const ATARI_RESPONSE_PROBABILITY = 0.9
const CAPTURE_PROBABILITY = 0.9
const DEFAULT_MAX_TIME_MS = 15000
/** Peso del termino de prioridad de red al elegir entre hijos de la RAIZ
 * (estilo PUCT de AlphaZero/KataGo, ver NOTAS-libro-katago-accelerating-selfplay.md).
 * Valor de partida sin calibrar contra partidas reales -- a diferencia de
 * EXPLORATION_CONSTANT (1.4, respaldado por la convencion UCB1 clasica, ver
 * NOTAS-libro-survey-mcts.md), este numero se ajusta con feedback real de
 * juego, no con una referencia externa. */
const ROOT_PRIOR_WEIGHT = 2.0

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

/** `priors`: solo se pasa para hijos de la RAIZ (ver chooseMove) -- nunca
 * hay una evaluacion de red por nodo mas profundo, solo una por jugada
 * real. Sin `priors`, `priorTerm` da exactamente 0 y el score queda
 * identico al de antes de que existiera este parametro. */
function selectUctChild(node: MctsNode, random: RandomFn, priors?: Map<number | null, number>): MctsNode {
  let best: MctsNode | null = null
  let bestScore = -Infinity
  for (const child of shuffle(node.children, random)) {
    const exploitation = child.wins / child.visits
    const exploration = EXPLORATION_CONSTANT * Math.sqrt(Math.log(node.visits) / child.visits)
    const priorTerm = priors ? (ROOT_PRIOR_WEIGHT * (priors.get(child.move) ?? 0)) / (1 + child.visits) : 0
    const score = exploitation + exploration + priorTerm
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

/** Elige el indice de `moves` a expandir a continuacion, ponderado por
 * `priors` en vez de uniforme -- solo se usa para las jugadas sin probar de
 * la RAIZ cuando hay una prioridad de red disponible (ver chooseMove). Si
 * `priors` no tiene peso para ninguna (suma <= 0, caso degenerado), cae de
 * vuelta a uniforme en vez de dividir por cero. */
function pickPriorWeightedIndex(moves: Array<number | null>, priors: Map<number | null, number>, random: RandomFn): number {
  const weights = moves.map((m) => priors.get(m) ?? 0)
  const total = weights.reduce((sum, w) => sum + w, 0)
  if (total <= 0) return Math.floor(random() * moves.length)

  let roll = random() * total
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return i
  }
  return moves.length - 1
}

/** Puntos vacios del tablero, sin ningun orden particular (quien llama
 * decide si hace falta barajarlos). Separado de shuffle para no pagar el
 * costo de barajar y despues descartar las piedras ya puestas: mas relevante
 * a medida que avanza la partida y quedan menos puntos vacios que casillas
 * totales. */
function emptyPoints(board: BoardState): number[] {
  const points: number[] = []
  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] === EMPTY) points.push(p)
  }
  return points
}

function choosePlayoutMove(state: GameState, random: RandomFn, style: BotStyleId): GameState {
  // Una sola pasada del tablero para las dos heuristicas de arriba (capturar,
  // salvar un atari propio) en vez de una pasada independiente por cada una
  // -- ver findOneLibertyPoints, es la porcion mas cara de una jugada
  // simulada, perfilada en tests/engine/_debug-mcts-perf.test.ts.
  const { ownAtariPoints, oppCapturePoints } = findOneLibertyPoints(state)

  if (oppCapturePoints.length > 0 && random() < CAPTURE_PROBABILITY) {
    for (const point of shuffle(oppCapturePoints, random)) {
      const result = applyMove(state, point)
      if (result.legal) return result.state as GameState
    }
  }

  if (ownAtariPoints.length > 0 && random() < ATARI_RESPONSE_PROBABILITY) {
    for (const point of shuffle(ownAtariPoints, random)) {
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
    for (const point of shuffle(emptyPoints(state.board), random)) {
      if (isSimpleEye(state.board, point, state.toMove)) continue
      const result = applyMove(state, point)
      if (!result.legal || !result.state) continue
      if (!fallback) fallback = result.state
      if (result.captured.length > 0 || !resultsInSelfAtari(result.state.board, point)) return result.state
    }
    return fallback ?? (applyMove(state, null).state as GameState)
  }

  const candidates: number[] = []
  for (const point of shuffle(emptyPoints(state.board), random)) {
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

/** Exportada para poder promediar muchos resultados de partida completa
 * directamente (Monte Carlo llano), sin pasar por el arbol UCT de
 * chooseMove -- util para comparar dos posiciones iniciales distintas
 * cuando el factor de ramificacion es tan grande (tableros grandes, pocas
 * piedras puestas) que el mejor hijo de la raiz recibe muy pocas visitas
 * y su winRate queda demasiado ruidoso para comparar (ver NOTAS.md,
 * investigacion de extension/direccion en Nivel 4). */
export function simulatePlayout(initialState: GameState, random: RandomFn, style: BotStyleId): GameState {
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
  /** Prioridad de la red de KataGo sobre las jugadas de la RAIZ unicamente
   * (ver eval/policy.ts::legalPolicyDistribution) -- nunca se pide una
   * evaluacion por nodo mas profundo, solo una por jugada real del bot.
   * Ausente: chooseMove es identico bit a bit al comportamiento anterior a
   * este campo (ver selectUctChild y el punto de expansion mas abajo). */
  rootPriors?: Map<number | null, number>
}

export interface MctsResult {
  move: number | null
  visits: number
  winRate: number
  playoutsRun: number
}

/**
 * El rival acaba de pasar: pasar ahora terminaria la partida. La busqueda UCT
 * no le da a "pasar" ninguna ventaja estructural sobre cualquier otra jugada
 * legal -- compite por visitas igual que cualquier punto vacio del tablero, y
 * con pocos playouts repartidos entre muchos candidatos (tableros grandes,
 * territorio ya asentado) puede terminar sin ser el hijo mas visitado aunque
 * la partida ya este decidida, dejando al bot jugando de mas en vez de
 * cerrarla. Se decide esto ANTES de gastar playouts en redescubrirlo: si no
 * hay ninguna jugada urgente ahora mismo (una captura gratis, o un grupo
 * propio en atari que rescatar -- mismos puntos que ya usa la politica de
 * playout, findOneLibertyPoints) y el puntaje de area de la posicion actual
 * ya favorece a quien le toca jugar, pasar es correcto.
 */
function shouldAcceptPass(state: GameState): boolean {
  if (state.consecutivePasses !== 1) return false

  const { ownAtariPoints, oppCapturePoints } = findOneLibertyPoints(state)
  if (ownAtariPoints.length > 0 || oppCapturePoints.length > 0) return false

  const score = computeAreaScore(state.board, state.komi)
  const myScore = state.toMove === BLACK ? score.black : score.white
  const oppScore = state.toMove === BLACK ? score.white : score.black
  return myScore >= oppScore
}

export function chooseMove(rootState: GameState, options: MctsOptions): MctsResult {
  if (rootState.gameOver) {
    return { move: null, visits: 0, winRate: 0, playoutsRun: 0 }
  }

  if (shouldAcceptPass(rootState)) {
    return { move: null, visits: 0, winRate: 1, playoutsRun: 0 }
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
      const priors = node === root ? options.rootPriors : undefined
      node = selectUctChild(node, random, priors)
      state = applyMove(state, node.move).state as GameState
      path.push(node)
    }

    if (node.untriedMoves.length > 0) {
      const index =
        node === root && options.rootPriors
          ? pickPriorWeightedIndex(node.untriedMoves, options.rootPriors, random)
          : Math.floor(random() * node.untriedMoves.length)
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
