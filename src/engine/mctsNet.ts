import { applyMove, listLegalMoves } from '../core/rules'
import { computeAreaScore } from '../core/scoring'
import { BLACK, opponent } from '../core/types'
import type { BoardState, Color, GameState } from '../core/types'
import { encodeInput } from '../eval/features'
import type { EvalMove } from '../eval/features'
import { evaluatePositionsBatch, legalPolicyDistribution } from '../eval/model'
import type { RawEvalOutput } from '../eval/model'
import type * as tf from '@tensorflow/tfjs'
import { shouldAcceptPass } from './mcts'
import type { MctsResult } from './mcts'

/**
 * Busqueda MCTS guiada por red (estilo PUCT de AlphaZero/KataGo), a
 * diferencia de engine/mcts.ts (MCTS clasico: rollout aleatorio hasta el
 * final de la partida, la red solo aporta un sesgo de orden en la RAIZ).
 * Aca la red decide en CADA nodo expandido, no solo en la raiz: su cabeza
 * de politica reemplaza el orden aleatorio de expansion, y su cabeza de
 * valor reemplaza el rollout completo como forma de puntuar una hoja.
 *
 * Medido esta sesion sobre el modelo vendorizado, con GPU real (WebGL sobre
 * ANGLE/D3D11, no el software renderer SwiftShader al que Chromium headless
 * cae por defecto sin --use-gl=angle/--use-angle=d3d11 -- con SwiftShader
 * cualquier lote tarda varios SEGUNDOS, no milisegundos, un resultado tan
 * distinto que casi lleva a una mala decision de diseño aca; ver NOTAS.md
 * para el detalle de como se detecto): con GPU real, leer los resultados de
 * vuelta (`.data()`, incluido en evaluatePositionsBatch) cuesta ~15-25ms por
 * posicion en un lote de 16 ya en caliente -- por eso vale la pena juntar
 * varias hojas por llamada (ver BATCH_SIZE) en vez de evaluar una por una.
 * codificar una posicion (eval/features.ts) agrega ~1.5ms mas, aparte. No
 * verificado todavia en un dispositivo Android real (el WebView de
 * hoshi-flutter) -- el numero de arriba es de una GPU de escritorio via
 * Playwright, la mejor referencia disponible esta sesion, no una medicion
 * en el dispositivo final.
 *
 * Sin ruido de Dirichlet en la raiz a proposito: eso es una tecnica para
 * diversificar partidas de auto-juego usadas como datos de entrenamiento,
 * no para jugar la mejor jugada posible contra un rival real -- agregarlo
 * aca haria al bot mas debil, no mas fuerte, para el uso que tiene esta app.
 */

const PUCT_CONSTANT = 1.5
/** Cuantas hojas se juntan en una sola llamada a la red por tanda. Numero
 * de partida razonado a partir de la medicion de arriba (el costo por
 * llamada es casi constante entre 1 y 32), no calibrado contra partidas
 * reales -- mismo espiritu que ROOT_PRIOR_WEIGHT/EXPLORATION_CONSTANT en
 * engine/mcts.ts. */
const BATCH_SIZE = 16
/** Cuanto se "castiga" temporalmente a un nodo elegido dentro de la misma
 * tanda para que la siguiente seleccion de la tanda tienda a explorar otro
 * camino, en vez de elegir la misma hoja varias veces antes de que llegue
 * ningun resultado real de la red (tecnica estandar, "virtual loss"). Se
 * deshace apenas se conoce el valor real de esa hoja. */
const VIRTUAL_LOSS = 1
/** Presupuesto de tiempo por defecto si quien llama no especifica uno --
 * bastante mas largo que el techo de 15s del MCTS clasico (ver
 * DEFAULT_MAX_TIME_MS en engine/mcts.ts): este modo es explicitamente
 * "mas lento mas fuerte", no un reemplazo directo de los niveles rapidos.
 * Exportada para que engine/client.ts pueda calcular el mismo timeout de
 * respaldo del lado del Worker sin duplicar el numero. */
export const NET_DEFAULT_MAX_TIME_MS = 30000

