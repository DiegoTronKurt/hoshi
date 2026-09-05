/**
 * Genera ejercicios de CONTAR_LIBERTADES_ANTES_DE_JUGAR y
 * LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO: generacion procedural/por
 * plantilla, no autojuego (una carrera de captura aislada y limpia no
 * aparece de forma confiable jugando partidas al azar en un tablero chico).
 * Construye pares de cadenas rectas verticales enfrentadas con un hueco de
 * una columna (misma forma que n10.ts::SYMMETRIC_BOARD/BEHIND_BOARD, solo
 * que aca se barren muchas combinaciones de largo en vez de una sola a
 * mano), y mide todo con las funciones reales (getGroup, via
 * solver/semeai.ts) en vez de calcular libertades a mano.
 *
 * Filtros de aceptacion, todos contra el tablero real, nada asumido:
 * - isSingleGroup en cada lado, hasNoZeroLibertyGroups en el tablero entero.
 * - Sin ojos: cada libertad de cada grupo debe caer en la region vacia
 *   neutral de computeAreaOwnership (ni negro ni blanco la "posee" todavia).
 *   bensonPassAlive no alcanza aca: solo detecta vida incondicional con dos
 *   ojos, y el caso peligroso es exactamente el de UN ojo real (ver
 *   UN_OJO_GANA, fuera de alcance de este banco), que bensonPassAlive no
 *   vería venir.
 * - Para CONTAR_LIBERTADES_ANTES_DE_JUGAR: diferencia de libertades totales
 *   >= MIN_LIBERTY_GAP (descarta el caso empatado, donde el resultado
 *   depende de quien juega primero, no es mecanico) MAS una simulacion de
 *   confirmacion (llenar las libertades de afuera del rival antes que las
 *   compartidas, turno por turno, con applyMove real) que tiene que dar el
 *   mismo ganador para los dos ordenes de salida posibles -- no alcanza con
 *   la resta de libertades sola, se re-verifica jugando la carrera de
 *   verdad, mismo estandar que content/seeds.ts.
 * - Para LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO no hace falta ninguna
 *   diferencia de libertades (el ejemplo de la propia leccion n10-l3 esta
 *   empatado a proposito): alcanza con que haya de verdad al menos una
 *   libertad compartida para senalar, lo que la construccion ya garantiza.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { applicableTransforms, createBoard, transformBoard, transformPoint } from '../src/core/board'
import { hasNoZeroLibertyGroups, isSingleGroup } from '../src/content/positionValidation'
import { getGroup } from '../src/core/groups'
import { applyMove, gameStateFromBoard } from '../src/core/rules'
import { computeAreaOwnership } from '../src/core/scoring'
import { BLACK, EMPTY, opponent, WHITE } from '../src/core/types'
import type { BoardState, Color } from '../src/core/types'
import { raceBehindColor, sharedLibertiesOf } from '../src/solver/semeai'
import { semeaiLibertyProblemToSgf } from '../src/content/semeaiLibertyProblem'
import type { SemeaiLibertyProblem } from '../src/content/semeaiLibertyProblem'

const WIDTH = 19
const HEIGHT = 19
const MIN_LIBERTY_GAP = 2
const CHAIN_LENGTHS = [1, 2, 3, 4]
const MAX_RACE_PLIES = 40

/** Tablero base: dos cadenas verticales rectas, columnas xa=5/xb=7 (un solo
 * hueco de por medio, columna 6), ambas arrancando en la misma fila --
 * garantiza al menos una libertad compartida por construccion (las filas
 * donde ambas cadenas se solapan comparten esa columna de hueco). */
function buildRace(lenA: number, lenB: number, colorA: Color): { board: BoardState; groupAPoint: number; groupBPoint: number } {
  const xa = 5
  const xb = 7
  const y0 = 8
  const board = createBoard(WIDTH, HEIGHT)
  const colorB = opponent(colorA)
  for (let i = 0; i < lenA; i++) board.stones[(y0 + i) * WIDTH + xa] = colorA
  for (let i = 0; i < lenB; i++) board.stones[(y0 + i) * WIDTH + xb] = colorB
  return { board, groupAPoint: y0 * WIDTH + xa, groupBPoint: y0 * WIDTH + xb }
}

function hasNoEyes(board: BoardState, points: Iterable<number>): boolean {
  const owner = computeAreaOwnership(board)
  for (const p of points) {
    if (owner[p] !== EMPTY) return false
  }
  return true
}

/** Simula la carrera jugando siempre una libertad de afuera del rival si
 * queda alguna, si no una compartida -- con applyMove real, no una formula.
 * Devuelve el color que termina capturado primero, o null si no se decide
 * en MAX_RACE_PLIES jugadas (no deberia pasar en estas formas chicas). */
