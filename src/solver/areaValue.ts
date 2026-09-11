import { toXY } from '../core/board'
import { bensonPassAlive } from '../core/benson'
import { applyMove, gameStateFromBoard } from '../core/rules'
import { computeAreaScore } from '../core/scoring'
import { BLACK, EMPTY, opponent } from '../core/types'
import type { BoardState, Color } from '../core/types'

/** Mismo komi fijo que usa el resto del banco generado (ver BOARD_SIZE en
 * generate-problems.ts). El delta de area entre dos jugadas del mismo color
 * no depende del komi (se cancela: es una constante en ambos lados de la
 * resta), asi que no hace falta guardarlo por problema. */
const KOMI = 6.5

/** Mismo umbral que detectPasePrematuro en analysis/mistakes.ts: una
 * jugada solo cuenta como "vale la pena" si mejora el area en mas de 2
 * puntos. Todo este archivo (generador y validacion en vivo) usa esta
 * misma constante para no ensenar una regla distinta a la que aplica el
 * detector de partida real. */
export const PASS_VALUE_THRESHOLD = 2

function colorKey(color: Color): 'black' | 'white' {
  return color === BLACK ? 'black' : 'white'
}

/** Diferencia de area que deja jugar `point` para `color`, contra la
 * posicion actual. null si `point` no es una jugada legal. */
export function areaDeltaForPoint(board: BoardState, point: number, color: Color): number | null {
  const key = colorKey(color)
  const baseline = computeAreaScore(board, KOMI)[key]
  const state = gameStateFromBoard(board, color)
  const result = applyMove(state, point)
  if (!result.legal || !result.state) return null
  const score = computeAreaScore(result.state.board, KOMI)[key]
  return score - baseline
}

/**
 * La mejor jugada disponible para `color` medida en diferencia de area
 * (mismo calculo que detectPasePrematuro): null si ninguna supera el
 * umbral, es decir, si pasar es la jugada correcta.
 */
export function bestAreaMove(board: BoardState, color: Color): { point: number; delta: number } | null {
  let best: { point: number; delta: number } | null = null
  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] !== EMPTY) continue
    const delta = areaDeltaForPoint(board, p, color)
    if (delta !== null && delta > PASS_VALUE_THRESHOLD && (!best || delta > best.delta)) {
      best = { point: p, delta }
    }
  }
  return best
}

/**
 * True si `point` empata (o, por construccion de bestAreaMove, nunca supera)
 * el mejor delta de area disponible para `color` en este tablero. A
 * diferencia de comparar contra `bestAreaMove(board, color)?.point`,
 * cualquier punto que empate en delta cuenta como correcto -- bestAreaMove
 * devuelve un solo punto (el primero que encuentra con el delta maximo),
 * pero si dos o mas puntos separados empatan en ese maximo, todos son
 * igualmente la mejor jugada real y ninguno deberia rechazarse solo por no
 * ser el que bestAreaMove eligio arbitrariamente entre los empatados.
 */
export function isBestAreaMove(board: BoardState, point: number, color: Color): boolean {
  const delta = areaDeltaForPoint(board, point, color)
  if (delta === null) return false
  const best = bestAreaMove(board, color)
  return best !== null && delta >= best.delta
}

/**
 * Costo aproximado (un solo ply) de haber jugado `playedPoint` en vez de la
 * mejor alternativa disponible en esa misma posicion: diferencia entre el
 * area que hubiera dejado la mejor jugada legal y la que dejo realmente
 * `playedPoint`. 0 si `playedPoint` ya era la mejor. Mismo mecanismo de un
 * solo ply que bestAreaMove, sin su umbral de 2 puntos (aca interesa la
 * diferencia real, no si vale la pena jugar) -- pensado para jugadas
 * "desperdiciadas" (ojo propio, territorio propio, triangulo vacio, primera
 * linea temprana) donde nada se captura, asi que no hay ningun evento real
 * futuro que medir, solo la alternativa inmediata.
 */
export function estimateMoveCost(board: BoardState, playedPoint: number, color: Color): number {
  const playedDelta = areaDeltaForPoint(board, playedPoint, color) ?? 0
  let bestDelta = playedDelta
  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] !== EMPTY || p === playedPoint) continue
    const delta = areaDeltaForPoint(board, p, color)
    if (delta !== null && delta > bestDelta) bestDelta = delta
  }
  return Math.max(0, bestDelta - playedDelta)
}

