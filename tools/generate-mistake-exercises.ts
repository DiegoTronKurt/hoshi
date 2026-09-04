/**
 * Genera ejercicios para 5 conceptos que hoy solo tienen detector de partida
 * real (hasDetector:true, generatesExercises:false en analysis/concepts.ts).
 * Reutiliza el mismo pipeline de autojuego + solucionador que
 * generate-problems.ts (duplicado a proposito, no importado: cada script
 * generador de este proyecto es independiente, mismo patron que
 * generate-ladder-problems.ts / generate-double-atari-problems.ts).
 *
 * ATARI_IGNORADO: el detector dispara cuando un grupo propio queda con
 * exactamente 1 libertad y no se salva. Mismo objective:'live' que ya usa
 * DOS_OJOS, pero el candidato exige liberties.size === 1 (atari real), no
 * <= 3 como DOS_OJOS.
 *
 * AUTOATARI, RELLENO_OJO_PROPIO y TRIANGULO_VACIO no buscan candidatos
 * nuevos: se extraen gratis de las jugadas PERDEDORAS que el propio
 * solucionador ya evalua al resolver cualquier problema de vida-muerte (de
 * este script o del original DOS_OJOS/CAPTURA_SIMPLE/PUNTO_VITAL). Si una
 * jugada perdedora del nivel raiz deja al grupo que la jugo con 1 sola
 * libertad, es un autoatari real. Si cae en un punto que ya era ojo simple
 * propio (isSimpleEye, la misma funcion que usa el detector en
 * mistakes.ts), es relleno de ojo propio. Si conecta dos piedras propias ya
 * puestas por una diagonal sin ganar nada (geometria exacta del "triangulo
 * vacio" segun Kageyama, "Lessons in the Fundamentals of Go", cap. 8, Dia.
 * 37-38 -- ver NOTAS-libro-kageyama.md): es triangulo vacio. Ninguno de los
 * tres cambia el ejercicio en si (la jugada ganadora sigue siendo la misma,
 * unica): solo confirma que existe una jugada perdedora "trampa" con ese
 * perfil exacto cerca de la solucion real.
 *
 * CORTE_NO_DEFENDIDO se extrae de la jugada GANADORA en cambio: si la unica
 * jugada que resuelve el problema conecta dos cadenas propias que antes
 * eran distintas (un punto de corte real), dejarlo sin jugar es exactamente
 * "corte no defendido" -- Kageyama cap. 2, "cut where you can cut" /
 * "don't peep where you can cut" (Dia. 5-9).
 *
 * TRIANGULO_VACIO es el unico de los 5 que NO es una propiedad que el
 * documento de diseno considere puramente objetiva: "buena forma" es un
 * juicio de la teoria de Go, no un hecho de vida-muerte. Por eso el chequeo
 * exige ademas que la jugada sea perdedora en esta posicion concreta (hay
 * una alternativa mejor, verificada por el solucionador) -- el propio
 * Kageyama advierte dos veces en el mismo capitulo que un triangulo vacio
 * forzado puede ser la jugada correcta, asi que nunca se emite este
 * concepto para una jugada que el solucionador considera ganadora.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { inBounds, neighbors, toPoint, toXY } from '../src/core/board'
import { getGroup } from '../src/core/groups'
import { createGame, applyMove, gameStateFromBoard } from '../src/core/rules'
import { BLACK, EMPTY, opponent } from '../src/core/types'
import type { BoardState, Color, GameState } from '../src/core/types'
import { chooseMove } from '../src/engine/mcts'
import { isSimpleEye } from '../src/engine/playoutPolicy'
import { computeRegion, countEmptyPoints } from '../src/solver/region'
import { solve } from '../src/solver/tsumego'
import type { Objective, RefutationNode } from '../src/solver/tsumego'
import { problemToSgf } from '../src/content/problemSgf'
import type { Problem } from '../src/content/problemSgf'
import { difficultyFromDepth, solutionDepth } from '../src/content/difficulty'
import type { ConceptId } from '../src/analysis/concepts'

const BOARD_SIZE = 9
const SELF_PLAY_GAMES = 200
const WEAK_PLAYOUTS = 100
const STRONG_PLAYOUTS = 800
const MAX_MOVE_TIME_MS = 3000
const MAX_REGION_EMPTY = 14
const MIN_SOLUTION_DEPTH = 1
const MAX_SOLUTION_DEPTH = 9

function playSelfPlayGame(randomSeed: number, blackPlayouts: number, whitePlayouts: number): BoardState[] {
  let state: GameState = createGame(BOARD_SIZE, BOARD_SIZE, 6.5)
  const positions: BoardState[] = []
  const maxMoves = BOARD_SIZE * BOARD_SIZE * 3
  let played = 0

  while (!state.gameOver && played < maxMoves) {
    const playouts = state.toMove === BLACK ? blackPlayouts : whitePlayouts
    const choice = chooseMove(state, { playouts, randomSeed: randomSeed + played, maxTimeMs: MAX_MOVE_TIME_MS })
    const result = applyMove(state, choice.move)
    if (!result.legal || !result.state) break
    state = result.state
    positions.push(state.board)
    played++
  }

  return positions
}

interface Candidate {
  points: number[]
  color: Color
  atari: boolean
}

function findCandidateGroups(board: BoardState): Candidate[] {
  const seen = new Set<number>()
  const candidates: Candidate[] = []

  for (let p = 0; p < board.stones.length; p++) {
    const color = board.stones[p]
    if (color === EMPTY || seen.has(p)) continue
    const group = getGroup(board, p)
    if (!group) continue
    for (const s of group.stones) seen.add(s)
    if (group.stones.length <= 8 && group.liberties.size <= 3) {
      candidates.push({ points: group.stones, color: color as Color, atari: group.liberties.size === 1 })
    }
  }

  return candidates
}

interface SolveOutcome {
  region: number[]
  result: ReturnType<typeof solve>
  depth: number | null
}

function trySolveCandidate(
  board: BoardState,
  groupPoints: number[],
  targetColor: Color,
  toMove: Color,
  objective: Objective,
): SolveOutcome | null {
  const region = computeRegion(board, groupPoints, 2)
  if (countEmptyPoints(board, region) > MAX_REGION_EMPTY) return null

  const result = solve({ board, region, targetPoints: groupPoints, targetColor, toMove, objective, maxDepth: 8 })
  if (!result.solved) return null

  // Mismo margen angosto que useSolvableExercise.ts usa en vivo (margin=1):
  // ver comentario de tryBuildProblem en generate-problems.ts (bug real ya
  // encontrado en produccion con 4 problemas DOS_OJOS).
  const liveRegion = computeRegion(board, groupPoints, 1)
  const liveResult = solve({ board, region: liveRegion, targetPoints: groupPoints, targetColor, toMove, objective, maxDepth: 8 })
  if (!liveResult.solved) return null

  const wantLive = objective === 'live'
  const firstMoveWins = result.root.children.filter((c) => c.liveForDefender === wantLive)
  if (firstMoveWins.length !== 1) return null

  const forDefender = toMove === targetColor
  const depth = solutionDepth(result.root, wantLive, forDefender)
  if (depth === null || depth < MIN_SOLUTION_DEPTH || depth > MAX_SOLUTION_DEPTH) return null

  return { region, result, depth }
}

function makeProblem(
  conceptId: ConceptId,
  board: BoardState,
  groupPoints: number[],
  targetColor: Color,
  toMove: Color,
  objective: Objective,
  tree: RefutationNode,
): Problem {
  return { conceptId, board, targetPoints: groupPoints, targetColor, toMove, objective, tree }
}

/** Aplica una jugada candidata y devuelve las libertades resultantes del
 * grupo que quedo en ese punto, o null si la jugada no era legal (no
 * deberia pasar: viene de una jugada que el solucionador ya jugo). */
