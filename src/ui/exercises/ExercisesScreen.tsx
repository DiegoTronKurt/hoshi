import { useEffect, useMemo, useState } from 'react'
import { conceptsThatGenerateExercises } from '../../analysis/concepts'
import type { ConceptId } from '../../analysis/concepts'
import { listBankEntries, loadEntry } from '../../content/problemBank'
import type { BankEntry, LoadedProblem } from '../../content/problemBank'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { SolverClient } from '../../solver/client'
import { useSettings } from '../settings'
import { ExerciseView } from './ExerciseView'
import { useSolvableExercise } from './useSolvableExercise'

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
  const [loaded, setLoaded] = useState<LoadedProblem | null>(null)

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
    setLoaded(entry ? loadEntry(entry) : null)
  }, [entry])

  const { game, lastMove, status, thinking, solutionMoves, handleIntersectionClick, reset } = useSolvableExercise(
    entry,
    loaded,
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

  if (!loaded || !game) return null

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

      <ExerciseView
        loaded={loaded}
        game={game}
        lastMove={lastMove}
        status={status}
        thinking={thinking}
        solutionMoves={solutionMoves}
        theme={theme}
        onIntersectionClick={handleIntersectionClick}
      />
    </div>
  )
}