/**
 * Costo REAL (no hipotetico) de una captura que ya ocurrio en la partida
 * grabada: diferencia de area para `color` entre el estado justo antes y
 * justo despues de esa jugada real. A diferencia de areaDeltaForPoint (que
 * evalua una jugada candidata sobre la posicion actual), esta funcion no
 * inventa nada -- toma dos posiciones reales de la partida ya jugada, asi
 * que el numero que devuelve es un hecho de esa partida, no una estimacion.
 */
export function realizedAreaCost(beforeBoard: BoardState, afterBoard: BoardState, komi: number, color: Color): number {
  const key = colorKey(color)
  const before = computeAreaScore(beforeBoard, komi)[key]
  const after = computeAreaScore(afterBoard, komi)[key]
  return Math.max(0, before - after)
}

/**
 * True si `point` cae dentro del territorio pass-alive propio de `color`
 * (mismo chequeo que detectRellenoTerritorioPropio: sin cadenas pass-alive
 * todavia, no hay territorio que rellenar).
 */
export function isOwnTerritory(board: BoardState, point: number, color: Color): boolean {
  const { chains, territoryPoints } = bensonPassAlive(board, color)
  if (chains.length === 0) return false
  return territoryPoints.includes(point)
}

function chebyshevDistance(width: number, a: number, b: number): number {
  const [ax, ay] = toXY(width, a)
  const [bx, by] = toXY(width, b)
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by))
}

/**
 * Igual que bestAreaMove, pero restringido a una region alrededor de
 * `center` (distancia Chebyshev, misma nocion de "cerca" que ya usa el
 * agrupamiento de tools/generate-whole-board-judgment-problems.ts).
 * `inside`=true busca solo dentro del radio (la respuesta "local" a una
 * jugada); `inside`=false busca solo afuera (la mejor alternativa en
 * cualquier otra parte del tablero, para simular un tenuki).
 * `minDelta` (por defecto PASS_VALUE_THRESHOLD, igual que bestAreaMove) es
 * ajustable a proposito: classifySenteGote necesita medir el mejor
 * seguimiento posible en una region SIN piso minimo (un castigo modesto
 * sigue siendo el mejor castigo disponible, y comparar contra el tenuki es
 * lo que decide si vale la pena -- exigirle el mismo umbral que "vale la
 * pena jugar en general" lo devolveria null en vez de un gote real). Bloque
 * comun de classifySenteGote, expuesto por si otro generador necesita el
 * mismo recorte espacial mas adelante.
 */
export function bestAreaMoveInRegion(
  board: BoardState,
  color: Color,
  center: number,
  radius: number,
  inside: boolean,
  minDelta: number = PASS_VALUE_THRESHOLD,
): { point: number; delta: number } | null {
  let best: { point: number; delta: number } | null = null
  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] !== EMPTY) continue
    const near = chebyshevDistance(board.width, p, center) <= radius
    if (near !== inside) continue
    const delta = areaDeltaForPoint(board, p, color)
    if (delta !== null && delta > minDelta && (!best || delta > best.delta)) {
      best = { point: p, delta }
    }
  }
  return best
}

/** Radio (distancia Chebyshev) que separa "responder localmente a la jugada"
 * de "jugar en otra parte del tablero" -- mismo orden de magnitud que una
 * secuencia de yose real (una jugada y su respuesta inmediata caen dentro de
 * un area de 3-4 puntos alrededor). Ver classifySenteGote. */
const SENTE_LOCAL_RADIUS = 3

/** Diferencia minima (en puntos de area) entre "seguir la amenaza" y "cobrar
 * el tenuki" para considerar la respuesta realmente forzada. En 0, no en un
 * margen tipo PASS_VALUE_THRESHOLD: probado primero en 2 contra partidas de
 * autojuego reales (9x9, tools/generate-sente-gote-problems.ts) y el gap
 * real de una jugada sente genuina en yose casi nunca supera los 2-3 puntos
 * (a diferencia de "vale la pena jugar en general", que compara contra
 * pasar) -- con umbral 2 el generador no encontraba PRACTICAMENTE ninguna
 * posicion en partidas reales (confirmado con un script de diagnostico, ver
 * NOTAS.md); con 0 aparecen con una frecuencia sana y creciente segun avanza
 * la partida. Cualquier gap positivo, por chico que sea, ya significa que
 * ignorar cuesta mas que responder -- que es exactamente la definicion de
 * sente, sin necesidad de un margen extra. */
