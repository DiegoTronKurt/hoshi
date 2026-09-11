/**
 * Genera ejercicios para SENTE_ANTES_QUE_GOTE (Nivel 9, hoy sin ningun banco
 * -- generatesExercises pasa a true en analysis/concepts.ts como parte de
 * este mismo cambio). Mismo tablero/autojuego que generate-yose-value-
 * problems.ts (9x9, 20 partidas, mismo par de presupuestos de playouts
 * asimetrico) -- sente/gote es un concepto de la misma etapa (yose), asi que
 * no hay motivo para un tablero mas grande ni mas partidas.
 *
 * Reusa el mismo formato AreaValueProblem que generate-yose-value-
 * problems.ts/generate-whole-board-judgment-problems.ts (board + toMove, sin
 * guardar la respuesta): la validacion en vivo (useSolvableExercise.ts) ya
 * sabe validar SENTE_ANTES_QUE_GOTE llamando a classifySenteGote(board,
 * point, toMove) sobre el tablero actual, asi que agregar este concepto ahi
 * y en problemBank.ts::entryKind es la unica plomeria nueva.
 *
 * El FILTRO de generacion (lo unico distinto de este script): la posicion
 * tiene que traer AL MENOS un punto que classifySenteGote etiquete 'sente' y
 * al menos uno 'gote', para que "elegir el sente primero" sea una decision
 * real y no la unica jugada disponible.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createGame, applyMove } from '../src/core/rules'
import { BLACK, EMPTY } from '../src/core/types'
import type { GameState } from '../src/core/types'
import { chooseMove } from '../src/engine/mcts'
import { classifySenteGote } from '../src/solver/areaValue'
import { areaValueProblemToSgf } from '../src/content/areaValueProblem'
import type { AreaValueProblem } from '../src/content/areaValueProblem'

const BOARD_SIZE = 9
const SELF_PLAY_GAMES = 20
const WEAK_PLAYOUTS = 100
const STRONG_PLAYOUTS = 400
const MAX_MOVE_TIME_MS = 3000
// Mas alto que generate-yose-value-problems.ts (12): un diagnostico real
// (ver NOTAS.md) mostro que las jugadas sente genuinas (segun
// classifySenteGote) aparecen sobre todo a mitad de partida, no en el tramo
// final -- las 12 ultimas jugadas de una partida ya resuelta por MCTS casi
// nunca dejan una amenaza sin cobrar (el bot fuerte ya la jugo antes de
// llegar ahi). 40 cubre bien la transicion medio juego -> yose sin llegar a
// la apertura (tablero casi vacio, sin candidatos reales todavia).
const LATE_GAME_POSITIONS = 40

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

/** true si la posicion trae al menos un candidato sente y al menos uno gote
 * -- sin eso, "elegir el sente primero" no es una eleccion real. No importa
 * CUANTOS de cada uno haya (la validacion en vivo acepta cualquier punto que
 * classifySenteGote etiquete 'sente', no uno guardado), solo que ambos tipos
 * existan simultaneamente en esta posicion concreta. */
function hasRealChoice(board: GameState['board'], toMove: GameState['toMove']): boolean {
  let sawSente = false
  let sawGote = false
  for (let p = 0; p < board.stones.length && !(sawSente && sawGote); p++) {
    if (board.stones[p] !== EMPTY) continue
    const verdict = classifySenteGote(board, p, toMove)
    if (verdict === 'sente') sawSente = true
    else if (verdict === 'gote') sawGote = true
  }
  return sawSente && sawGote
}

async function writeBank(problems: AreaValueProblem[], outDir: string): Promise<void> {
  const bank = problems.map((problem, index) => ({
    id: `senteGote${index + 1}`,
    conceptId: problem.conceptId,
    sgf: areaValueProblemToSgf(problem),
    difficulty: 'medium' as const,
  }))
  await writeFile(join(outDir, 'sente-gote.json'), JSON.stringify(bank, null, 2))
}

async function main() {
  const problems: AreaValueProblem[] = []
  const seen = new Set<string>()

  const root = dirname(fileURLToPath(import.meta.url))
  const outDir = join(root, '..', 'src', 'content', 'problems')
  await mkdir(outDir, { recursive: true })

  for (let g = 0; g < SELF_PLAY_GAMES; g++) {
    const gameStart = Date.now()
    const blackStrong = g % 2 === 0
    const blackPlayouts = blackStrong ? STRONG_PLAYOUTS : WEAK_PLAYOUTS
    const whitePlayouts = blackStrong ? WEAK_PLAYOUTS : STRONG_PLAYOUTS
    const states = playSelfPlayGame(31000 + g, blackPlayouts, whitePlayouts)
    console.log(`  (partida ${g + 1} jugada en ${Math.round((Date.now() - gameStart) / 1000)}s, ${states.length} jugadas)`)
    const late = states.slice(-LATE_GAME_POSITIONS)

    for (const state of late) {
      if (state.gameOver) continue
      const board = state.board
      const toMove = state.toMove

      const key = board.stones.join('') + `:${toMove}`
      if (seen.has(key)) continue
      seen.add(key)

      if (hasRealChoice(board, toMove)) {
        problems.push({ conceptId: 'SENTE_ANTES_QUE_GOTE', board, toMove })
      }
    }
    console.log(`Partida ${g + 1}/${SELF_PLAY_GAMES} lista. SENTE_ANTES_QUE_GOTE=${problems.length}`)
    // Checkpoint tras cada partida -- mismo motivo que
    // generate-whole-board-judgment-problems.ts: un proceso de fondo matado
    // a mitad de camino deja igual un banco parcial valido en disco.
    await writeBank(problems, outDir)
  }

  console.log(`Generados ${problems.length} problemas de sente antes que gote.`)
}

main()

