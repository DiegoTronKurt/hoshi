import { diagonals, neighbors } from '../core/board'
import { bensonPassAlive } from '../core/benson'
import { getGroup } from '../core/groups'
import { applyMove, createGame } from '../core/rules'
import { computeAreaScore } from '../core/scoring'
import { BLACK, EMPTY, opponent } from '../core/types'
import type { Color, GameState } from '../core/types'
import type { RecordedMove } from '../core/sgf'
import { isSimpleEye } from '../engine/playoutPolicy'
import { solveLadder } from '../solver/ladder'
import { CONCEPTS } from './concepts'
import type { ConceptId, ConceptSeverity } from './concepts'

export interface MistakeEvent {
  conceptId: ConceptId
  /** Numero de jugada, 1-indexado, tal como aparece en la partida guardada. */
  moveNumber: number
  color: Color
  severity: ConceptSeverity
  /** La jugada considerada un error, o null si el error fue pasar. */
  point: number | null
  /** Que jugar en su lugar, cuando el detector puede sugerirla. */
  suggestedPoint?: number
}

interface AnalysisContext {
  komi: number
  moves: RecordedMove[]
  /** states[i] = posicion despues de jugar moves[0..i-1]. states[0] es la posicion inicial. */
  states: GameState[]
  /** captured[i] = piedras rivales retiradas por moves[i]. */
  captured: number[][]
  moveIndex: number
}

function colorKey(color: Color): 'black' | 'white' {
  return color === BLACK ? 'black' : 'white'
}

function makeEvent(ctx: AnalysisContext, conceptId: ConceptId, point: number | null, suggestedPoint?: number): MistakeEvent {
  return {
    conceptId,
    moveNumber: ctx.moveIndex + 1,
    color: ctx.moves[ctx.moveIndex].color,
    severity: CONCEPTS[conceptId].severity,
    point,
    suggestedPoint,
  }
}

/** true si `point` sigue siendo del mismo color en la ultima posicion registrada de la partida. */
function survivesToEnd(ctx: AnalysisContext, point: number, color: Color): boolean {
  const final = ctx.states[ctx.states.length - 1]
  return final.board.stones[point] === color
}

/**
 * Un grupo propio tenia una libertad antes de la jugada, la jugada no la
 * aumento ni capturo nada, y ese grupo termino capturado mas adelante en la
 * partida (no esta al final de la partida registrada). Basta con mirar la
 * ultima posicion: una piedra que desaparece del tablero solo puede hacerlo
 * por captura, asi que "no esta al final" equivale a "fue capturada en
 * algun momento posterior", sin necesidad de recorrer jugada por jugada.
 */
function detectAtariIgnorado(ctx: AnalysisContext): MistakeEvent | null {
  const move = ctx.moves[ctx.moveIndex]
  if (ctx.captured[ctx.moveIndex].length > 0) return null

  const before = ctx.states[ctx.moveIndex]
  const after = ctx.states[ctx.moveIndex + 1]

  const seen = new Set<number>()
  for (let p = 0; p < before.board.stones.length; p++) {
    if (before.board.stones[p] !== move.color || seen.has(p)) continue
    const group = getGroup(before.board, p)
    if (!group) continue
    for (const s of group.stones) seen.add(s)
    if (group.liberties.size !== 1) continue

    const repStone = group.stones[0]
    const stillThere = after.board.stones[repStone] === move.color
    const rescued = stillThere && (getGroup(after.board, repStone)?.liberties.size ?? 0) > 1
    if (rescued) continue

    if (!survivesToEnd(ctx, repStone, move.color)) {
      return makeEvent(ctx, 'ATARI_IGNORADO', move.point)
    }
  }
  return null
}

/** El grupo recien formado por la jugada queda en atari y no capturo nada. */
function detectAutoatari(ctx: AnalysisContext): MistakeEvent | null {
  const move = ctx.moves[ctx.moveIndex]
  if (move.point === null) return null
  if (ctx.captured[ctx.moveIndex].length > 0) return null

  const after = ctx.states[ctx.moveIndex + 1]
  const group = getGroup(after.board, move.point)
  if (group && group.liberties.size === 1) {
    return makeEvent(ctx, 'AUTOATARI', move.point)
  }
  return null
}

/**
 * Existia una jugada legal que capturaba al menos una piedra rival, no se
 * jugo, y ese grupo rival sigue en el tablero al final de la partida
 * registrada. Si hay varios grupos capturables, se reporta el mas grande.
 */