function libertiesAfterMove(board: BoardState, point: number, color: Color): number | null {
  const state = gameStateFromBoard(board, color)
  const applied = applyMove(state, point)
  if (!applied.legal || !applied.state) return null
  const group = getGroup(applied.state.board, point)
  return group ? group.liberties.size : null
}

/** Triangulo vacio: jugar `point` deja 3 esquinas de un cuadrado de 2x2
 * ocupadas por `color` (point mas dos vecinos ortogonales) y la 4ta esquina
 * (la diagonal) vacia. Geometria exacta de Kageyama Dia. 37 -- ver comentario
 * de archivo. No evalua si la jugada "vale la pena": eso lo decide el
 * solucionador por separado (solo se llama sobre jugadas ya confirmadas
 * perdedoras). */
function isEmptyTriangleMove(board: BoardState, point: number, color: Color): boolean {
  const { width, height } = board
  const [x, y] = toXY(width, point)
  const horizontals = [1, -1]
  const verticals = [1, -1]

  for (const dx of horizontals) {
    for (const dy of verticals) {
      const ax = x + dx
      const ay = y
      const bx = x
      const by = y + dy
      const cx = x + dx
      const cy = y + dy
      if (!inBounds(width, height, ax, ay) || !inBounds(width, height, bx, by) || !inBounds(width, height, cx, cy)) continue
      const a = toPoint(width, ax, ay)
      const b = toPoint(width, bx, by)
      const c = toPoint(width, cx, cy)
      if (board.stones[a] === color && board.stones[b] === color && board.stones[c] === EMPTY) return true
    }
  }
  return false
}

