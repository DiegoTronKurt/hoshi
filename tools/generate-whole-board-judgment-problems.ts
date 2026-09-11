/**
 * Genera ejercicios para JUICIO_LOCAL_VS_GLOBAL (Nivel 7, hoy sin ningun
 * banco -- generatesExercises pasa a true en analysis/concepts.ts como parte
 * de este mismo cambio). A diferencia de yose-value.json (9x9,
 * EL_FINAL_TAMBIEN_ES_GRANDE/COMPARAR_VALOR_REAL, generate-yose-value-
 * problems.ts), que en un tablero casi lleno termina con un solo frente de
 * batalla contiguo, esta genera posiciones de 13x13 donde los candidatos
 * reales (delta de area > PASS_VALUE_THRESHOLD, mismo umbral que
 * detectPasePrematuro) forman al menos DOS zonas espacialmente separadas del
 * tablero -- la pregunta real de "juicio local vs. global" (n7-l2): no
 * comparar dos puntos vecinos del mismo lado, elegir entre zonas realmente
 * distintas.
 *
 * Reusa el mismo formato AreaValueProblem/bestAreaMove que
 * generate-yose-value-problems.ts -- la validacion en vivo
 * (useSolvableExercise.ts) ya sabe validar cualquier AreaValueProblem
 * llamando a bestAreaMove(board, toMove), asi que agregar este concepto ahi
 * y en problemBank.ts::entryKind es la unica plomeria nueva; ningun dato ni
 * mecanismo de validacion nuevo. Lo unico distinto de este script es el
 * FILTRO de generacion: agrupar candidatos por cercania y exigir al menos
 * dos grupos, con el grupo ganador claramente por delante del segundo.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { toXY } from '../src/core/board'
import { createGame, applyMove } from '../src/core/rules'
import { BLACK, EMPTY } from '../src/core/types'
import type { BoardState, Color, GameState } from '../src/core/types'
import { chooseMove } from '../src/engine/mcts'
import { areaDeltaForPoint, PASS_VALUE_THRESHOLD } from '../src/solver/areaValue'
import { areaValueProblemToSgf } from '../src/content/areaValueProblem'
import type { AreaValueProblem } from '../src/content/areaValueProblem'

const BOARD_SIZE = 13
// Bajado de 30: una corrida a 30 tardo mas de 4h de autojuego real y el
// proceso de fondo murio antes de terminar (sin nada escrito a disco, ver
// checkpoint mas abajo). Con 16 partidas ya se ve una distribucion sana y
// creciente de candidatos (confirmado en una corrida real: partida 15/16 ~50
// candidatos), tiempo total de autojuego bajo ~1h.
const SELF_PLAY_GAMES = 16
const WEAK_PLAYOUTS = 150
const STRONG_PLAYOUTS = 500
const MAX_MOVE_TIME_MS = 4000
const LATE_GAME_POSITIONS = 16

/** Distancia Chebyshev maxima para considerar dos candidatos "de la misma
 * zona". Valor de partida (ver el plan de esta sesion): se confirma mirando
 * la distribucion real de cantidad de zonas que imprime este mismo script
 * antes de aceptar el banco, mismo criterio que BIG_DELTA_THRESHOLD en
 * generate-yose-value-problems.ts. */
const CLUSTER_CHEBYSHEV = 4

/** El mejor grupo tiene que superar al segundo mejor grupo por al menos
 * esto para que la jugada correcta sea inequivoca -- mismo espiritu que
 * COMPARAR_VALOR_REAL exige deltas[0] > deltas[1], pero aca entre ZONAS
 * distintas del tablero, no entre dos puntos vecinos. */
const WINNER_MARGIN = 2

function playSelfPlayGame(randomSeed: number, blackPlayouts: number, whitePlayouts: number): GameState[] {
  let state: GameState = createGame(BOARD_SIZE, BOARD_SIZE, 6.5)
  const states: GameState[] = []
  const maxMoves = BOARD_SIZE * BOARD_SIZE * 3
  let played = 0

  while (!state.gameOver && played < maxMoves) {
    const playouts = state.toMove === BLACK ? blackPlayouts : whitePlayouts
    const choice = chooseMove(state, { playouts, randomSeed: randomSeed + played, maxTimeMs: MAX_MOVE_TIME_MS })
    const result = applyMove(state, choice.move)
    if (!result.legal || !result.state) break
    state = result.state
    states.push(state)
    played++
  }

  return states
}

interface Candidate {
  point: number
  delta: number
}

