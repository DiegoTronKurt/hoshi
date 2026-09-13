import { useEffect } from 'react'
import { conceptsForLesson } from '../../analysis/concepts'
import type { ConceptId } from '../../analysis/concepts'
import type { Lesson } from '../../content/lessons'
import { nextLessonId } from '../../content/lessons'
import { useI18n } from '../../i18n'
import type { PlaySeed } from '../play/playConfig'
import { BoardCanvas } from '../board/BoardCanvas'
import { useSettings } from '../settings'
import { ComparePrompt } from './ComparePrompt'
import { GuidedDemo } from './GuidedDemo'
import { LessonPractice } from './LessonPractice'
import { markLessonRead } from './readProgress'

interface LessonScreenProps {
  lesson: Lesson
  onBack: () => void
  onNavigateToExercises: (conceptId: ConceptId) => void
  onNavigateToPlay: (seed?: PlaySeed) => void
  onNavigateToLesson: (lessonId: string) => void
}

export function LessonScreen({ lesson, onBack, onNavigateToExercises, onNavigateToPlay, onNavigateToLesson }: LessonScreenProps) {
  const { t } = useI18n()
  const { theme } = useSettings()
  const practiceConcepts = conceptsForLesson(lesson.id).filter((c) => c.generatesExercises)
  const nextId = nextLessonId(lesson.id)

  useEffect(() => {
    markLessonRead(lesson.id)
    // "Siguiente leccion" navega sin desmontar LessonScreen (mismo componente,
    // props nuevas) -- sin esto, si la persona llegaba al boton habiendo
    // scrolleado hasta el final de la leccion anterior, la siguiente aparecia
    // ya scrolleada al mismo punto en vez de arrancar arriba.
    window.scrollTo(0, 0)
  }, [lesson.id])

  return (
    <div className="lesson">
      <div className="lesson-header">
        <button type="button" onClick={onBack}>
          {t('learn.backToLevels')}
        </button>
        <h2>{t(lesson.titleKey)}</h2>
      </div>

      {lesson.proverbKey && <p className="lesson-proverb">{t(lesson.proverbKey)}</p>}

      <div className="lesson-body">
        {lesson.blocks.map((block, index) => {
          if (block.kind === 'paragraph') {
            return (
              <p key={index} className="lesson-paragraph">
                {t(block.textKey)}
              </p>
            )
          }
          if (block.kind === 'diagram') {
            return (
              <figure key={index} className="lesson-diagram">
                <BoardCanvas
                  width={block.width}
                  height={block.height}
                  stones={block.stones}
                  lastMove={block.highlightPoint ?? null}
                  theme={theme}
                  onIntersectionClick={() => {}}
                />
                <figcaption>{t(block.captionKey, block.captionParams)}</figcaption>
              </figure>
            )
          }
          return <ComparePrompt key={index} block={block} />
        })}
      </div>

      {lesson.demo && <GuidedDemo script={lesson.demo} />}

      {practiceConcepts.map((concept) => (
        <LessonPractice key={concept.id} concept={concept} onPracticeMore={() => onNavigateToExercises(concept.id)} />
      ))}

      {/* PlaySeed ya soporta ancho/alto por separado (ver playConfig.ts), asi
          que una demo rectangular (Nivel 4 en adelante, 9x13) arma un seed
          valido igual que una cuadrada -- ya no hace falta ocultar el boton
          para esas lecciones. */}
      <section className="lesson-checkgame">
        <h3>{t('learn.checkGame.title')}</h3>
        <button
          type="button"
          onClick={() =>
            onNavigateToPlay(
              lesson.demo
                ? { width: lesson.demo.width, height: lesson.demo.height, stones: lesson.demo.initialStones, toMove: lesson.demo.toMove }
                : undefined,
            )
          }
        >
          {t('learn.checkGame.cta')}
        </button>
      </section>

      {nextId && (
        <button type="button" className="lesson-next-button" onClick={() => onNavigateToLesson(nextId)}>
          {t('learn.nextLesson.cta')}
        </button>
      )}
    </div>
  )
}