/** Corte defendido: `point` toca (antes de jugarlo) dos o mas cadenas de
 * `color` que hasta ese momento eran distintas. Si esta es la unica jugada
 * ganadora del problema, dejarla sin jugar es exactamente "corte no
 * defendido" -- Kageyama cap. 2. */
function connectsDistinctGroups(board: BoardState, point: number, color: Color): boolean {
  const seenKeys = new Set<string>()
  for (const n of neighbors(board.width, board.height, point)) {
    if (board.stones[n] !== color) continue
    const group = getGroup(board, n)
    if (!group) continue
    seenKeys.add(group.stones.slice().sort((p, q) => p - q).join(','))
  }
  return seenKeys.size >= 2
}

interface Found {
  atariIgnorado: Problem[]
  autoatari: Problem[]
  rellenoOjoPropio: Problem[]
  trianguloVacio: Problem[]
  corteNoDefendido: Problem[]
}

function extractFromSolved(
  board: BoardState,
  groupPoints: number[],
  targetColor: Color,
  toMove: Color,
  objective: Objective,
  outcome: SolveOutcome,
  isAtariCandidate: boolean,
  out: Found,
) {
  const wantLive = objective === 'live'
  const tree = outcome.result.root

  if (isAtariCandidate && objective === 'live' && toMove === targetColor) {
    out.atariIgnorado.push(makeProblem('ATARI_IGNORADO', board, groupPoints, targetColor, toMove, objective, tree))
  }

  const winner = tree.children.find((c) => c.liveForDefender === wantLive)
  if (winner && winner.move !== null && connectsDistinctGroups(board, winner.move, toMove)) {
    out.corteNoDefendido.push(makeProblem('CORTE_NO_DEFENDIDO', board, groupPoints, targetColor, toMove, objective, tree))
  }

  const losing = tree.children.filter((c) => c.liveForDefender !== wantLive)
  let gotAutoatari = false
  let gotEye = false
  let gotTriangle = false

  for (const child of losing) {
    if (child.move === null) continue

    if (!gotAutoatari) {
      const libs = libertiesAfterMove(board, child.move, toMove)
      if (libs === 1) {
        out.autoatari.push(makeProblem('AUTOATARI', board, groupPoints, targetColor, toMove, objective, tree))
        gotAutoatari = true
      }
    }

    if (!gotEye && isSimpleEye(board, child.move, toMove)) {
      out.rellenoOjoPropio.push(makeProblem('RELLENO_OJO_PROPIO', board, groupPoints, targetColor, toMove, objective, tree))
      gotEye = true
    }

    if (!gotTriangle && isEmptyTriangleMove(board, child.move, toMove)) {
      out.trianguloVacio.push(makeProblem('TRIANGULO_VACIO', board, groupPoints, targetColor, toMove, objective, tree))
      gotTriangle = true
    }

    if (gotAutoatari && gotEye && gotTriangle) break
  }
}

