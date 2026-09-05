import { toPoint, toXY } from '../core/board'
import { computeAreaOwnership } from '../core/scoring'
import { applyMove } from '../core/rules'
import { getGroup } from '../core/groups'
import { EMPTY, WHITE, opponent } from '../core/types'
import type { BoardState, Color, GameState } from '../core/types'
import { solveLadder } from '../solver/ladder'

/**
 * Codificador de entrada para la red de KataGo (formato de entrada V7:
 * 22 canales espaciales, 19 globales), reconstruido a partir de la fuente
 * publica de KataGo (`cpp/neuralnet/nninputs.cpp`/`.h`, MIT) -- no de
 * ningun repo de conversion a TF.js (ninguno declara licencia para su
 * codigo, asi que no se copio nada de ahi, solo los pesos del modelo en
 * si, ver public/models/kata-b10c128/ATTRIBUTION.md).
 *
 * Simplificacion deliberada y correcta, no un recorte: KataGo es de
 * proposito general (soporta reglas japonesas, encore, handicap con sesgo,
 * boton, etc.) y varios canales de la V7 solo existen para esas variantes.
 * Hoshi tiene una configuracion de reglas fija (conteo de area chino,
 * superko posicional, sin suicidio, sin handicap con sesgo, sin encore, sin
 * boton), asi que esos canales colapsan a una constante fija en vez de a
 * logica condicional -- no es un feature faltante, es un feature que nunca
 * varia en esta app. Documentado canal por canal abajo.
 *
 * Verificado empiricamente (no solo por lectura de fuente) contra una
 * instalacion real de KataGo v1.18.1 (backend eigenavx2, misma red exacta
 * `g170-b10c128-s1141046784-d204142634` que usa esta app) via
 * `katago.exe kata-raw-nn`, sin busqueda -- mismo tipo de comparacion
 * (una sola pasada de la red, sin MCTS) que evaluatePosition en model.ts.
 * 3 posiciones (tablero vacio, apertura con historial real, escalera real
 * cerca de una esquina), acuerdo a 4-6 cifras significativas en
 * policy/value/ownership. Cubre las secciones de piedras/libertades,
 * historial de jugadas, escaleras y reglas/komi; NO se probo
 * especificamente superko real ni territorio pass-alive asentado (canales
 * 6, 18-19) con una posicion dedicada. Ver NOTAS.md, sesion 2026-09-05,
 * para el detalle completo y el script de verificacion usado.
 */

const NN_LEN = 19
const NUM_SPATIAL_FEATURES = 22
const NUM_GLOBAL_FEATURES = 19

export interface EvalMove {
  color: Color
  point: number | null
}

export interface EvalPosition {
  /** El estado real del motor de reglas (board, toMove, komi,
   * consecutivePasses, y el historial de hashes de Zobrist que hace falta
   * para detectar puntos vetados por superko de verdad -- no una posicion
   * sintetica de un solo hash, que nunca podria detectar un ko real. Todo
   * esto ya existe tal cual en cualquier partida real, no hace falta
   * reconstruir nada: se pide directo. */
  state: GameState
  /** Jugadas recientes en orden cronologico (la mas vieja primero). Puede
   * venir vacio o corto (posicion sin historial real, como un problema del
   * banco de ejercicios) -- KataGo soporta explicitamente evaluar una
   * posicion "fresca" sin historial, no es un caso invalido. */
  recentMoves?: EvalMove[]
  /** Tableros de 1 y 2 jugadas atras (`priorBoards[length-1]` = hace 1
   * jugada, `priorBoards[length-2]` = hace 2), si estan disponibles. Una
   * partida real ya los tiene en su propio historial (PlayGameScreen
   * guarda `GameState[]` completo) -- se piden directo al llamador en vez
   * de reconstruirlos aca, porque el motor de reglas no tiene "deshacer" y
   * no hay forma de recuperarlos solo a partir de la lista de jugadas.
   * Sin este dato, los canales 15/16 (escaleras en el tablero anterior)
   * quedan iguales al canal 14 -- degradacion explicita, no un intento de
   * inventar un tablero que no se puede reconstruir. */
  priorBoards?: BoardState[]
}

export interface EncodedInput {
  /** Aplanado NHWC: indice = posNN*22 + canal, posNN = y*19+x en la
   * grilla fija de 19x19 (un tablero mas chico ocupa la esquina superior
   * izquierda, el resto queda fuera de tablero -- canal 0). */
  spatial: Float32Array
  global: Float32Array
}

function nnPos(x: number, y: number): number {
  return y * NN_LEN + x
}

/** Convierte un punto en la convencion del tablero real (`toPoint` de
 * core/board.ts, `y*width+x`) al indice de la grilla fija de la red
 * (`y*19+x`) -- distintas convenciones que coinciden por casualidad solo
 * cuando `width===19` o en la fila 0. Necesario para leer `policy`/
 * `ownership` (indexados en espacio de grilla) usando puntos que vienen en
 * espacio de tablero, como los de `listLegalMoves`. Ver bucketOwnership en
 * ui/review/reviewState.ts para el mismo patron ya aplicado a ownership. */
