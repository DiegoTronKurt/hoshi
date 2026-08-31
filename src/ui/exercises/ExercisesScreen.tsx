import { useEffect, useMemo, useState } from 'react'
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
import { isGroupPassAlive, solve } from '../../solver/tsumego'
import { BoardCanvas } from '../board/BoardCanvas'
import { minimoTheme } from '../board/themes'

type Status = 'playing' | 'incorrect' | 'solved'

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
  const [waitingForOpponent, setWaitingForOpponent] = useState(false)

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

  // Turno automatico del rival: responde con la jugada que mas dificulta al objetivo.
  useEffect(() => {
    if (!problem || !game || status !== 'playing') return
    if (game.toMove === userColor) return

    setWaitingForOpponent(true)
    const result = solve({
      board: game.board,
      region,
      targetPoints: problem.targetPoints,
      targetColor: problem.targetColor,
      toMove: game.toMove,
      objective: problem.objective,
      maxDepth: 8,
    })

    const move = result.root.move
    const applied = applyMove(game, move, { regionPoints: new Set(region) })
    setWaitingForOpponent(false)
    if (!applied.legal || !applied.state) return

    setGame(applied.state)
    setLastMove(move)
  }, [game, problem, region, userColor, status])

  // Revisa si el objetivo ya quedo definido despues de cada jugada.
  useEffect(() => {
    if (!problem || !game) return
    if (problem.objective === 'live') {
      if (isGroupPassAlive(game.board, problem.targetPoints, problem.targetColor)) setStatus('solved')
    } else {
      const survives = problem.targetPoints.some((p) => game.board.stones[p] === problem.targetColor)
      if (!survives) setStatus('solved')
    }
  }, [game, problem])

  function handleIntersectionClick(point: number) {
    if (!isUserTurn || !problem || !game) return
    if (!region.includes(point)) return

    const result = applyMove(game, point, { regionPoints: new Set(region) })
    if (!result.legal || !result.state) return

    const check = solve({
      board: result.state.board,
      region,
      targetPoints: problem.targetPoints,
      targetColor: problem.targetColor,
      toMove: result.state.toMove,
      objective: problem.objective,
      maxDepth: 8,
    })

    if (!check.solved) {
      setStatus('incorrect')
      return
    }

    setStatus('playing')
    setGame(result.state)
    setLastMove(point)
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
        {status === 'playing' && waitingForOpponent && <p>{t('play.thinking')}</p>}
      </div>
    </div>
  )
}