function simulateRace(board: BoardState, groupAPoint: number, groupBPoint: number, firstToMove: Color): Color | null {
  const originalColorA = board.stones[groupAPoint] as Color
  const originalColorB = board.stones[groupBPoint] as Color
  let state = gameStateFromBoard(board, firstToMove)

  for (let ply = 0; ply < MAX_RACE_PLIES; ply++) {
    const groupA = getGroup(state.board, groupAPoint)
    if (!groupA) return originalColorA // group A ya no tiene piedra ahi: la capturaron
    const groupB = getGroup(state.board, groupBPoint)
    if (!groupB) return originalColorB

    const theirs = state.toMove === groupA.color ? groupB : groupA
    const shared = sharedLibertiesOf(state.board, groupAPoint, groupBPoint) ?? new Set<number>()
    const theirOutside = [...theirs.liberties].filter((p) => !shared.has(p))
    const target = theirOutside[0] ?? [...shared][0]
    if (target === undefined) return null

    const result = applyMove(state, target)
    if (!result.legal || !result.state) return null
    state = result.state
  }
  return null
}

/** null si la posicion no sirve para CONTAR_LIBERTADES_ANTES_DE_JUGAR
 * (empatada, brecha chica, o la simulacion no confirma el resultado
 * esperado para los dos ordenes de salida) -- si no, el color que va
 * perdiendo, ya confirmado por simulacion real ademas del conteo estatico. */
function classifyBehind(board: BoardState, groupAPoint: number, groupBPoint: number): Color | null {
  const behind = raceBehindColor(board, groupAPoint, groupBPoint)
  if (!behind) return null

  const groupA = getGroup(board, groupAPoint)
  const groupB = getGroup(board, groupBPoint)
  if (!groupA || !groupB) return null
  if (Math.abs(groupA.liberties.size - groupB.liberties.size) < MIN_LIBERTY_GAP) return null

  // simulateRace devuelve quien termina CAPTURADO (el que va perdiendo), no
  // el ganador -- se compara contra `behind` (la prediccion estatica de
  // quien pierde), no contra su oponente.
  const firstColor = groupA.color
  const capturedMovingFirstA = simulateRace(board, groupAPoint, groupBPoint, firstColor)
  const capturedMovingFirstB = simulateRace(board, groupAPoint, groupBPoint, opponent(firstColor))
  if (capturedMovingFirstA !== behind || capturedMovingFirstB !== behind) return null

  return behind
}

async function main() {
  const behindProblems: SemeaiLibertyProblem[] = []
  const sharedProblems: SemeaiLibertyProblem[] = []
  const seen = new Set<string>()

  for (const lenA of CHAIN_LENGTHS) {
    for (const lenB of CHAIN_LENGTHS) {
      for (const colorA of [BLACK, WHITE] as Color[]) {
        const base = buildRace(lenA, lenB, colorA)

        for (const transform of applicableTransforms(WIDTH, HEIGHT)) {
          const board = transformBoard(base.board, transform)
          const groupAPoint = transformPoint(WIDTH, HEIGHT, base.groupAPoint, transform)
          const groupBPoint = transformPoint(WIDTH, HEIGHT, base.groupBPoint, transform)

          const key = board.stones.join('')
          if (seen.has(key)) continue
          seen.add(key)

          const groupA = getGroup(board, groupAPoint)
          const groupB = getGroup(board, groupBPoint)
          if (!groupA || !groupB) continue
          if (!isSingleGroup(board, groupA.color) || !isSingleGroup(board, groupB.color)) continue
          if (!hasNoZeroLibertyGroups(board)) continue
          if (!hasNoEyes(board, groupA.liberties) || !hasNoEyes(board, groupB.liberties)) continue

          const shared = sharedLibertiesOf(board, groupAPoint, groupBPoint)
          if (!shared || shared.size === 0) continue

          sharedProblems.push({
            conceptId: 'LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO',
            board,
            toMove: groupA.color,
            groupAPoint,
            groupBPoint,
          })

          const behind = classifyBehind(board, groupAPoint, groupBPoint)
          if (behind) {
            behindProblems.push({
              conceptId: 'CONTAR_LIBERTADES_ANTES_DE_JUGAR',
              board,
              toMove: behind,
              groupAPoint,
              groupBPoint,
            })
          }
        }
      }
    }
  }

  console.log(
    `CONTAR_LIBERTADES_ANTES_DE_JUGAR=${behindProblems.length} LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO=${sharedProblems.length}`,
  )

  const root = dirname(fileURLToPath(import.meta.url))
  const outDir = join(root, '..', 'src', 'content', 'problems')
  await mkdir(outDir, { recursive: true })

  const bank = [...behindProblems, ...sharedProblems].map((problem, index) => ({
    id: `semeaiLiberty${index + 1}`,
    conceptId: problem.conceptId,
    sgf: semeaiLibertyProblemToSgf(problem),
    difficulty: 'easy' as const,
  }))

  await writeFile(join(outDir, 'semeai-liberty.json'), JSON.stringify(bank, null, 2))
  console.log(`Generados ${bank.length} problemas de libertades de semeai.`)
}

main()