function detectCapturaPerdida(ctx: AnalysisContext): MistakeEvent | null {
  const move = ctx.moves[ctx.moveIndex]
  const before = ctx.states[ctx.moveIndex]
  const rival = opponent(move.color)

  let best: { repStone: number; liberty: number; size: number } | null = null
  const seen = new Set<number>()
  for (let p = 0; p < before.board.stones.length; p++) {
    if (before.board.stones[p] !== rival || seen.has(p)) continue
    const group = getGroup(before.board, p)
    if (!group) continue
    for (const s of group.stones) seen.add(s)
    if (group.liberties.size !== 1) continue
    const [liberty] = group.liberties
    if (!best || group.stones.length > best.size) {
      best = { repStone: group.stones[0], liberty, size: group.stones.length }
    }
  }
  if (!best) return null
  if (!survivesToEnd(ctx, best.repStone, rival)) return null

  return makeEvent(ctx, 'CAPTURA_PERDIDA', move.point, best.liberty)
}

/** La jugada ocupa un ojo simple del propio grupo, sin capturar nada. */
function detectRellenoOjoPropio(ctx: AnalysisContext): MistakeEvent | null {
  const move = ctx.moves[ctx.moveIndex]
  if (move.point === null) return null
  if (ctx.captured[ctx.moveIndex].length > 0) return null

  const before = ctx.states[ctx.moveIndex]
  if (isSimpleEye(before.board, move.point, move.color)) {
    return makeEvent(ctx, 'RELLENO_OJO_PROPIO', move.point)
  }
  return null
}

/** La jugada cae en territorio ya cerrado por una cadena propia pass-alive. */
function detectRellenoTerritorioPropio(ctx: AnalysisContext): MistakeEvent | null {
  const move = ctx.moves[ctx.moveIndex]
  if (move.point === null) return null
  if (ctx.captured[ctx.moveIndex].length > 0) return null

  const before = ctx.states[ctx.moveIndex]
  const { chains, territoryPoints } = bensonPassAlive(before.board, move.color)
  // Sin ninguna cadena propia todavia, bensonPassAlive devuelve el tablero
  // vacio entero como "territorio" (verdad vacua: ninguna region toca una
  // cadena que ya haya sido descartada, porque no hay cadenas). Sin cadena
  // pass-alive real no hay territorio que rellenar.
  if (chains.length === 0) return null
  if (territoryPoints.includes(move.point)) {
    return makeEvent(ctx, 'RELLENO_TERRITORIO_PROPIO', move.point)
  }
  return null
}

/**
 * La jugada reduce a una sola libertad un grupo rival que tenia exactamente
 * dos (el patron clasico de inicio de escalera), y el solucionador de
 * escaleras determina que el grupo perseguido escapa: la escalera no
 * funciona y la jugada fue un movimiento desperdiciado.
 */
function detectEscaleraFallida(ctx: AnalysisContext): MistakeEvent | null {
  const move = ctx.moves[ctx.moveIndex]
  if (move.point === null) return null

  const before = ctx.states[ctx.moveIndex]
  const rival = opponent(move.color)
  const seenStones = new Set<number>()

  for (const n of neighbors(before.board.size, move.point)) {
    if (before.board.stones[n] !== rival || seenStones.has(n)) continue
    const group = getGroup(before.board, n)
    if (!group) continue
    for (const s of group.stones) seenStones.add(s)

    if (group.liberties.size !== 2 || !group.liberties.has(move.point)) continue

    const result = solveLadder({ board: before.board, runnerPoint: n, chaserColor: move.color })
    if (!result.captured) {
      return makeEvent(ctx, 'ESCALERA_FALLIDA', move.point)
    }
  }
  return null
}

/**
 * La jugada deja un punto de corte pegado a la piedra recien puesta (un
 * vacio con al menos dos cadenas propias distintas como vecinas), el rival
 * corta ahi dentro de las siguientes tres jugadas, y el corte se mantiene
 * hasta el final de la partida registrada (las dos cadenas nunca se
 * reconectan). Simplificacion deliberada: solo mira puntos de corte
 * pegados a la jugada misma, no cualquier punto de corte que exista en el
 * tablero, para no atribuirle a una jugada una debilidad que ya venia de
 * antes.
 */