export function gamePointToNNIndex(width: number, point: number): number {
  const [x, y] = toXY(width, point)
  return nnPos(x, y)
}

function setSpatial(spatial: Float32Array, posNN: number, channel: number, value = 1): void {
  spatial[posNN * NUM_SPATIAL_FEATURES + channel] = value
}

/** Puntos donde jugar ahora mismo violaria el superko posicional (unico
 * tipo de ko que Hoshi implementa -- ver core/rules.ts). Cubre el canal 6
 * (ver fillRowV7, rama `hist.encorePhase == 0`, que es la unica rama real
 * ya que Hoshi nunca tiene encore). Usa el historial REAL de `state`, no
 * uno sintetico de un solo hash -- con un solo hash ningun ko real se
 * detecta nunca, porque la posicion que se recrearia es una anterior a la
 * actual, no la actual misma. */
function findSuperKoBannedPoints(state: GameState): Set<number> {
  const banned = new Set<number>()
  for (let p = 0; p < state.board.stones.length; p++) {
    if (state.board.stones[p] !== EMPTY) continue
    const result = applyMove(state, p)
    if (!result.legal && result.reason === 'superko') banned.add(p)
  }
  return banned
}

/**
 * Grupos (de cualquier color) con 1 o 2 libertades que un solucionador de
 * escaleras real confirma que estan efectivamente atrapados si el rival de
 * ese grupo empieza a perseguir ahora mismo. Cubre los canales 14/15/16
 * (el mismo calculo sobre el tablero actual, el de hace 1 jugada y el de
 * hace 2) y el canal 17 (las jugadas reales de captura, solo para grupos
 * de 2 libertades que pertenecen al rival de quien tiene el turno).
 */
function findLadderedGroups(board: BoardState, perspectiveColor: Color): { stones: number[]; chaserMoves: number[]; groupColor: Color }[] {
  const seen = new Set<number>()
  const results: { stones: number[]; chaserMoves: number[]; groupColor: Color }[] = []

  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] === EMPTY || seen.has(p)) continue
    const group = getGroup(board, p)
    if (!group) continue
    const color = group.color
    for (const s of group.stones) seen.add(s)
    if (group.liberties.size !== 1 && group.liberties.size !== 2) continue

    const chaserColor = opponent(color)
    const outcome = solveLadder({ board, runnerPoint: p, chaserColor, toMove: chaserColor })
    if (!outcome.captured) continue

    results.push({
      stones: group.stones,
      // El canal 17 (jugadas de captura) solo aplica a grupos rivales de
      // quien tiene el turno, con 2 libertades reales (fillRowV7: el
      // ataque "primero mueve el atacante" con margen para leer, no la
      // captura ya inevitable de 1 sola libertad).
      chaserMoves: group.liberties.size === 2 && color === opponent(perspectiveColor) ? outcome.moves : [],
      groupColor: color,
    })
  }

  return results
}

