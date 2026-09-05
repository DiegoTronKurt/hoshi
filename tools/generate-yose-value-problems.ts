/**
 * Genera ejercicios de EL_FINAL_TAMBIEN_ES_GRANDE y COMPARAR_VALOR_REAL: la
 * misma pregunta que PASE_PREMATURO/RELLENO_TERRITORIO_PROPIO
 * (generate-area-value-problems.ts) -- "cual es la mejor jugada aca" --
 * pero mas estricta: la respuesta correcta es EL punto que iguala
 * bestAreaMove(board, toMove), no cualquier punto que supere el umbral. La
 * validacion en vivo (useSolvableExercise.ts) usa exactamente la misma
 * funcion, asi que no hay forma de generar un problema que la propia
 * validacion despues rechace.
 *
 * Clasificacion de cada posicion candidata (todo calculado con
 * solver/areaValue.ts sobre el tablero real, nada asumido a mano):
 * - El mejor delta supera BIG_DELTA_THRESHOLD -> EL_FINAL_TAMBIEN_ES_GRANDE:
 *   un solo punto de yose que vale sorprendentemente caro por si solo.
 * - Si no, pero hay al menos 2 puntos con delta > PASS_VALUE_THRESHOLD y el
 *   mejor supera estrictamente al segundo (sin empate) -> COMPARAR_VALOR_REAL:
 *   dos candidatos reales, hay que compararlos, no alcanza con "cualquiera
 *   que sirva" (eso ya lo cubre PASE_PREMATURO en nivel 1).
 * - Si no, se descarta (no ilustra ninguno de los dos conceptos con claridad).
 *
 * BIG_DELTA_THRESHOLD se elige mirando la distribucion real de deltas del
 * propio corpus generado (mismo criterio que content/difficulty.ts), no a
 * ciegas: correr el script una vez, mirar el resumen de percentiles que
 * imprime, y ajustar la constante si hace falta antes de aceptar el banco
 * final.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createGame, applyMove } from '../src/core/rules'
import { BLACK, EMPTY } from '../src/core/types'
import type { BoardState, Color, GameState } from '../src/core/types'
import { chooseMove } from '../src/engine/mcts'
import { areaDeltaForPoint, PASS_VALUE_THRESHOLD } from '../src/solver/areaValue'
import { areaValueProblemToSgf } from '../src/content/areaValueProblem'
import type { AreaValueProblem } from '../src/content/areaValueProblem'

const BOARD_SIZE = 9
const SELF_PLAY_GAMES = 20
const WEAK_PLAYOUTS = 100
const STRONG_PLAYOUTS = 400
const MAX_MOVE_TIME_MS = 3000
const LATE_GAME_POSITIONS = 12

// Elegido mirando la distribucion real que imprime este mismo script (no a
// ciegas), aunque termino mas generoso de lo planeado: con 20 partidas de
// autojuego (semilla 9000+), la distribucion real de mejores deltas fue
// p50=4 p75=12 p90=22 max=26 (n=106) -- este umbral cae apenas sobre la
// mediana, asi que "grande" termino siendo la mayoria de las posiciones
// candidatas y COMPARAR_VALOR_REAL un banco chico (ver NOTAS.md). Subir el
// umbral (p.ej. cerca de p75) repartiria mejor los dos conceptos, a costa de
// otra corrida completa de autojuego -- queda como mejora futura, no bloquea
// el banco actual (cada entrada sigue siendo correcta, solo la proporcion
// entre los dos conceptos no es pareja).
const BIG_DELTA_THRESHOLD = 6

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

/** Deltas de area de todos los puntos que superan el umbral de "vale la
 * pena", para `color`, ordenados de mayor a menor. Mismo calculo que usa
 * bestAreaMove por dentro, pero aca hace falta el segundo lugar tambien, no
 * solo el primero. */
function candidateDeltas(board: BoardState, color: Color): number[] {
  const deltas: number[] = []
  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] !== EMPTY) continue
    const delta = areaDeltaForPoint(board, p, color)
    if (delta !== null && delta > PASS_VALUE_THRESHOLD) deltas.push(delta)
  }
  deltas.sort((a, b) => b - a)
  return deltas
}

function classify(deltas: number[]): AreaValueProblem['conceptId'] | null {
  if (deltas.length === 0) return null
  if (deltas[0] >= BIG_DELTA_THRESHOLD) return 'EL_FINAL_TAMBIEN_ES_GRANDE'
  if (deltas.length >= 2 && deltas[0] > deltas[1]) return 'COMPARAR_VALOR_REAL'
  return null
}

async function main() {
  const problems: AreaValueProblem[] = []
  const seen = new Set<string>()
  const bestDeltasSeen: number[] = []

  for (let g = 0; g < SELF_PLAY_GAMES; g++) {
    const gameStart = Date.now()
    const blackStrong = g % 2 === 0
    const blackPlayouts = blackStrong ? STRONG_PLAYOUTS : WEAK_PLAYOUTS
    const whitePlayouts = blackStrong ? WEAK_PLAYOUTS : STRONG_PLAYOUTS
    const states = playSelfPlayGame(9000 + g, blackPlayouts, whitePlayouts)
    console.log(`  (partida ${g + 1} jugada en ${Math.round((Date.now() - gameStart) / 1000)}s, ${states.length} jugadas)`)
    const late = states.slice(-LATE_GAME_POSITIONS)

    for (const state of late) {
      if (state.gameOver) continue
      const board = state.board
      const toMove = state.toMove

      const key = board.stones.join('') + `:${toMove}`
      if (seen.has(key)) continue
      seen.add(key)

      const deltas = candidateDeltas(board, toMove)
      if (deltas.length > 0) bestDeltasSeen.push(deltas[0])

      const conceptId = classify(deltas)
      if (conceptId) problems.push({ conceptId, board, toMove })
    }
    const grande = problems.filter((p) => p.conceptId === 'EL_FINAL_TAMBIEN_ES_GRANDE').length
    const comparar = problems.filter((p) => p.conceptId === 'COMPARAR_VALOR_REAL').length
    console.log(`Partida ${g + 1}/${SELF_PLAY_GAMES} lista. EL_FINAL_TAMBIEN_ES_GRANDE=${grande} COMPARAR_VALOR_REAL=${comparar}`)
  }

  bestDeltasSeen.sort((a, b) => a - b)
  const percentile = (p: number) => bestDeltasSeen[Math.floor(bestDeltasSeen.length * p)] ?? 0
  console.log(
    `Distribucion de mejores deltas (n=${bestDeltasSeen.length}): p50=${percentile(0.5)} p75=${percentile(0.75)} p90=${percentile(0.9)} max=${bestDeltasSeen[bestDeltasSeen.length - 1] ?? 0}`,
  )

  const root = dirname(fileURLToPath(import.meta.url))
  const outDir = join(root, '..', 'src', 'content', 'problems')
  await mkdir(outDir, { recursive: true })

  const bank = problems.map((problem, index) => ({
    id: `yoseValue${index + 1}`,
    conceptId: problem.conceptId,
    sgf: areaValueProblemToSgf(problem),
    difficulty: 'easy' as const,
  }))

  await writeFile(join(outDir, 'yose-value.json'), JSON.stringify(bank, null, 2))
  console.log(`Generados ${bank.length} problemas de valor de yose.`)
}

main()
