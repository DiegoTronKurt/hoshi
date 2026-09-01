import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BankEntry, LoadedProblem } from '../../content/problemBank'
import { getGroup } from '../../core/groups'
import { gameStateFromBoard, applyMove } from '../../core/rules'
import { opponent } from '../../core/types'
import type { Color, GameState } from '../../core/types'
import { createCard, gradeFromAttempt, reviewCard } from '../../learning/fsrs'
import { computeRegion } from '../../solver/region'
import type { SolverClient } from '../../solver/client'
import { isGroupPassAlive } from '../../solver/tsumego'
import { simulateLadder, solveLadder } from '../../solver/ladder'
import { isDoubleAtariMove } from '../../solver/doubleAtari'
import { getSrsCard, recordAttempt, saveSrsCard } from '../../storage/db'
import { useSettings } from '../settings'

export type ProblemStatus = 'playing' | 'incorrect' | 'solved'

const SOLVE_MAX_DEPTH = 8

export interface SolvableProblemState {
  game: GameState | null
  lastMove: number | null
  status: ProblemStatus
  thinking: boolean
  solutionMoves: number | null
  isUserTurn: boolean
  handleIntersectionClick: (point: number) => void
  reset: () => void
  /** Reporta el problema como no resuelto (para un boton "no lo se" / saltar). */
  giveUp: () => void
}

/** A quien le toca jugar al empezar cada tipo de ejercicio. */
function initialToMove(loaded: LoadedProblem): Color {
  if (loaded.kind === 'tsumego') return loaded.problem.toMove
  if (loaded.kind === 'ladder') return loaded.problem.chaserColor
  return loaded.problem.color
}

/**
 * Toda la mecanica de resolver un ejercicio en vivo: validar la jugada,
 * jugar la respuesta del rival si corresponde, y llevar la cuenta de
 * intentos. La usan tanto Ejercicios (practica libre) como Hoy (sesion
 * dirigida por FSRS), asi que el registro de aprendizaje vive aca, no en
 * cada pantalla: cualquier problema resuelto, sin importar por donde se
 * llegue a el, actualiza el intento guardado y la tarjeta SRS de ese
 * problema.
 *
 * Tres tipos de problema conviven aca porque ninguno de los otros dos encaja
 * en Problem/solve() (ver content/ladderProblem.ts y
 * content/doubleAtariProblem.ts): tsumego valida contra el Worker del
 * solucionador de vida-muerte y deja que el rival responda con la mejor
 * defensa/ataque; escalera valida con solveLadder en el hilo principal (es
 * barata) y hace jugar al que huye su mejor escape; doble atari es
 * reconocimiento de una sola jugada, se resuelve al toque sin respuesta del
 * rival.
 */
