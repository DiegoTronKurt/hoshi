import { useEffect, useMemo, useState } from 'react'
import { conceptsThatGenerateExercises } from '../../analysis/concepts'
import type { ConceptId } from '../../analysis/concepts'
import { BLACK } from '../../core/types'
import { listBankEntries, loadProblem } from '../../content/problemBank'
import type { BankEntry } from '../../content/problemBank'
import type { Problem } from '../../content/problemSgf'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { SolverClient } from '../../solver/client'
import { BoardCanvas } from '../board/BoardCanvas'
import { useSettings } from '../settings'
import { useSolvableProblem } from './useSolvableProblem'

function pickEntry(entries: BankEntry[], excludeId?: string): BankEntry | null {
  const pool = entries.length > 1 ? entries.filter((e) => e.id !== excludeId) : entries
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

interface ExercisesScreenProps {
  /** Concepto preseleccionado al entrar (p.ej. desde el enlace "practicar mas" de una leccion). */
  initialConcept?: ConceptId
}

export function ExercisesScreen({ initialConcept }: ExercisesScreenProps = {}) {
  const { t } = useI18n()
  const { theme } = useSettings()
  const concepts = useMemo(() => conceptsThatGenerateExercises(), [])

  const [conceptFilter, setConceptFilter] = useState<ConceptId | 'all'>(initialConcept ?? 'all')
  const entries = useMemo(
    () => listBankEntries(conceptFilter === 'all' ? undefined : conceptFilter),
    [conceptFilter],
  )

  const [entry, setEntry] = useState<BankEntry | null>(() => pickEntry(entries))
  const [problem, setProblem] = useState<Problem | null>(null)

  const [solverClient, setSolverClient] = useState<SolverClient | null>(null)
  useEffect(() => {
    const client = new SolverClient()
    setSolverClient(client)
    return () => client.terminate()
  }, [])

  useEffect(() => {
    const next = pickEntry(entries)
    setEntry(next)
  }, [entries])

  useEffect(() => {
    setProblem(entry ? loadProblem(entry) : null)
  }, [entry])

  const { game, lastMove, status, thinking, solutionMoves, handleIntersectionClick, reset } = useSolvableProblem(
    entry,
    problem,
    solverClient,
  )

  function handleNext() {
    setEntry(pickEntry(entries, entry?.id))
  }

  if (entries.length === 0) {
    return (
      <div className="exercises-empty">
        <p>{t('exercises.noProblems')}</p>
      </div>
    )
  }

  if (!problem || !game) return null

  const userColor = problem.toMove
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
        <button type="button" onClick={reset}>
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
        theme={theme}
        onIntersectionClick={handleIntersectionClick}
      />

      <div className="exercises-status" aria-live="polite">
        {status === 'solved' && <p className="exercises-solved">{t('exercises.solved')}</p>}
        {status === 'incorrect' && !thinking && <p className="exercises-incorrect">{t('exercises.incorrect')}</p>}
        {thinking && <p>{t('exercises.thinking')}</p>}
      </div>
    </div>
  )
}
