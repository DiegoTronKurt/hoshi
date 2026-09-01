import { useMemo, useState } from 'react'
import type { ConceptId } from '../../analysis/concepts'
import { getLesson, lessonsForLevel } from '../../content/lessons'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { LessonScreen } from './LessonScreen'
import { isLessonRead } from './readProgress'

const LEVELS = [0, 1, 2, 3] as const
const LEVEL_TITLE_KEY: Record<(typeof LEVELS)[number], TranslationKey> = {
  0: 'learn.level.0',
  1: 'learn.level.1',
  2: 'learn.level.2',
  3: 'learn.level.3',
}

interface LearnScreenProps {
  onNavigateToExercises: (conceptId: ConceptId) => void
  onNavigateToPlay: () => void
}

type View = { kind: 'levels' } | { kind: 'lessonList'; level: 0 | 1 | 2 | 3 } | { kind: 'lesson'; lessonId: string }

export function LearnScreen({ onNavigateToExercises, onNavigateToPlay }: LearnScreenProps) {
  const { t } = useI18n()
  const [view, setView] = useState<View>({ kind: 'levels' })

  const lessonsByLevel = useMemo(
    () => Object.fromEntries(LEVELS.map((level) => [level, lessonsForLevel(level)])) as Record<number, ReturnType<typeof lessonsForLevel>>,
    [],
  )

  if (view.kind === 'lesson') {
    const lesson = getLesson(view.lessonId)
    if (!lesson) {
      setView({ kind: 'levels' })
      return null
    }
    return (
      <LessonScreen
        lesson={lesson}
        onBack={() => setView({ kind: 'lessonList', level: lesson.level })}
        onNavigateToExercises={onNavigateToExercises}
        onNavigateToPlay={onNavigateToPlay}
      />
    )
  }

  if (view.kind === 'lessonList') {
    const lessons = lessonsByLevel[view.level]
    return (
      <div className="learn">
        <div className="lesson-header">
          <button type="button" onClick={() => setView({ kind: 'levels' })}>
            {t('learn.backToLevels')}
          </button>
          <h2>{t(LEVEL_TITLE_KEY[view.level])}</h2>
        </div>
        {lessons.length === 0 ? (
          <p className="learn-empty">{t('learn.noLessons')}</p>
        ) : (
          <ul className="learn-lesson-list">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <button type="button" onClick={() => setView({ kind: 'lesson', lessonId: lesson.id })}>
                  <span>{t(lesson.titleKey)}</span>
                  {isLessonRead(lesson.id) && <span className="learn-read-badge">{t('learn.read')}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="learn">
      <h2>{t('learn.title')}</h2>
      <ul className="learn-level-list">
        {LEVELS.map((level) => (
          <li key={level}>
            <button type="button" onClick={() => setView({ kind: 'lessonList', level })}>
              {t(LEVEL_TITLE_KEY[level])}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
