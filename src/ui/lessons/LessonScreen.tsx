import { useEffect } from 'react'
import { conceptsForLesson } from '../../analysis/concepts'
import type { ConceptId } from '../../analysis/concepts'
import type { Lesson } from '../../content/lessons'
import { useI18n } from '../../i18n'
import type { PlaySeed } from '../play/playConfig'
import { BoardCanvas } from '../board/BoardCanvas'
import { useSettings } from '../settings'
import { GuidedDemo } from './GuidedDemo'
import { LessonPractice } from './LessonPractice'
import { markLessonRead } from './readProgress'

interface LessonScreenProps {
  lesson: Lesson
  onBack: () => void
  onNavigateToExercises: (conceptId: ConceptId) => void
  onNavigateToPlay: (seed?: PlaySeed) => void
}

export function LessonScreen({ lesson, onBack, onNavigateToExercises, onNavigateToPlay }: LessonScreenProps) {
  const { t } = useI18n()
  const { theme } = useSettings()
  const practiceConcepts = conceptsForLesson(lesson.id).filter((c) => c.generatesExercises)

  useEffect(() => {
    markLessonRead(lesson.id)
  }, [lesson.id])

  return (
    <div className="lesson">
      <div className="lesson-header">
        <button type="button" onClick={onBack}>
          {t('learn.backToLevels')}
        </button>
        <h2>{t(lesson.titleKey)}</h2>
      </div>

      <div className="lesson-body">
        {lesson.blocks.map((block, index) =>
          block.kind === 'paragraph' ? (
            <p key={index} className="lesson-paragraph">
              {t(block.textKey)}
            </p>
          ) : (
            <figure key={index} className="lesson-diagram">
              <BoardCanvas
                size={block.size}
                stones={block.stones}
                lastMove={block.highlightPoint ?? null}
                theme={theme}
                onIntersectionClick={() => {}}
              />
              <figcaption>{t(block.captionKey, block.captionParams)}</figcaption>
            </figure>
          ),
        )}
      </div>

      {lesson.demo && <GuidedDemo script={lesson.demo} />}

      {practiceConcepts.map((concept) => (
        <LessonPractice key={concept.id} concept={concept} onPracticeMore={() => onNavigateToExercises(concept.id)} />
      ))}

      <section className="lesson-checkgame">
        <h3>{t('learn.checkGame.title')}</h3>
        <button
          type="button"
          onClick={() =>
            onNavigateToPlay(
              lesson.demo ? { size: lesson.demo.size, stones: lesson.demo.initialStones, toMove: lesson.demo.toMove } : undefined,
            )
          }
        >
          {t('learn.checkGame.cta')}
        </button>
      </section>
    </div>
  )
}