interface NetNode {
  move: number | null
  parent: NetNode | null
  children: NetNode[]
  prior: number
  visits: number
  valueSum: number
  toMove: Color
  expanded: boolean
  terminal: boolean
}

function createChild(move: number | null, parent: NetNode, toMove: Color, prior: number): NetNode {
  return { move, parent, children: [], prior, visits: 0, valueSum: 0, toMove, expanded: false, terminal: false }
}

/** Puntaje PUCT de `child` desde el punto de vista de su padre: Q se
 * invierte (1 - promedio) porque valueSum de un hijo esta guardado desde
 * la perspectiva de quien mueve EN ese hijo, que es el rival de quien elige
 * entre los hijos. Sin visitas todavia: Q neutro (0.5), solo el termino de
 * prioridad decide -- ninguna "primera jugada urgente" artificial. */
function puctScore(parent: NetNode, child: NetNode): number {
  const q = child.visits > 0 ? 1 - child.valueSum / child.visits : 0.5
  const exploration = (PUCT_CONSTANT * child.prior * Math.sqrt(parent.visits)) / (1 + child.visits)
  return q + exploration
}

function selectPuctChild(node: NetNode): NetNode {
  let best: NetNode | null = null
  let bestScore = -Infinity
  for (const child of node.children) {
    const score = puctScore(node, child)
    if (score > bestScore) {
      bestScore = score
      best = child
    }
  }
  return best as NetNode
}

function applyVirtualLoss(path: NetNode[]): void {
  for (const node of path) {
    node.visits += VIRTUAL_LOSS
    node.valueSum += VIRTUAL_LOSS
  }
}

function undoVirtualLoss(path: NetNode[]): void {
  for (const node of path) {
    node.visits -= VIRTUAL_LOSS
    node.valueSum -= VIRTUAL_LOSS
  }
}

/** Ver el comentario de backprop() mas abajo para la convencion de signo. */
function backprop(path: NetNode[], leafValue: number): void {
  let v = leafValue
  for (let i = path.length - 1; i >= 0; i--) {
    path[i].visits += 1
    path[i].valueSum += v
    v = 1 - v
  }
}

function expandFromPolicy(node: NetNode, state: GameState, policy: Float32Array): void {
  const legalMoves = listLegalMoves(state)
  const legalPoints = legalMoves.filter((m): m is number => m !== null)
  const distribution = legalPolicyDistribution(policy, legalPoints, true, state.board.width)
  const childColor = opponent(state.toMove)
  node.children = legalMoves.map((move) => createChild(move, node, childColor, distribution.get(move) ?? 0))
  node.expanded = true
}

export interface MctsNetOptions {
  playouts: number
  maxTimeMs?: number
  /** Historial real de la partida hasta la posicion raiz (para que la
   * codificacion de entrada de los nodos del arbol tenga el mismo contexto
   * que tendria una jugada real, no una posicion "fresca" en cada nodo). */
  recentMoves?: EvalMove[]
  priorBoards?: BoardState[]
}