function candidatesFor(board: BoardState, color: Color): Candidate[] {
  const result: Candidate[] = []
  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] !== EMPTY) continue
    const delta = areaDeltaForPoint(board, p, color)
    if (delta !== null && delta > PASS_VALUE_THRESHOLD) result.push({ point: p, delta })
  }
  return result
}

/** Agrupamiento simple por enlace unico: cada candidato se suma al primer
 * grupo que tenga algun miembro a distancia Chebyshev <= maxDist, o arranca
 * uno nuevo. Orden descendente por delta primero, asi el primer miembro de
 * cada grupo es su punto de mayor valor. */
function clusterCandidates(board: BoardState, cands: Candidate[], maxDist: number): Candidate[][] {
  const sorted = [...cands].sort((a, b) => b.delta - a.delta)
  const clusters: Candidate[][] = []

  for (const candidate of sorted) {
    const [cx, cy] = toXY(board.width, candidate.point)
    let placed = false
    for (const cluster of clusters) {
      for (const member of cluster) {
        const [mx, my] = toXY(board.width, member.point)
        if (Math.max(Math.abs(cx - mx), Math.abs(cy - my)) <= maxDist) {
          cluster.push(candidate)
          placed = true
          break
        }
      }
      if (placed) break
    }
    if (!placed) clusters.push([candidate])
  }

  return clusters
}

function qualifies(clusters: Candidate[][]): boolean {
  if (clusters.length < 2) return false
  const bests = clusters.map((cluster) => Math.max(...cluster.map((c) => c.delta))).sort((a, b) => b - a)
  return bests[0] - bests[1] >= WINNER_MARGIN
}

async function writeBank(problems: AreaValueProblem[], outDir: string): Promise<void> {
  const bank = problems.map((problem, index) => ({
    id: `localVsGlobal${index + 1}`,
    conceptId: problem.conceptId,
    sgf: areaValueProblemToSgf(problem),
    difficulty: 'medium' as const,
  }))
  await writeFile(join(outDir, 'local-vs-global.json'), JSON.stringify(bank, null, 2))
}

async function main() {
  const problems: AreaValueProblem[] = []
  const seen = new Set<string>()
  const clusterCountsSeen: number[] = []

  const root = dirname(fileURLToPath(import.meta.url))
  const outDir = join(root, '..', 'src', 'content', 'problems')
  await mkdir(outDir, { recursive: true })

  for (let g = 0; g < SELF_PLAY_GAMES; g++) {
    const gameStart = Date.now()
    const blackStrong = g % 2 === 0
    const blackPlayouts = blackStrong ? STRONG_PLAYOUTS : WEAK_PLAYOUTS
    const whitePlayouts = blackStrong ? WEAK_PLAYOUTS : STRONG_PLAYOUTS
    const states = playSelfPlayGame(21000 + g, blackPlayouts, whitePlayouts)
    console.log(`  (partida ${g + 1} jugada en ${Math.round((Date.now() - gameStart) / 1000)}s, ${states.length} jugadas)`)
    const late = states.slice(-LATE_GAME_POSITIONS)

    for (const state of late) {
      if (state.gameOver) continue
      const board = state.board
      const toMove = state.toMove

      const key = board.stones.join('') + `:${toMove}`
      if (seen.has(key)) continue
      seen.add(key)

      const cands = candidatesFor(board, toMove)
      if (cands.length < 2) continue
      const clusters = clusterCandidates(board, cands, CLUSTER_CHEBYSHEV)
      clusterCountsSeen.push(clusters.length)

      if (qualifies(clusters)) {
        problems.push({ conceptId: 'JUICIO_LOCAL_VS_GLOBAL', board, toMove })
      }
    }
    console.log(`Partida ${g + 1}/${SELF_PLAY_GAMES} lista. JUICIO_LOCAL_VS_GLOBAL=${problems.length}`)
    // Checkpoint tras cada partida: una corrida anterior a 30 partidas murio
    // por el limite de tiempo del proceso de fondo sin escribir nada a
    // disco. Escribiendo el banco parcial en cada iteracion, matar el
    // proceso en cualquier momento deja un local-vs-global.json valido con
    // el progreso hecho hasta ahi.
    await writeBank(problems, outDir)
  }

  const byCount = new Map<number, number>()
  for (const n of clusterCountsSeen) byCount.set(n, (byCount.get(n) ?? 0) + 1)
  console.log(
    `Distribucion de cantidad de zonas por posicion candidata (n=${clusterCountsSeen.length}):`,
    Object.fromEntries([...byCount.entries()].sort((a, b) => a[0] - b[0])),
  )

  console.log(`Generados ${problems.length} problemas de juicio local vs. global.`)
}

main()