function detectCorteNoDefendido(ctx: AnalysisContext): MistakeEvent | null {
  const move = ctx.moves[ctx.moveIndex]
  if (move.point === null) return null

  const after = ctx.states[ctx.moveIndex + 1]
  const board = after.board
  const ownGroup = getGroup(board, move.point)

  for (const q of neighbors(board.size, move.point)) {
    if (board.stones[q] !== EMPTY) continue

    let touchesOwnGroup = false
    let otherStone: number | null = null
    for (const n of neighbors(board.size, q)) {
      if (board.stones[n] !== move.color) continue
      if (ownGroup?.stones.includes(n)) {
        touchesOwnGroup = true
      } else {
        otherStone = n
      }
    }
    if (!touchesOwnGroup || otherStone === null) continue

    for (let k = ctx.moveIndex + 1; k < Math.min(ctx.moveIndex + 4, ctx.moves.length); k++) {
      if (ctx.moves[k].color !== opponent(move.color) || ctx.moves[k].point !== q) continue

      const finalBoard = ctx.states[ctx.states.length - 1].board
      const stillOwn = finalBoard.stones[move.point] === move.color
      const otherStillOwn = finalBoard.stones[otherStone] === move.color
      if (!stillOwn || !otherStillOwn) return makeEvent(ctx, 'CORTE_NO_DEFENDIDO', move.point, q)

      const reconnected = getGroup(finalBoard, move.point)?.stones.includes(otherStone) ?? false
      if (!reconnected) {
        return makeEvent(ctx, 'CORTE_NO_DEFENDIDO', move.point, q)
      }
    }
  }
  return null
}

/**
 * La jugada forma un triangulo vacio: junto con dos piedras propias ya en el
 * tablero, cierra tres esquinas de un cuadrado de 2x2 dejando la cuarta
 * vacia. Se excluyen los casos donde la jugada captura, da atari a un grupo
 * rival, o hay una piedra rival ortogonalmente pegada (conexion forzada bajo
 * amenaza directa), para no marcar como error una jugada que en realidad
 * era necesaria.
 */
function detectTrianguloVacio(ctx: AnalysisContext): MistakeEvent | null {
  const move = ctx.moves[ctx.moveIndex]
  if (move.point === null) return null
  if (ctx.captured[ctx.moveIndex].length > 0) return null

  const before = ctx.states[ctx.moveIndex]
  const after = ctx.states[ctx.moveIndex + 1]
  const size = before.board.size
  const rival = opponent(move.color)

  // Ninguna piedra rival pegada antes de jugar: descarta el caso de una
  // conexion forzada bajo amenaza directa.
  for (const n of neighbors(size, move.point)) {
    if (before.board.stones[n] === rival) return null
  }
  // La jugada no debe dejar a ningun grupo rival vecino en atari.
  for (const n of neighbors(size, move.point)) {
    if (after.board.stones[n] === rival && (getGroup(after.board, n)?.liberties.size ?? 99) === 1) {
      return null
    }
  }

  const x = move.point % size
  const y = Math.floor(move.point / size)
  for (const d of diagonals(size, move.point)) {
    const dx = d % size
    const dy = Math.floor(d / size)
    // Las dos esquinas del cuadrado 2x2 ortogonalmente pegadas a la jugada y
    // a la diagonal (los "brazos" de la L); la diagonal misma es la cuarta
    // esquina, que debe estar vacia.
    const armNearP = y * size + dx
    const armNearD = dy * size + x
    if (before.board.stones[armNearP] !== move.color) continue
    if (before.board.stones[armNearD] !== move.color) continue
    if (before.board.stones[d] !== EMPTY) continue
    return makeEvent(ctx, 'TRIANGULO_VACIO', move.point)
  }
  return null
}

/** Jugada en primera linea antes de la jugada 15, sin piedras rivales adyacentes. */
function detectPrimeraLineaTemprana(ctx: AnalysisContext): MistakeEvent | null {
  const move = ctx.moves[ctx.moveIndex]
  if (move.point === null) return null
  if (ctx.moveIndex + 1 >= 15) return null

  const before = ctx.states[ctx.moveIndex]
  const size = before.board.size
  const x = move.point % size
  const y = Math.floor(move.point / size)
  const onFirstLine = x === 0 || y === 0 || x === size - 1 || y === size - 1
  if (!onFirstLine) return null

  const rival = opponent(move.color)
  for (const n of neighbors(size, move.point)) {
    if (before.board.stones[n] === rival) return null
  }
  return makeEvent(ctx, 'PRIMERA_LINEA_TEMPRANA', move.point)
}

/**
 * Se paso existiendo aun una jugada legal que cambia el conteo de area
 * crudo en mas de 2 puntos para quien pasa. Comparacion de un solo paso
 * (jugar ahi vs. pasar), no una lectura completa: es una senal conservadora,
 * concreta y barata de calcular, no una prueba de que esa jugada gana la
 * partida.
 */
