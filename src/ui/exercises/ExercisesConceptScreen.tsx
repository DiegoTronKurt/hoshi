import { useMemo } from 'react'
import { conceptsThatGenerateExercises } from '../../analysis/concepts'
import type { ConceptId } from '../../analysis/concepts'
import { createBoard, toPoint } from '../../core/board'
import { BLACK, WHITE } from '../../core/types'
import { listBankEntries } from '../../content/problemBank'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { BoardCanvas } from '../board/BoardCanvas'
import { minimoTheme } from '../board/themes'

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

interface ExercisesConceptScreenProps {
  onPickConcept: (id: ConceptId | 'all') => void
}

/** Pantalla A de Ejercicios: elegir un concepto (o "todos"). Mismo patron de
 * dos pantallas que ya usan Aprender/Jugar/Revisar -- esta no sabe nada de
 * resolver un problema, solo de elegir por cual empezar. */
export function ExercisesConceptScreen({ onPickConcept }: ExercisesConceptScreenProps) {
  const { t } = useI18n()
  const concepts = useMemo(() => conceptsThatGenerateExercises(), [])

  return (
    <div className="exercises">
      <h2>{t('exercises.title')}</h2>
      <div className="exercises-concept-grid">
        <button type="button" className="exercises-concept-card" onClick={() => onPickConcept('all')}>
          <span className="exercises-concept-label">{t('exercises.allConcepts')}</span>
          <span className="exercises-concept-meta">
            {t('exercises.allProblemCount', { n: listBankEntries().length, categories: concepts.length })}
          </span>
        </button>
        {concepts.map((concept) => {
          const count = listBankEntries(concept.id).length
          return (
            <button
              type="button"
              key={concept.id}
              className="exercises-concept-card"
              onClick={() => onPickConcept(concept.id)}
              disabled={count === 0}
            >
              <span className="exercises-concept-preview">
                <BoardCanvas
                  width={ABSTRACT_PREVIEW.size}
                  height={ABSTRACT_PREVIEW.size}
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
