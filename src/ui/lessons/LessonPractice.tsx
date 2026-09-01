import { useEffect, useMemo, useState } from 'react'
import type { Concept } from '../../analysis/concepts'
import { listBankEntries, loadProblem } from '../../content/problemBank'
import type { BankEntry } from '../../content/problemBank'
import type { Problem } from '../../content/problemSgf'
import { BLACK } from '../../core/types'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { SolverClient } from '../../solver/client'
import { useSolvableProblem } from '../exercises/useSolvableProblem'
import { BoardCanvas } from '../board/BoardCanvas'
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
  const [problem, setProblem] = useState<Problem | null>(null)

  const [solverClient, setSolverClient] = useState<SolverClient | null>(null)
  useEffect(() => {
    const client = new SolverClient()
    setSolverClient(client)
    return () => client.terminate()
  }, [])

  useEffect(() => {
    setProblem(entry ? loadProblem(entry) : null)
  }, [entry])

  const { game, lastMove, status, thinking, handleIntersectionClick } = useSolvableProblem(entry, problem, solverClient)

  return (
    <section className="lesson-practice">
      <h3>{t('learn.practice.title')}</h3>
      {!problem || !game ? (
        <p className="lesson-practice-empty">{t('learn.practice.none')}</p>
      ) : (
        <>
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
          <p className="lesson-practice-meta">
            {t('exercises.toMove')} {t(problem.toMove === BLACK ? 'color.black' : 'color.white' as TranslationKey)}
          </p>
        </>
      )}
      <button type="button" onClick={onPracticeMore}>
        {t('learn.practice.more')}
      </button>
    </section>
  )
}
