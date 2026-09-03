/**
 * Genera ejercicios de RELLENO_TERRITORIO_PROPIO y PASE_PREMATURO: la misma
 * pregunta ("cual es la mejor jugada aca: un punto, o pasar?") vista desde
 * los dos lados. Ninguno de los dos encaja en Problem/solve() -- ver
 * content/areaValueProblem.ts -- asi que la validacion vive en
 * solver/areaValue.ts, no en un arbol de refutaciones guardado.
 *
 * A diferencia de generate-problems.ts (que busca peleas locales chicas en
 * cualquier momento de la partida), aca hace falta una posicion cercana al
 * final: en la apertura casi cualquier punto vacio "mejora el area" por
 * mucho mas de 2 puntos, asi que un ejercicio temprano seria trivial. Se
 * toman solo las ultimas posiciones de cada partida de autojuego.
 *
 * Clasificacion de cada posicion candidata (usa exactamente las mismas
 * funciones que valida el ejercicio en vivo, para no poder generar un
 * problema que la propia validacion despues rechace):
 * - bestAreaMove(board, toMove) no es null -> PASE_PREMATURO: la jugada
 *   real encontrada es la respuesta correcta, pasar es la trampa.
 * - bestAreaMove(board, toMove) es null Y toMove tiene territorio
 *   pass-alive propio -> RELLENO_TERRITORIO_PROPIO: pasar es correcto,
 *   jugar dentro del propio territorio es la trampa. Se exige territorio
 *   real (no solo "no hay nada que jugar") para que el ejercicio ensene
 *   algo especifico, no una posicion vacia cualquiera.
 * - bestAreaMove es null Y no hay territorio propio todavia -> se descarta
 *   (posicion sin ninguna trampa que valga la pena mostrar).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { bensonPassAlive } from '../src/core/benson'
import { createGame, applyMove } from '../src/core/rules'
import { BLACK } from '../src/core/types'
import type { BoardState, GameState } from '../src/core/types'
import { chooseMove } from '../src/engine/mcts'
import { bestAreaMove } from '../src/solver/areaValue'
import { areaValueProblemToSgf } from '../src/content/areaValueProblem'
import type { AreaValueProblem } from '../src/content/areaValueProblem'

const BOARD_SIZE = 9
const SELF_PLAY_GAMES = 64
const WEAK_PLAYOUTS = 100
const STRONG_PLAYOUTS = 800
const MAX_MOVE_TIME_MS = 3000
// A diferencia de generate-problems.ts (que mira las ultimas 8 jugadas),
// aca interesa el tramo final de verdad: mas cerca del cierre real de la
// partida, no solo "una pelea reciente".
const LATE_GAME_POSITIONS = 12

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

function hasOwnTerritory(board: BoardState, color: number): boolean {
  const { chains, territoryPoints } = bensonPassAlive(board, color as 1 | -1)
  return chains.length > 0 && territoryPoints.length > 0
}

async function main() {
  const problems: AreaValueProblem[] = []
  const seen = new Set<string>()

  for (let g = 0; g < SELF_PLAY_GAMES; g++) {
    const blackStrong = g % 2 === 0
    const blackPlayouts = blackStrong ? STRONG_PLAYOUTS : WEAK_PLAYOUTS
    const whitePlayouts = blackStrong ? WEAK_PLAYOUTS : STRONG_PLAYOUTS
    const states = playSelfPlayGame(4000 + g, blackPlayouts, whitePlayouts)
    const late = states.slice(-LATE_GAME_POSITIONS)

    for (const state of late) {
      if (state.gameOver) continue // sin jugador a quien preguntarle "cual es tu jugada"
      const board = state.board
      const toMove = state.toMove

      const key = board.stones.join('') + `:${toMove}`
      if (seen.has(key)) continue
      seen.add(key)

      const best = bestAreaMove(board, toMove)
      if (best) {
        problems.push({ conceptId: 'PASE_PREMATURO', board, toMove })
      } else if (hasOwnTerritory(board, toMove)) {
        problems.push({ conceptId: 'RELLENO_TERRITORIO_PROPIO', board, toMove })
      }
    }
    const pasePrematuro = problems.filter((p) => p.conceptId === 'PASE_PREMATURO').length
    const rellenoTerritorio = problems.filter((p) => p.conceptId === 'RELLENO_TERRITORIO_PROPIO').length
    console.log(`Partida ${g + 1}/${SELF_PLAY_GAMES} lista. PASE_PREMATURO=${pasePrematuro} RELLENO_TERRITORIO_PROPIO=${rellenoTerritorio}`)
  }

  const root = dirname(fileURLToPath(import.meta.url))
  const outDir = join(root, '..', 'src', 'content', 'problems')
  await mkdir(outDir, { recursive: true })

  const bank = problems.map((problem, index) => ({
    id: `areaValue${index + 1}`,
    conceptId: problem.conceptId,
    sgf: areaValueProblemToSgf(problem),
    // Ninguno de los dos tiene una nocion de "profundidad de lectura" (es
    // una sola jugada, sin secuencia): easy para todos, mismo criterio que
    // doble atari en content/difficulty.ts.
    difficulty: 'easy' as const,
  }))

  await writeFile(join(outDir, 'area-value.json'), JSON.stringify(bank, null, 2))
  console.log(`Generados ${bank.length} problemas de valor de area.`)
}

main()