export async function chooseMoveWithNet(
  rootState: GameState,
  model: tf.GraphModel,
  options: MctsNetOptions,
): Promise<MctsResult> {
  if (rootState.gameOver) return { move: null, visits: 0, winRate: 0, playoutsRun: 0 }
  if (shouldAcceptPass(rootState)) return { move: null, visits: 0, winRate: 1, playoutsRun: 0 }

  const maxTimeMs = options.maxTimeMs ?? NET_DEFAULT_MAX_TIME_MS

  const root: NetNode = {
    move: null,
    parent: null,
    children: [],
    prior: 1,
    visits: 0,
    valueSum: 0,
    toMove: rootState.toMove,
    expanded: false,
    terminal: false,
  }

  const rootRecentMoves = options.recentMoves ?? []
  const rootPriorBoards = options.priorBoards ?? []

  // Expande la raiz de una sola vez, ANTES de la tanda principal: si se
  // dejara para la primera tanda, las B selecciones de esa tanda arrancarian
  // todas desde una raiz sin hijos todavia y "colapsarian" en la misma hoja
  // (la raiz misma) en vez de diversificarse.
  {
    const input = encodeInput({ state: rootState, recentMoves: rootRecentMoves, priorBoards: rootPriorBoards })
    const [output] = await evaluatePositionsBatch(model, [input])
    expandFromPolicy(root, rootState, output.policy)
    backprop([root], output.value[0])
  }

  if (root.children.length === 0) return { move: null, visits: 0, winRate: 0, playoutsRun: 0 }

  const startedAt = Date.now()
  let playoutsRun = 0

  while (playoutsRun < options.playouts && Date.now() - startedAt < maxTimeMs) {
    const remaining = options.playouts - playoutsRun
    const roundSize = Math.min(BATCH_SIZE, remaining)

    interface PendingLeaf {
      path: NetNode[]
      state: GameState
      recentMoves: EvalMove[]
      priorBoards: BoardState[]
    }
    const pending: PendingLeaf[] = []
    const pendingNodes = new Set<NetNode>()
    const roundStartPlayouts = playoutsRun

    for (let i = 0; i < roundSize; i++) {
      const path: NetNode[] = [root]
      let node = root
      let state = rootState
      let recentMoves = rootRecentMoves
      let priorBoards = rootPriorBoards

      while (node.expanded && !node.terminal && node.children.length > 0) {
        const child = selectPuctChild(node)
        priorBoards = [...priorBoards, state.board].slice(-2)
        recentMoves = [...recentMoves, { color: state.toMove, point: child.move }].slice(-5)
        const applied = applyMove(state, child.move)
        // child.move viene de listLegalMoves sobre este mismo `state` (ver
        // expandFromPolicy) -- applyMove es puro/deterministico, asi que
        // repetir la misma jugada sobre el mismo estado no puede fallar.
        // Si esto llega a tirar, hay un bug real de reutilizacion del
        // arbol, no un caso valido a tolerar en silencio.
        if (!applied.legal || !applied.state) {
          throw new Error('mctsNet: jugada de un hijo ya expandido resulto ilegal al repetirla')
        }
        state = applied.state
        node = child
        path.push(node)
      }

      if (Date.now() - startedAt >= maxTimeMs) break

      if (state.gameOver) {
        node.terminal = true
        const score = computeAreaScore(state.board, state.komi)
        const nodeIsBlack = node.toMove === BLACK
        const myArea = nodeIsBlack ? score.black : score.white
        const oppArea = nodeIsBlack ? score.white : score.black
        const value = myArea > oppArea ? 1 : myArea < oppArea ? 0 : 0.5
        backprop(path, value)
        playoutsRun++
        continue
      }

      if (pendingNodes.has(node)) continue // misma hoja sin resolver todavia, ver VIRTUAL_LOSS arriba
      pendingNodes.add(node)
      applyVirtualLoss(path)
      pending.push({ path, state, recentMoves, priorBoards })
    }

    if (pending.length === 0) {
      // Ni una hoja nueva para evaluar ni un playout terminal contado en toda
      // la tanda: el arbol ya esta completamente agotado (cada linea posible
      // ya se expandio del todo), no queda nada por explorar. Comparar
      // contra roundStartPlayouts (no contra 0) es lo que hace que esto siga
      // pudiendo cortar una tanda tardia sin progreso, no solo la primera.
      if (playoutsRun === roundStartPlayouts) break
      continue
    }

    const inputs = pending.map(({ state, recentMoves, priorBoards }) =>
      encodeInput({ state, recentMoves, priorBoards }),
    )
    const outputs: RawEvalOutput[] = await evaluatePositionsBatch(model, inputs)

    for (let i = 0; i < pending.length; i++) {
      const { path, state } = pending[i]
      const leaf = path[path.length - 1]
      undoVirtualLoss(path)
      expandFromPolicy(leaf, state, outputs[i].policy)
      backprop(path, outputs[i].value[0])
      playoutsRun++
    }
  }

  let bestChild: NetNode | null = null
  for (const child of root.children) {
    if (!bestChild || child.visits > bestChild.visits) bestChild = child
  }

  if (!bestChild || bestChild.visits === 0) return { move: null, visits: 0, winRate: 0, playoutsRun }

  return {
    move: bestChild.move,
    visits: bestChild.visits,
    winRate: 1 - bestChild.valueSum / bestChild.visits,
    playoutsRun,
  }
}
