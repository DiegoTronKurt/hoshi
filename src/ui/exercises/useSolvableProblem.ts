import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BankEntry } from '../../content/problemBank'
import type { Problem } from '../../content/problemSgf'
import { gameStateFromBoard, applyMove } from '../../core/rules'
import type { GameState } from '../../core/types'
import { createCard, gradeFromAttempt, reviewCard } from '../../learning/fsrs'
import { computeRegion } from '../../solver/region'
import type { SolverClient } from '../../solver/client'
import { isGroupPassAlive } from '../../solver/tsumego'
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

/**
 * Toda la mecanica de resolver un problema en vivo contra el solucionador:
 * validar la jugada, jugar la respuesta del rival, y llevar la cuenta de
 * intentos. La usan tanto Ejercicios (practica libre) como Hoy (sesion
 * dirigida por FSRS), asi que el registro de aprendizaje vive aca, no en
 * cada pantalla: cualquier problema resuelto, sin importar por donde se
 * llegue a el, actualiza el intento guardado y la tarjeta SRS de ese
 * problema. Practicar en Ejercicios tambien cuenta para el perfil y para
 * cuando "Hoy" vuelve a ofrecer ese mismo problema.
 */
export function useSolvableProblem(
  entry: BankEntry | null,
  problem: Problem | null,
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

  const region = useMemo(() => {
    if (!problem) return []
    return computeRegion(problem.board, problem.targetPoints, 1)
  }, [problem])

  const isResolved = useCallback(
    (g: GameState): boolean => {
      if (!problem) return false
      if (problem.objective === 'live') {
        return isGroupPassAlive(g.board, problem.targetPoints, problem.targetColor)
      }
      return !problem.targetPoints.some((p) => g.board.stones[p] === problem.targetColor)
    },
    [problem],
  )

  useEffect(() => {
    wrongAttemptsRef.current = 0
    recordedRef.current = false
    if (!problem) {
      setGame(null)
      setLastMove(null)
      setStatus('playing')
      return
    }
    setGame(gameStateFromBoard(problem.board, problem.toMove))
    setLastMove(null)
    setStatus('playing')
  }, [problem])

  // Simula la linea optima completa una vez, al cargar el problema, solo para
  // contar cuantas jugadas propias hacen falta para resolverlo.
  useEffect(() => {
    setSolutionMoves(null)
    const client = solverClient
    if (!problem || !client) return
    const p = problem
    const c = client
    const r = region
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
  }, [problem, region, isResolved, solverClient])

  const recordOutcome = useCallback(
    async (solved: boolean) => {
      if (!entry) return
      const wrongAttempts = wrongAttemptsRef.current
      try {
        await recordAttempt({
          problemId: entry.id,
          conceptId: entry.conceptId,
          createdAt: new Date().toISOString(),
          solved,
          wrongAttempts,
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

  const userColor = problem?.toMove ?? null
  const isUserTurn =
    (status === 'playing' || status === 'incorrect') && !!game && !!problem && game.toMove === userColor

  async function handleIntersectionClick(point: number) {
    if (!isUserTurn || thinking || !problem || !game) return
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
  }

  function reset() {
    if (!problem) return
    wrongAttemptsRef.current = 0
    recordedRef.current = false
    setGame(gameStateFromBoard(problem.board, problem.toMove))
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
