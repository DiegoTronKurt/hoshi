import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { conceptsThatGenerateExercises } from '../../analysis/concepts'
import type { ConceptId } from '../../analysis/concepts'
import { gameStateFromBoard, applyMove } from '../../core/rules'
import { BLACK } from '../../core/types'
import type { GameState } from '../../core/types'
import { listBankEntries, loadProblem } from '../../content/problemBank'
import type { BankEntry } from '../../content/problemBank'
import type { Problem } from '../../content/problemSgf'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { computeRegion } from '../../solver/region'
import { SolverClient } from '../../solver/client'
import { isGroupPassAlive } from '../../solver/tsumego'
import { BoardCanvas } from '../board/BoardCanvas'
import { minimoTheme } from '../board/themes'

type Status = 'playing' | 'incorrect' | 'solved'

const SOLVE_MAX_DEPTH = 8

function pickEntry(entries: BankEntry[], excludeId?: string): BankEntry | null {
  const pool = entries.length > 1 ? entries.filter((e) => e.id !== excludeId) : entries
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

export function ExercisesScreen() {
  const { t } = useI18n()
  const concepts = useMemo(() => conceptsThatGenerateExercises(), [])

  const [conceptFilter, setConceptFilter] = useState<ConceptId | 'all'>('all')
  const entries = useMemo(
    () => listBankEntries(conceptFilter === 'all' ? undefined : conceptFilter),
    [conceptFilter],
  )

  const [entry, setEntry] = useState<BankEntry | null>(() => pickEntry(entries))
  const [problem, setProblem] = useState<Problem | null>(null)
  const [game, setGame] = useState<GameState | null>(null)
  const [lastMove, setLastMove] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>('playing')
  const [thinking, setThinking] = useState(false)
  const [solutionMoves, setSolutionMoves] = useState<number | null>(null)

  const solverRef = useRef<SolverClient | null>(null)
  useEffect(() => {
    solverRef.current = new SolverClient()
    return () => solverRef.current?.terminate()
  }, [])

  useEffect(() => {
    const next = pickEntry(entries)
    setEntry(next)
  }, [entries])

  useEffect(() => {
    if (!entry) {
      setProblem(null)
      setGame(null)
      return
    }
    const loaded = loadProblem(entry)
    setProblem(loaded)
    setGame(gameStateFromBoard(loaded.board, loaded.toMove))
    setLastMove(null)
    setStatus('playing')
  }, [entry])

  const region = useMemo(() => {
    if (!problem) return []
    return computeRegion(problem.board, problem.targetPoints, 1)
  }, [problem])

  const userColor = problem?.toMove ?? null
  const isUserTurn = status === 'playing' && !!game && !!problem && game.toMove === userColor

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

  // Revisa si el objetivo ya quedo definido despues de cada jugada.
  useEffect(() => {
    if (!problem || !game) return
    if (isResolved(game)) setStatus('solved')
  }, [game, problem, isResolved])

  // Simula la linea optima completa una vez, al cargar el problema, solo para
  // contar cuantas jugadas propias hacen falta para resolverlo (se muestra en
  // las instrucciones, ej. "Se resuelve en 1 jugada"). No tiene relacion con
  // la jugada real del usuario ni con su solverRef.solve() del clic.
  useEffect(() => {
    setSolutionMoves(null)
    const client = solverRef.current
    if (!problem || !client) return
    const p = problem
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
          region,
          targetPoints: p.targetPoints,
          targetColor: p.targetColor,
          toMove: state.toMove,
          objective: p.objective,
          maxDepth: SOLVE_MAX_DEPTH,
          pruneAfterDecisive: true,
        })
        if (cancelled || !result.solved || result.root.move === null) return
        if (state.toMove === p.toMove) studentMoves++
        const applied = applyMove(state, result.root.move, { regionPoints: new Set(region) })
        if (!applied.legal || !applied.state) return
        state = applied.state
      }
    }

    countSolutionMoves()
    return () => {
      cancelled = true
    }
  }, [problem, region, isResolved])

  // Tu jugada y la respuesta del rival se resuelven con una sola llamada al
  // solucionador: pedirle la jugada del rival ya nos dice, de paso, si la
  // tuya seguia dejando el objetivo alcanzable. Antes se llamaba dos veces
  // (una para validar, otra en un efecto aparte para la respuesta) sobre la
  // misma posicion, duplicando la espera sin necesidad.
  //
  // Tu piedra se muestra de inmediato al hacer clic, antes de esperar al
  // solucionador: "Pensando..." solo aparece mientras se calcula la
  // respuesta del rival, nunca antes de que tu jugada se vea en el tablero.
  // Si resulta que la jugada no resuelve el problema, se revierte: no queda
  // permitido dejar una piedra puesta que no sirve, el tablero vuelve a como
  // estaba antes del clic y solo se explica por que no funciona.
  async function handleIntersectionClick(point: number) {
    if (!isUserTurn || thinking || !problem || !game) return
    if (!region.includes(point)) return

    const result = applyMove(game, point, { regionPoints: new Set(region) })
    if (!result.legal || !result.state) return

    const client = solverRef.current
    if (!client) return

    const previousGame = game
    const previousLastMove = lastMove

    setGame(result.state)
    setLastMove(point)

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
      setGame(previousGame)
      setLastMove(previousLastMove)
      setStatus('incorrect')
      return
    }

    if (isResolved(result.state)) {
      setStatus('solved')
      return
    }

    const applied = applyMove(result.state, check.root.move, { regionPoints: new Set(region) })
    if (applied.legal && applied.state) {
      setGame(applied.state)
      setLastMove(check.root.move ?? point)
    }
    setStatus('playing')
  }

  function handleNext() {
    setEntry(pickEntry(entries, entry?.id))
  }

  function handleReset() {
    if (!problem) return
    setGame(gameStateFromBoard(problem.board, problem.toMove))
    setLastMove(null)
    setStatus('playing')
  }

  if (entries.length === 0) {
    return (
      <div className="exercises-empty">
        <p>{t('exercises.noProblems')}</p>
      </div>
    )
  }

  if (!problem || !game) return null

  const objectiveKey: TranslationKey = problem.objective === 'live' ? 'exercises.objective.live' : 'exercises.objective.kill'
  const toMoveKey: TranslationKey = userColor === BLACK ? 'color.black' : 'color.white'

  return (
    <div className="exercises">
      <div className="exercises-controls">
        <label htmlFor="exercise-concept">{t('exercises.pickConcept')}</label>
        <select
          id="exercise-concept"
          value={conceptFilter}
          onChange={(event) => setConceptFilter(event.target.value as ConceptId | 'all')}
        >
          <option value="all">{t('exercises.allConcepts')}</option>
          {concepts.map((concept) => (
            <option key={concept.id} value={concept.id}>
              {t(concept.labelKey as TranslationKey)}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleReset}>
          {t('exercises.reset')}
        </button>
        <button type="button" onClick={handleNext}>
          {t('exercises.next')}
        </button>
      </div>

      <p className="exercises-meta">
        {t('exercises.concept')}: {t(`concept.${problem.conceptId}.label` as TranslationKey)} · {t('exercises.toMove')}{' '}
        {t(toMoveKey)} · {t(objectiveKey)}
        {solutionMoves !== null && (
          <> · {solutionMoves === 1 ? t('exercises.solvesInOne') : t('exercises.solvesInMany', { count: solutionMoves })}</>
        )}
      </p>

      <BoardCanvas
        size={problem.board.size}
        stones={game.board.stones}
        lastMove={lastMove}
        theme={minimoTheme}
        onIntersectionClick={handleIntersectionClick}
      />

      <div className="exercises-status" aria-live="polite">
        {status === 'solved' && <p className="exercises-solved">{t('exercises.solved')}</p>}
        {status === 'incorrect' && <p className="exercises-incorrect">{t('exercises.incorrect')}</p>}
        {status === 'playing' && thinking && <p>{t('exercises.thinking')}</p>}
      </div>
    </div>
  )
}