export function encodeInput(pos: EvalPosition): EncodedInput {
  const { state } = pos
  const { board, toMove: pla, komi, consecutivePasses } = state
  const opp = opponent(pla)
  const width = board.width
  const height = board.height
  const recentMoves = pos.recentMoves ?? []

  const spatial = new Float32Array(NN_LEN * NN_LEN * NUM_SPATIAL_FEATURES)
  const global = new Float32Array(NUM_GLOBAL_FEATURES)

  // --- Canales espaciales 0-5: tablero, piedras, libertades ---
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = toPoint(width, x, y)
      const posNN = nnPos(x, y)
      setSpatial(spatial, posNN, 0) // en tablero

      const stone = board.stones[p]
      if (stone === pla) setSpatial(spatial, posNN, 1)
      else if (stone === opp) setSpatial(spatial, posNN, 2)

      if (stone === pla || stone === opp) {
        const libs = getGroup(board, p)?.liberties.size ?? 0
        if (libs === 1) setSpatial(spatial, posNN, 3)
        else if (libs === 2) setSpatial(spatial, posNN, 4)
        else if (libs === 3) setSpatial(spatial, posNN, 5)
      }
    }
  }

  // --- Canal 6: puntos vetados por superko posicional ---
  for (const p of findSuperKoBannedPoints(state)) {
    const [x, y] = toXY(width, p)
    setSpatial(spatial, nnPos(x, y), 6)
  }
  // Canales 7,8: solo existen en la fase "encore" de reglas japonesas, que
  // Hoshi nunca tiene -- quedan en 0 (Float32Array ya nace en cero).

  // --- Canales 9-13 + global 0-4: ultimas 5 jugadas ---
  // fillRowV7 alterna el color esperado en cada paso hacia atras (la mas
  // reciente debe ser de `opp`, la anterior de `pla`, etc., por la simple
  // alternancia de turnos) y para de incluir historial en cuanto encuentra
  // una que no calza -- no debería pasar con un historial real, pero es la
  // misma guarda que trae el original.
  {
    const expectedColors = [opp, pla, opp, pla, opp]
    const spatialChannels = [9, 10, 11, 12, 13]
    let n = recentMoves.length
    for (let i = 0; i < 5 && n > 0; i++) {
      const move = recentMoves[n - 1]
      if (move.color !== expectedColors[i]) break
      n--
      if (move.point === null) {
        global[i] = 1
      } else {
        const [x, y] = toXY(width, move.point)
        setSpatial(spatial, nnPos(x, y), spatialChannels[i])
      }
    }
  }

  // --- Canales 14-17: escaleras activas ---
  const priorBoards = pos.priorBoards ?? []
  const boardsByRecency = [
    board,
    priorBoards[priorBoards.length - 1] ?? board,
    priorBoards[priorBoards.length - 2] ?? priorBoards[priorBoards.length - 1] ?? board,
  ]

  for (let movesAgo = 0; movesAgo <= 2; movesAgo++) {
    const channel = movesAgo === 0 ? 14 : movesAgo === 1 ? 15 : 16
    const historicalBoard = boardsByRecency[movesAgo]
    for (const group of findLadderedGroups(historicalBoard, pla)) {
      for (const s of group.stones) {
        const [x, y] = toXY(historicalBoard.width, s)
        setSpatial(spatial, nnPos(x, y), channel)
      }
      if (movesAgo === 0) {
        for (const m of group.chaserMoves) {
          const [x, y] = toXY(historicalBoard.width, m)
          setSpatial(spatial, nnPos(x, y), 17)
        }
      }
    }
  }

  // --- Canales 18,19: territorio actual bajo conteo de area chino ---
  // calculateArea(nonPassAliveStones=true, safeBigTerritories=true,
  // unsafeBigTerritories=true) para SCORING_AREA+TAX_NONE (la unica
  // combinacion que Hoshi usa) es exactamente: cada punto vacio rodeado
  // por un solo color pasa a ser de ese color, cada piedra que no quedo
  // resuelta como territorio ajeno cuenta como su propio color -- lo mismo
  // que ya calcula core/scoring.ts::computeAreaOwnership.
  {
    const ownership = computeAreaOwnership(board)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = toPoint(width, x, y)
        const posNN = nnPos(x, y)
        if (ownership[p] === pla) setSpatial(spatial, posNN, 18)
        else if (ownership[p] === opp) setSpatial(spatial, posNN, 19)
      }
    }
  }
  // Canales 20,21: solo aplican en la segunda fase de encore (reglas
  // japonesas), que Hoshi nunca tiene -- quedan en 0.

  // --- Globales 5-18 ---
  const boardArea = width * height
  let selfKomi = pla === WHITE ? komi : -komi
  const komiClipRadius = 40
  if (selfKomi > boardArea + komiClipRadius) selfKomi = boardArea + komiClipRadius
  if (selfKomi < -boardArea - komiClipRadius) selfKomi = -boardArea - komiClipRadius
  global[5] = selfKomi / 20

  // Regla de ko: Hoshi solo implementa superko posicional.
  global[6] = 1
  global[7] = 0.5

  // Suicidio: Hoshi nunca lo permite -> global[8] queda en 0.
  // Reglas de conteo: siempre area (chinas) -> global[9] queda en 0.
  // Impuesto de grupo: Hoshi no lo tiene -> global[10],[11] quedan en 0.
  // Fase de encore: Hoshi nunca la tiene -> global[12],[13] quedan en 0.

  // Un pase ahora, ¿terminaria la partida? (mismo criterio que
  // GameState.gameOver en core/rules.ts).
  global[14] = consecutivePasses >= 1 ? 1 : 0

  // Ventaja de handicap con sesgo y boton: Hoshi no los usa en una
  // evaluacion neutral -> global[15],[16],[17] quedan en 0.

  // Onda de paridad tablero/komi (formula pura, sin dependencia de reglas
  // variables -- aplica siempre bajo conteo de area, que es el unico modo
  // de Hoshi).
  {
    const boardAreaIsEven = boardArea % 2 === 0
    const komiFloor = boardAreaIsEven ? Math.floor(selfKomi / 2) * 2 : Math.floor((selfKomi - 1) / 2) * 2 + 1
    let delta = selfKomi - komiFloor
    if (delta < 0) delta = 0
    if (delta > 2) delta = 2
    const wave = delta < 0.5 ? delta : delta < 1.5 ? 1 - delta : delta - 2
    global[18] = wave
  }

  return { spatial, global }
}

export { NN_LEN, NUM_SPATIAL_FEATURES, NUM_GLOBAL_FEATURES }
