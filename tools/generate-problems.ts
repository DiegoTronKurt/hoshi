/**
 * Pipeline de generacion del banco de problemas (seccion 5.6 del documento
 * de diseno). Se corre fuera de la app con `npm run problems:generate` y
 * produce SGF versionado en el repo.
 *
 * Pasos: 1) posiciones semilla verificadas a mano (`content/seeds.ts`, ya
 * cubre NAKADE/DOS_OJOS/RED_GETA/SNAPBACK multiplicadas por simetria),
 * 2) autojuego del bot MCTS a fuerzas distintas (negro y blanco con
 * presupuestos de playouts diferentes, para producir posiciones con errores
 * explotables, no solo autojuego parejo) para encontrar posiciones
 * candidatas (grupos chicos con pocas libertades), 3) recortar la region y
 * correr el solucionador, 4) aceptar solo si la solucion existe, la primera
 * jugada es unica, y la profundidad esta entre 1 y 9 jugadas, 5) etiquetar
 * (CAPTURA_SIMPLE si la captura no necesito lectura real, PUNTO_VITAL si
 * si) y guardar.
 *
 * OJO_FALSO ya se resolvio (`content/seeds.ts`, `buildOjoFalsoSeed`): los
 * intentos anteriores fallaban por construir la forma con relleno total de
 * blanco, tecnica que no puede representar una diagonal que le quita una
 * libertad real a una piedra (ver comentario de esa funcion). DOBLE_ATARI y
 * ESCALERA siguen fuera de esta pasada porque no encajan en el formato
 * Problem/solve() de vida-muerte (ver el plan de esta fase) y necesitan su
 * propio tipo de dato y mecanismo de verificacion.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getGroup } from '../src/core/groups'
import { createGame, applyMove } from '../src/core/rules'
import { BLACK, EMPTY, opponent } from '../src/core/types'
import type { BoardState, Color, GameState } from '../src/core/types'
import { chooseMove } from '../src/engine/mcts'
import { computeRegion, countEmptyPoints } from '../src/solver/region'
import { solve } from '../src/solver/tsumego'
import type { Objective, RefutationNode } from '../src/solver/tsumego'
import { buildSeedProblems } from '../src/content/seeds'
import { problemToSgf } from '../src/content/problemSgf'
import type { Problem } from '../src/content/problemSgf'
import type { ConceptId } from '../src/analysis/concepts'

const BOARD_SIZE = 9
const SELF_PLAY_GAMES = 8
// Documento de diseno, seccion 5.6: "100 vs 2000 produce posiciones con
// errores explotables". Cada partida de autojuego alterna quien de los dos
// colores juega fuerte, para no sesgar los errores encontrados a un solo
// lado.
const WEAK_PLAYOUTS = 100
const STRONG_PLAYOUTS = 800
const MAX_MOVE_TIME_MS = 3000
const MAX_REGION_EMPTY = 14
const MIN_SOLUTION_DEPTH = 1
const MAX_SOLUTION_DEPTH = 9
// Depth a partir de la cual una captura deja de ser "ya estaba en atari,
// solo hay que cerrarla" (CAPTURA_SIMPLE) para pasar a ser lectura real
// (PUNTO_VITAL).
const CAPTURA_SIMPLE_MAX_DEPTH = 1

function playSelfPlayGame(randomSeed: number, blackPlayouts: number, whitePlayouts: number): BoardState[] {
  let state: GameState = createGame(BOARD_SIZE, 6.5)
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

function findCandidateGroups(board: BoardState): Array<{ points: number[]; color: Color }> {
  const seen = new Set<number>()
  const candidates: Array<{ points: number[]; color: Color }> = []

  for (let p = 0; p < board.stones.length; p++) {
    const color = board.stones[p]
    if (color === EMPTY || seen.has(p)) continue
    const group = getGroup(board, p)
    if (!group) continue
    for (const s of group.stones) seen.add(s)
    if (group.stones.length <= 8 && group.liberties.size <= 3) {
      candidates.push({ points: group.stones, color: color as Color })
    }
  }

  return candidates
}

function solutionDepth(node: RefutationNode, wantLive: boolean, forDefender: boolean): number | null {
  if (node.children.length === 0) return 0
  let best: number | null = null
  for (const child of node.children) {
    const childIsWin = forDefender ? child.liveForDefender === wantLive : child.liveForDefender !== wantLive
    if (!forDefender) {
      // en un nodo del atacante cualquier respuesta cuenta para la profundidad principal
      const depth = solutionDepth(child, wantLive, !forDefender)
      if (depth !== null && (best === null || depth + 1 > best)) best = depth + 1
      continue
    }
    if (!childIsWin) continue
    const depth = solutionDepth(child, wantLive, !forDefender)
    if (depth !== null && (best === null || depth + 1 < best)) best = depth + 1
  }
  return best
}

function tryBuildProblem(
  board: BoardState,
  groupPoints: number[],
  targetColor: Color,
  toMove: Color,
  objective: Objective,
): Problem | null {
  const region = computeRegion(board, groupPoints, 2)
  if (countEmptyPoints(board, region) > MAX_REGION_EMPTY) return null

  const result = solve({ board, region, targetPoints: groupPoints, targetColor, toMove, objective, maxDepth: 8 })
  if (!result.solved) return null

  const wantLive = objective === 'live'
  const firstMoveWins = result.root.children.filter((c) => c.liveForDefender === wantLive)
  if (firstMoveWins.length !== 1) return null // se exige primera jugada unica

  const depth = solutionDepth(result.root, wantLive, toMove === targetColor)
  if (depth === null || depth < MIN_SOLUTION_DEPTH || depth > MAX_SOLUTION_DEPTH) return null

  let conceptId: ConceptId
  if (objective === 'live') {
    conceptId = 'DOS_OJOS'
  } else {
    conceptId = depth <= CAPTURA_SIMPLE_MAX_DEPTH ? 'CAPTURA_SIMPLE' : 'PUNTO_VITAL'
  }

  return { conceptId, board, targetPoints: groupPoints, targetColor, toMove, objective, tree: result.root }
}

async function main() {
  const problems: Problem[] = [...buildSeedProblems()]
  const seenBoards = new Set<string>()

  for (let g = 0; g < SELF_PLAY_GAMES; g++) {
    const blackStrong = g % 2 === 0
    const blackPlayouts = blackStrong ? STRONG_PLAYOUTS : WEAK_PLAYOUTS
    const whitePlayouts = blackStrong ? WEAK_PLAYOUTS : STRONG_PLAYOUTS
    const positions = playSelfPlayGame(1000 + g, blackPlayouts, whitePlayouts)
    const lastPositions = positions.slice(-8) // los finales de partida son los que producen mas peleas locales resueltas

    for (const board of lastPositions) {
      for (const candidate of findCandidateGroups(board)) {
        const key = candidate.points.slice().sort((a, b) => a - b).join(',') + `:${candidate.color}`
        if (seenBoards.has(key)) continue
        seenBoards.add(key)

        const attacker = opponent(candidate.color)
        const asKill = tryBuildProblem(board, candidate.points, candidate.color, attacker, 'kill')
        if (asKill) problems.push(asKill)

        const asLive = tryBuildProblem(board, candidate.points, candidate.color, candidate.color, 'live')
        if (asLive) problems.push(asLive)
      }
    }
    console.log(`Partida de autojuego ${g + 1}/${SELF_PLAY_GAMES} (negro=${blackPlayouts}, blanco=${whitePlayouts}) lista. Problemas acumulados: ${problems.length}`)
  }

  const root = dirname(fileURLToPath(import.meta.url))
  const outDir = join(root, '..', 'src', 'content', 'problems')
  await mkdir(outDir, { recursive: true })

  const bank = problems.map((problem, index) => ({
    id: `p${index + 1}`,
    conceptId: problem.conceptId,
    sgf: problemToSgf(problem),
  }))

  await writeFile(join(outDir, 'bank.json'), JSON.stringify(bank, null, 2))

  const byConcept: Record<string, number> = {}
  for (const p of bank) byConcept[p.conceptId] = (byConcept[p.conceptId] ?? 0) + 1
  console.log(`Generados ${bank.length} problemas:`, byConcept)
}

main()