const SENTE_GAP_THRESHOLD = 0

export type SenteGoteResult = 'sente' | 'gote'

/**
 * Clasifica una jugada candidata como sente o gote comparando dos ramas de 2
 * jugadas mas (ver NOTAS.md para la discusion completa de por que esta
 * aproximacion, no una busqueda minimax real):
 *
 * 1. Rama "responde": el rival TIENE alguna jugada local disponible dentro
 *    de SENTE_LOCAL_RADIUS de `point` (no importa cuanto valga esa
 *    respuesta en area justo ahora -- una jugada de rescate como extender un
 *    grupo en atari no vale nada en area hasta que la captura real pasa mas
 *    adelante, asi que no se le exige el umbral de bestAreaMoveInRegion).
 * 2. Rama "ignora": el rival juega en otra parte del tablero (su mejor
 *    jugada FUERA de ese radio -- un tenuki real, no hipotetico), y `color`
 *    aprovecha con su propio mejor seguimiento local.
 *
 * Si el seguimiento de `color` en la rama "ignora" vale claramente mas que
 * lo que el tenuki le dejo al rival (por encima de SENTE_GAP_THRESHOLD), la
 * jugada original efectivamente OBLIGABA a responder -- sente. Si no, el
 * rival sale ganando con el tenuki -- gote. Devuelve null cuando la posicion
 * no permite una comparacion real (sin amenaza local que responder, o sin
 * ninguna alternativa de tenuki que valga la pena) en vez de forzar una
 * etiqueta sin base.
 *
 * Deliberadamente NO es una busqueda de juego real (no hay engine de por
 * medio): reusa el mismo mecanismo de un solo delta de area por jugada que
 * ya usa el resto de este archivo, aplicado dos veces con el recorte
 * espacial de bestAreaMoveInRegion. Mas barato y determinista que MCTS, a
 * costa de no capturar secuencias mas largas o amenazas que abarcan varias
 * jugadas -- aceptable para el nivel de "reconocer sente vs. gote" que
 * ensena SENTE_ANTES_QUE_GOTE, no para analisis profesional.
 */
export function classifySenteGote(board: BoardState, point: number, color: Color): SenteGoteResult | null {
  const rival = opponent(color)
  const state = gameStateFromBoard(board, color)
  const afterMove = applyMove(state, point)
  if (!afterMove.legal || !afterMove.state) return null
  const afterM = afterMove.state.board

  // Solo hace falta saber que el rival TIENE alguna respuesta local
  // disponible -- no se usa su valor (una jugada de rescate como extender un
  // grupo en atari suele valer poco o nada en area en el momento mismo, la
  // captura real todavia no paso -- exigirle el mismo umbral que
  // bestAreaMoveInRegion la haria invisible aca). Sin threshold a proposito.
  let hasLocalReply = false
  for (let p = 0; p < afterM.stones.length && !hasLocalReply; p++) {
    if (afterM.stones[p] !== EMPTY) continue
    if (chebyshevDistance(afterM.width, p, point) <= SENTE_LOCAL_RADIUS) hasLocalReply = true
  }
  if (!hasLocalReply) return null

  const tenuki = bestAreaMoveInRegion(afterM, rival, point, SENTE_LOCAL_RADIUS, false)
  if (!tenuki) return null

  const stateAfterTenuki = gameStateFromBoard(afterM, rival)
  const afterTenuki = applyMove(stateAfterTenuki, tenuki.point)
  if (!afterTenuki.legal || !afterTenuki.state) return null

  // Sin piso minimo aca (a diferencia de `tenuki`, que si necesita ser una
  // alternativa real): un castigo modesto sigue siendo el mejor castigo
  // disponible, y es exactamente lo que hay que comparar contra el tenuki
  // para decidir gote -- exigirle el umbral general lo volveria null en vez
  // de un gote real cuando el grupo amenazado es chico.
  const followUp = bestAreaMoveInRegion(afterTenuki.state.board, color, point, SENTE_LOCAL_RADIUS, true, -Infinity)
  if (!followUp) return null

  const gap = followUp.delta - tenuki.delta
  return gap > SENTE_GAP_THRESHOLD ? 'sente' : 'gote'
}
