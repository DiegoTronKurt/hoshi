import { useEffect, useMemo, useState } from 'react'
import { conceptsThatGenerateExercises } from '../../analysis/concepts'
import type { ConceptId } from '../../analysis/concepts'
import { createBoard, toPoint } from '../../core/board'
import { BLACK, WHITE } from '../../core/types'
import { listBankEntries, loadEntry } from '../../content/problemBank'
import type { BankEntry, LoadedProblem } from '../../content/problemBank'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { SolverClient } from '../../solver/client'
import { BoardCanvas } from '../board/BoardCanvas'
import { minimoTheme } from '../board/themes'
import { useSettings } from '../settings'
import { ExerciseView } from './ExerciseView'
import { useSolvableExercise } from './useSolvableExercise'

function pickEntry(entries: BankEntry[], excludeId?: string): BankEntry | null {
  const pool = entries.length > 1 ? entries.filter((e) => e.id !== excludeId) : entries
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Diagrama abstracto y fijo, no una posicion real del concepto: mismo
 * patron que buildPreviewBoard() en SettingsScreen, solo para dar textura
 * visual a la tarjeta, no para ensenar nada. */
function buildAbstractPreview() {
  const size = 5
  const board = createBoard(size)
  board.stones[toPoint(size, 1, 1)] = BLACK
  board.stones[toPoint(size, 3, 1)] = WHITE
  board.stones[toPoint(size, 2, 3)] = BLACK
  return { size, stones: board.stones }
}

const ABSTRACT_PREVIEW = buildAbstractPreview()

interface ExercisesScreenProps {
  /** Concepto preseleccionado al entrar (p.ej. desde el enlace "practicar mas" de una leccion, o "practicar este concepto" desde Revisar). */
  initialConcept?: ConceptId
}

type View = { kind: 'grid' } | { kind: 'exercise' }

export function ExercisesScreen({ initialConcept }: ExercisesScreenProps = {}) {
  const { t } = useI18n()
  const { theme } = useSettings()
  const concepts = useMemo(() => conceptsThatGenerateExercises(), [])

  const [view, setView] = useState<View>(initialConcept ? { kind: 'exercise' } : { kind: 'grid' })
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

  function pickConcept(id: ConceptId | 'all') {
    setConceptFilter(id)
    setView({ kind: 'exercise' })
  }

  if (view.kind === 'grid') {
    return (
      <div className="exercises">
        <h2>{t('exercises.title')}</h2>
        <div className="exercises-concept-grid">
          <button type="button" className="exercises-concept-card" onClick={() => pickConcept('all')}>
            <span className="exercises-concept-label">{t('exercises.allConcepts')}</span>
            <span className="exercises-concept-meta">{t('exercises.problemCount', { n: listBankEntries().length })}</span>
          </button>
          {concepts.map((concept) => {
            const count = listBankEntries(concept.id).length
            return (
              <button
                type="button"
                key={concept.id}
                className="exercises-concept-card"
                onClick={() => pickConcept(concept.id)}
                disabled={count === 0}
              >
                <span className="exercises-concept-preview">
                  <BoardCanvas
                    size={ABSTRACT_PREVIEW.size}
                    stones={ABSTRACT_PREVIEW.stones}
                    lastMove={null}
                    theme={minimoTheme}
                    onIntersectionClick={() => {}}
                  />
                </span>
                <span className="exercises-concept-label">{t(concept.labelKey as TranslationKey)}</span>
                <span className="exercises-concept-meta">
                  {t('learn.level', { n: concept.level })} · {t('exercises.problemCount', { n: count })}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="exercises">
      <div className="exercises-controls">
        <button type="button" onClick={() => setView({ kind: 'grid' })}>
          {t('exercises.backToConcepts')}
        </button>
        <button type="button" onClick={reset}>
          {t('exercises.reset')}
        </button>
        <button type="button" onClick={handleNext}>
          {t('exercises.next')}
        </button>
      </div>

      {entries.length === 0 || !loaded || !game ? (
        <div className="exercises-empty">
          <p>{t('exercises.noProblems')}</p>
        </div>
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
        />
      )}
    </div>
  )
}