export function useSolvableExercise(
  entry: BankEntry | null,
  loaded: LoadedProblem | null,
  solverClient: SolverClient | null,
): SolvableProblemState {
  const { playStoneSoundIfEnabled } = useSettings()
  const [game, setGame] = useState<GameState | null>(null)
  const [lastMove, setLastMove] = useState<number | null>(null)
  const [status, setStatus] = useState<ProblemStatus>('playing')
  const [thinking, setThinking] = useState(false)
  const [solutionMoves, setSolutionMoves] = useState<number | null>(null)

  const wrongAttemptsRef = useRef(0)
  const recordedRef = useRef(false)
  const startTimeRef = useRef<number | null>(null)

  const region = useMemo(() => {
    if (!loaded || loaded.kind !== 'tsumego') return []
    return computeRegion(loaded.problem.board, loaded.problem.targetPoints, 1)
  }, [loaded])

  const isResolved = useCallback(
    (g: GameState): boolean => {
      if (!loaded || loaded.kind !== 'tsumego') return false
      const problem = loaded.problem
      if (problem.objective === 'live') {
        return isGroupPassAlive(g.board, problem.targetPoints, problem.targetColor)
      }
      return !problem.targetPoints.some((p) => g.board.stones[p] === problem.targetColor)
    },
    [loaded],
  )

  useEffect(() => {
    wrongAttemptsRef.current = 0
    recordedRef.current = false
    startTimeRef.current = null
    if (!loaded) {
      setGame(null)
      setLastMove(null)
      setStatus('playing')
      return
    }
    setGame(gameStateFromBoard(loaded.problem.board, initialToMove(loaded)))
    setLastMove(null)
    setStatus('playing')
    startTimeRef.current = Date.now()
  }, [loaded])

  // Cuenta cuantas jugadas propias hacen falta para resolver el problema, una
  // sola vez al cargarlo. Para escalera y doble atari es sincrono y barato;
  // para tsumego simula la linea optima completa via el Worker.
  useEffect(() => {
    setSolutionMoves(null)
    if (!loaded) return

    if (loaded.kind === 'doubleAtari') {
      setSolutionMoves(1)
      return
    }

    if (loaded.kind === 'ladder') {
      const p = loaded.problem
      const step = simulateLadder({ board: p.board, runnerPoint: p.runnerPoint, chaserColor: p.chaserColor })
      setSolutionMoves(step.captured ? step.chaserMoves.length : null)
      return
    }

    const client = solverClient
    if (!client) return
    const p = loaded.problem
    const r = region
    const c = client
    let cancelled = false

    async function countSolutionMoves() {
      let state = gameStateFromBoard(p.board, p.toMove)
      let studentMoves = 0
      for (let ply = 0; ply < SOLVE_MAX_DEPTH; ply++) {
        if (isResolved(state)) {
          if (!cancelled) setSolutionMoves(studentMoves)
          return
        }
        const result = await c.solve({
          board: state.board,
          region: r,
          targetPoints: p.targetPoints,
          targetColor: p.targetColor,
          toMove: state.toMove,
          objective: p.objective,
          maxDepth: SOLVE_MAX_DEPTH,
          pruneAfterDecisive: true,
        })
        if (cancelled || !result.solved || result.root.move === null) return
        if (state.toMove === p.toMove) studentMoves++
        const applied = applyMove(state, result.root.move, { regionPoints: new Set(r) })
        if (!applied.legal || !applied.state) return
        state = applied.state
      }
    }

    countSolutionMoves()
    return () => {
      cancelled = true
    }
  }, [loaded, region, isResolved, solverClient])

  const recordOutcome = useCallback(
    async (solved: boolean) => {
      if (!entry) return
      const wrongAttempts = wrongAttemptsRef.current
      const responseTimeMs = startTimeRef.current !== null ? Date.now() - startTimeRef.current : undefined
      try {
        await recordAttempt({
          problemId: entry.id,
          conceptId: entry.conceptId,
          createdAt: new Date().toISOString(),
          solved,
          wrongAttempts,
          responseTimeMs,
        })
        const grade = gradeFromAttempt(solved, wrongAttempts)
        const existing = await getSrsCard(entry.id)
        const baseCard = existing?.card ?? createCard()
        const updatedCard = reviewCard(baseCard, grade)
        await saveSrsCard({ problemId: entry.id, conceptId: entry.conceptId, card: updatedCard })
      } catch {
        // Sin IndexedDB disponible (o algun otro fallo de almacenamiento), el
        // ejercicio en si ya funciono para la persona; solo se pierde el
        // registro de aprendizaje de este intento.
      }
    },
    [entry],
  )

  useEffect(() => {
    if (status === 'solved' && !recordedRef.current) {
      recordedRef.current = true
      void recordOutcome(true)
    }
  }, [status, recordOutcome])

  const userColor = loaded ? initialToMove(loaded) : null
  const isUserTurn =
    (status === 'playing' || status === 'incorrect') && !!game && !!loaded && game.toMove === userColor

  async function handleIntersectionClick(point: number) {
    if (!isUserTurn || thinking || !loaded || !game) return

    if (loaded.kind === 'tsumego') {
      const problem = loaded.problem
      if (!region.includes(point)) return

      const result = applyMove(game, point, { regionPoints: new Set(region) })
      if (!result.legal || !result.state) return
      playStoneSoundIfEnabled()

      const client = solverClient
      if (!client) return

      setThinking(true)
      const check = await client.solve({
        board: result.state.board,
        region,
        targetPoints: problem.targetPoints,
        targetColor: problem.targetColor,
        toMove: result.state.toMove,
        objective: problem.objective,
        maxDepth: SOLVE_MAX_DEPTH,
        pruneAfterDecisive: true,
      })
      setThinking(false)

      if (!check.solved) {
        wrongAttemptsRef.current += 1
        setStatus('incorrect')
        return
      }

      if (isResolved(result.state)) {
        setGame(result.state)
        setLastMove(point)
        setStatus('solved')
        return
      }

      const applied = applyMove(result.state, check.root.move, { regionPoints: new Set(region) })
      const nextGame = applied.legal && applied.state ? applied.state : result.state
      const nextLastMove = applied.legal && applied.state ? (check.root.move ?? point) : point
      if (applied.legal && applied.state) playStoneSoundIfEnabled()
      setGame(nextGame)
      setLastMove(nextLastMove)
      setStatus('playing')
      return
    }

    if (loaded.kind === 'ladder') {
      const problem = loaded.problem
      const result = applyMove(game, point)
      if (!result.legal || !result.state) return
      playStoneSoundIfEnabled()

      const afterChaser = result.state
      const runnerGroup = getGroup(afterChaser.board, problem.runnerPoint)
      if (!runnerGroup || runnerGroup.liberties.size === 0) {
        setGame(afterChaser)
        setLastMove(point)
        setStatus('solved')
        return
      }

      const outcome = solveLadder({
        board: afterChaser.board,
        runnerPoint: problem.runnerPoint,
        chaserColor: problem.chaserColor,
        toMove: opponent(problem.chaserColor),
      })

      if (!outcome.captured) {
        wrongAttemptsRef.current += 1
        setStatus('incorrect')
        return
      }

      const runnerMove = outcome.moves[0] ?? null
      if (runnerMove !== null) {
        // El que huye tiene una extension legal: la juega y sigue vivo (si
        // no lo estuviera, esa jugada habria sido suicidio e ilegal).
        const afterRunner = applyMove(afterChaser, runnerMove)
        playStoneSoundIfEnabled()
        setGame(afterRunner.legal && afterRunner.state ? afterRunner.state : afterChaser)
        setLastMove(runnerMove)
        setStatus('playing')
      } else {
        // El que huye no tiene ninguna jugada legal entre sus libertades
        // (todas serian suicidio): esta muerto, pero las piedras siguen en
        // el tablero hasta que el perseguidor efectivamente juegue ahi. Pasa
        // el turno para que el estudiante haga esa jugada final.
        const passed = applyMove(afterChaser, null)
        setGame(passed.legal && passed.state ? passed.state : afterChaser)
        setLastMove(point)
        setStatus('playing')
      }
      return
    }

    // doubleAtari: reconocimiento de una sola jugada, sin respuesta del rival.
    const problem = loaded.problem
    if (!isDoubleAtariMove(game.board, point, problem.color)) {
      wrongAttemptsRef.current += 1
      setStatus('incorrect')
      return
    }

    const result = applyMove(game, point)
    if (!result.legal || !result.state) return
    playStoneSoundIfEnabled()
    setGame(result.state)
    setLastMove(point)
    setStatus('solved')
  }

  function reset() {
    if (!loaded) return
    wrongAttemptsRef.current = 0
    recordedRef.current = false
    setGame(gameStateFromBoard(loaded.problem.board, initialToMove(loaded)))
    setLastMove(null)
    setStatus('playing')
  }

  function giveUp() {
    if (recordedRef.current) return
    recordedRef.current = true
    void recordOutcome(false)
  }

  return { game, lastMove, status, thinking, solutionMoves, isUserTurn, handleIntersectionClick, reset, giveUp }
}
