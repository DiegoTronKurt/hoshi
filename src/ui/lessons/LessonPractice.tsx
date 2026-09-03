import { useEffect, useMemo, useState } from 'react'
import type { Concept } from '../../analysis/concepts'
import { listBankEntries, loadEntry } from '../../content/problemBank'
import type { BankEntry, LoadedProblem } from '../../content/problemBank'
import { useI18n } from '../../i18n'
import { SolverClient } from '../../solver/client'
import { ExerciseView } from '../exercises/ExerciseView'
import { useSolvableExercise } from '../exercises/useSolvableExercise'
import { useSettings } from '../settings'

interface LessonPracticeProps {
  concept: Concept
  onPracticeMore: () => void
}

/** "Problema guiado" embebido en una leccion: un problema real del banco (mismo mecanismo que Ejercicios), no un ejercicio inventado a mano. */
export function LessonPractice({ concept, onPracticeMore }: LessonPracticeProps) {
  const { t } = useI18n()
  const { theme } = useSettings()
  const entries = useMemo(() => listBankEntries(concept.id), [concept.id])
  const [entry] = useState<BankEntry | null>(() => (entries.length > 0 ? entries[0] : null))
  const [loaded, setLoaded] = useState<LoadedProblem | null>(null)

  const [solverClient, setSolverClient] = useState<SolverClient | null>(null)
  useEffect(() => {
    const client = new SolverClient()
    setSolverClient(client)
    return () => client.terminate()
  }, [])

  useEffect(() => {
    setLoaded(entry ? loadEntry(entry) : null)
  }, [entry])

  const { game, lastMove, status, thinking, solutionMoves, handleIntersectionClick, handlePass } = useSolvableExercise(
    entry,
    loaded,
    solverClient,
  )

  return (
    <section className="lesson-practice">
      <h3>{t('learn.practice.title')}</h3>
      {!loaded || !game ? (
        <p className="lesson-practice-empty">{t('learn.practice.none')}</p>
      ) : (
        <ExerciseView
          loaded={loaded}
          game={game}
          lastMove={lastMove}
          status={status}
          thinking={thinking}
          solutionMoves={solutionMoves}
          theme={theme}
          onIntersectionClick={handleIntersectionClick}
          onPass={handlePass}
        />
      )}
      <button type="button" onClick={onPracticeMore}>
        {t('learn.practice.more')}
      </button>
    </section>
  )
}