function detectPasePrematuro(ctx: AnalysisContext): MistakeEvent | null {
  const move = ctx.moves[ctx.moveIndex]
  if (move.point !== null) return null

  const before = ctx.states[ctx.moveIndex]
  const key = colorKey(move.color)
  const baseline = computeAreaScore(before.board, ctx.komi)[key]

  let best: { point: number; delta: number } | null = null
  for (let p = 0; p < before.board.stones.length; p++) {
    if (before.board.stones[p] !== EMPTY) continue
    const result = applyMove(before, p)
    if (!result.legal || !result.state) continue
    const score = computeAreaScore(result.state.board, ctx.komi)[key]
    const delta = score - baseline
    if (delta > 2 && (!best || delta > best.delta)) {
      best = { point: p, delta }
    }
  }
  if (!best) return null
  return makeEvent(ctx, 'PASE_PREMATURO', null, best.point)
}

/**
 * Detector de todo-el-juego: cuando una captura retira un grupo conectado
 * de 4 o mas piedras, revisa cada posicion anterior de la partida en la que
 * ese mismo punto ya estaba ocupado por el color capturado, y si en
 * ninguna de ellas el grupo llego a tener dos ojos simples, se marca como
 * "murio sin ojos". Se exige que la captura retire exactamente un grupo
 * (mismo tamano que el grupo encontrado justo antes de la jugada) para no
 * mezclar dos capturas simultaneas distintas en un solo evento.
 */
function detectGruposMuertosSinOjos(ctx: AnalysisContext): MistakeEvent[] {
  const results: MistakeEvent[] = []

  for (let i = 0; i < ctx.captured.length; i++) {
    const capturedPoints = ctx.captured[i]
    if (capturedPoints.length < 4) continue

    const before = ctx.states[i]
    const deadColor = opponent(ctx.moves[i].color)
    const anchor = capturedPoints[0]
    const groupBefore = getGroup(before.board, anchor)
    if (!groupBefore || groupBefore.stones.length !== capturedPoints.length) continue

    let hadTwoEyes = false
    for (let k = 0; k <= i && !hadTwoEyes; k++) {
      const board = ctx.states[k].board
      if (board.stones[anchor] !== deadColor) continue
      const group = getGroup(board, anchor)
      if (!group) continue
      let eyeCount = 0
      for (const liberty of group.liberties) {
        if (isSimpleEye(board, liberty, deadColor)) eyeCount++
      }
      if (eyeCount >= 2) hadTwoEyes = true
    }

    if (!hadTwoEyes) {
      results.push({
        conceptId: 'GRUPO_MURIO_SIN_OJOS',
        moveNumber: i + 1,
        color: deadColor,
        severity: CONCEPTS.GRUPO_MURIO_SIN_OJOS.severity,
        point: anchor,
      })
    }
  }

  return results
}

const PER_MOVE_DETECTORS: Array<(ctx: AnalysisContext) => MistakeEvent | null> = [
  detectAtariIgnorado,
  detectAutoatari,
  detectCapturaPerdida,
  detectRellenoOjoPropio,
  detectRellenoTerritorioPropio,
  detectEscaleraFallida,
  detectCorteNoDefendido,
  detectTrianguloVacio,
  detectPrimeraLineaTemprana,
  detectPasePrematuro,
]

/**
 * Corre todos los detectores de errores sobre una partida completa,
 * reproduciendola jugada por jugada desde el inicio. Regla de
 * implementacion (documento de diseno, seccion 5.4): si un detector no
 * puede afirmar la condicion con certeza, no reporta.
 */
export function analyzeGame(size: number, komi: number, moves: RecordedMove[]): MistakeEvent[] {
  const states: GameState[] = [createGame(size, komi)]
  const captured: number[][] = []

  for (const move of moves) {
    const result = applyMove(states[states.length - 1], move.point)
    if (!result.legal || !result.state) break
    states.push(result.state)
    captured.push(result.captured)
  }

  // La partida pudo cortarse antes si algun registro fuera invalido; solo se
  // analizan las jugadas que realmente se pudieron reproducir.
  const playedMoves = moves.slice(0, captured.length)

  const events: MistakeEvent[] = []
  for (let moveIndex = 0; moveIndex < playedMoves.length; moveIndex++) {
    const ctx: AnalysisContext = { komi, moves: playedMoves, states, captured, moveIndex }
    for (const detector of PER_MOVE_DETECTORS) {
      const found = detector(ctx)
      if (found) events.push(found)
    }
  }

  const aggregateCtx: AnalysisContext = { komi, moves: playedMoves, states, captured, moveIndex: -1 }
  events.push(...detectGruposMuertosSinOjos(aggregateCtx))

  events.sort((a, b) => a.moveNumber - b.moveNumber)
  return events
}