async function main() {
  const found: Found = { atariIgnorado: [], autoatari: [], rellenoOjoPropio: [], trianguloVacio: [], corteNoDefendido: [] }
  const seen = new Set<string>()
  let totalCandidates = 0
  let totalSolved = 0

  for (let g = 0; g < SELF_PLAY_GAMES; g++) {
    const blackStrong = g % 2 === 0
    const blackPlayouts = blackStrong ? STRONG_PLAYOUTS : WEAK_PLAYOUTS
    const whitePlayouts = blackStrong ? WEAK_PLAYOUTS : STRONG_PLAYOUTS
    const positions = playSelfPlayGame(3000 + g, blackPlayouts, whitePlayouts)
    const lastPositions = positions.slice(-8)

    for (const board of lastPositions) {
      for (const candidate of findCandidateGroups(board)) {
        const key = candidate.points.slice().sort((a, b) => a - b).join(',') + `:${candidate.color}`
        if (seen.has(key)) continue
        seen.add(key)
        totalCandidates++

        const attacker = opponent(candidate.color)

        const asKill = trySolveCandidate(board, candidate.points, candidate.color, attacker, 'kill')
        if (asKill) {
          totalSolved++
          extractFromSolved(board, candidate.points, candidate.color, attacker, 'kill', asKill, candidate.atari, found)
        }

        const asLive = trySolveCandidate(board, candidate.points, candidate.color, candidate.color, 'live')
        if (asLive) {
          totalSolved++
          extractFromSolved(board, candidate.points, candidate.color, candidate.color, 'live', asLive, candidate.atari, found)
        }
      }
    }
    console.log(
      `Partida ${g + 1}/${SELF_PLAY_GAMES} lista. candidatos=${totalCandidates} resueltos=${totalSolved} | ATARI_IGNORADO=${found.atariIgnorado.length} AUTOATARI=${found.autoatari.length} RELLENO_OJO_PROPIO=${found.rellenoOjoPropio.length} TRIANGULO_VACIO=${found.trianguloVacio.length} CORTE_NO_DEFENDIDO=${found.corteNoDefendido.length}`,
    )
  }

  const root = dirname(fileURLToPath(import.meta.url))
  const outDir = join(root, '..', 'src', 'content', 'problems')
  await mkdir(outDir, { recursive: true })

  async function writeBank(fileName: string, idPrefix: string, problems: Problem[]) {
    const bank = problems.map((problem, index) => {
      const wantLive = problem.objective === 'live'
      const forDefender = problem.toMove === problem.targetColor
      const depth = solutionDepth(problem.tree, wantLive, forDefender)
      return {
        id: `${idPrefix}${index + 1}`,
        conceptId: problem.conceptId,
        sgf: problemToSgf(problem),
        difficulty: difficultyFromDepth(depth),
      }
    })
    await writeFile(join(outDir, fileName), JSON.stringify(bank, null, 2))
    const byDifficulty: Record<string, number> = {}
    for (const p of bank) byDifficulty[p.difficulty] = (byDifficulty[p.difficulty] ?? 0) + 1
    console.log(`${fileName}: ${bank.length} problemas`, byDifficulty)
  }

  await writeBank('atari-ignorado.json', 'atariignorado', found.atariIgnorado)
  await writeBank('autoatari.json', 'autoatari', found.autoatari)
  await writeBank('relleno-ojo-propio.json', 'rellenoojo', found.rellenoOjoPropio)
  await writeBank('triangulo-vacio.json', 'trianguloVacio', found.trianguloVacio)
  await writeBank('corte-no-defendido.json', 'corteNoDefendido', found.corteNoDefendido)
}

main()
