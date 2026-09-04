import { useMemo, useState } from 'react'
import type { ConceptId } from '../../analysis/concepts'
import { getLesson, lessonsForLevel } from '../../content/lessons'
import type { Lesson } from '../../content/lessons'
import { createBoard, toPoint } from '../../core/board'
import { BLACK, WHITE } from '../../core/types'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { BoardCanvas } from '../board/BoardCanvas'
import { minimoTheme } from '../board/themes'
import { LockIcon } from '../common/LockIcon'
import type { PlaySeed } from '../play/playConfig'
import { AboutGoScreen } from './AboutGoScreen'
import { LessonScreen } from './LessonScreen'
import { isLessonRead } from './readProgress'

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
const LEVEL_TITLE_KEY: Record<(typeof LEVELS)[number], TranslationKey> = {
  0: 'learn.level.0',
  1: 'learn.level.1',
  2: 'learn.level.2',
  3: 'learn.level.3',
  4: 'learn.level.4',
  5: 'learn.level.5',
  6: 'learn.level.6',
  7: 'learn.level.7',
  8: 'learn.level.8',
  9: 'learn.level.9',
  10: 'learn.level.10',
}

/**
 * Ya no quedan niveles bloqueados por falta de contenido: los 11 niveles
 * (0 a 10) del curriculo maestro estan completos (Nivel 9 y 10
 * desbloqueados 2026-09-04, ver LEVELS mas arriba). Se deja el array
 * vacio en vez de eliminar todo el mecanismo -- mismo principio que
 * LOCKED_BOARD_SIZES en play/PlayConfigScreen.tsx, que sigue existiendo
 * por si hace falta bloquear contenido futuro otra vez.
 */
const LOCKED_LEVELS: ReadonlyArray<{ level: number; titleKey: TranslationKey; boardSize: string }> = []

interface LearnScreenProps {
  /** Leccion preseleccionada al entrar (p.ej. desde el aviso de reapertura
   * de Hoy) -- mismo patron que initialConcept en ExercisesScreen. */
  initialLessonId?: string
  onNavigateToExercises: (conceptId: ConceptId) => void
  onNavigateToPlay: (seed?: PlaySeed) => void
}

type View =
  | { kind: 'levels' }
  | { kind: 'lessonList'; level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 }
  | { kind: 'lesson'; lessonId: string }
  | { kind: 'about' }

function fallbackPreview() {
  const size = 5
  const board = createBoard(size)
  board.stones[toPoint(size, 1, 1)] = BLACK
  board.stones[toPoint(size, 2, 3)] = WHITE
  return { width: size, height: size, stones: board.stones }
}

const FALLBACK_PREVIEW = fallbackPreview()

/** Mini-preview de una leccion: usa el tablero inicial de su demo si tiene
 * una, si no el primer diagrama de sus bloques, y como ultimo recurso un
 * tablero generico -- nunca inventa una posicion nueva. */
function lessonPreview(lesson: Lesson): { width: number; height: number; stones: Int8Array } {
  if (lesson.demo) return { width: lesson.demo.width, height: lesson.demo.height, stones: lesson.demo.initialStones }
  const diagram = lesson.blocks.find((b) => b.kind === 'diagram')
  if (diagram && diagram.kind === 'diagram') return { width: diagram.width, height: diagram.height, stones: diagram.stones }
  return FALLBACK_PREVIEW
}

export function LearnScreen({ initialLessonId, onNavigateToExercises, onNavigateToPlay }: LearnScreenProps) {
  const { t } = useI18n()
  const [view, setView] = useState<View>(() =>
    initialLessonId ? { kind: 'lesson', lessonId: initialLessonId } : { kind: 'levels' },
  )

  const lessonsByLevel = useMemo(
    () => Object.fromEntries(LEVELS.map((level) => [level, lessonsForLevel(level)])) as Record<number, ReturnType<typeof lessonsForLevel>>,
    [],
  )

  const overallProgress = useMemo(() => {
    let total = 0
    let read = 0
    for (const level of LEVELS) {
      for (const lesson of lessonsByLevel[level]) {
        total++
        if (isLessonRead(lesson.id)) read++
      }
    }
    return { total, read }
  }, [lessonsByLevel])

  if (view.kind === 'about') {
    return <AboutGoScreen onBack={() => setView({ kind: 'levels' })} />
  }

  if (view.kind === 'lesson') {
    const lesson = getLesson(view.lessonId)
    if (!lesson) {
      setView({ kind: 'levels' })
      return null
    }
    return (
      <LessonScreen
        lesson={lesson}
        onBack={() => setView({ kind: 'lessonList', level: lesson.level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 })}
        onNavigateToExercises={onNavigateToExercises}
        onNavigateToPlay={onNavigateToPlay}
      />
    )
  }

  if (view.kind === 'lessonList') {
    const lessons = lessonsByLevel[view.level]
    const currentLesson = lessons.find((lesson) => !isLessonRead(lesson.id)) ?? null
    const restLessons = currentLesson ? lessons.filter((lesson) => lesson.id !== currentLesson.id) : lessons
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
          <>
            {currentLesson && (
              <section className="learn-current-lesson">
                <span className="learn-current-lesson-label">{t('learn.current')}</span>
                <h3 className="learn-current-lesson-title">{t(currentLesson.titleKey)}</h3>
                <span className="learn-current-lesson-preview">
                  <BoardCanvas
                    width={lessonPreview(currentLesson).width}
                    height={lessonPreview(currentLesson).height}
                    stones={lessonPreview(currentLesson).stones}
                    lastMove={null}
                    theme={minimoTheme}
                    onIntersectionClick={() => {}}
                  />
                </span>
                <div className="learn-current-lesson-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setView({ kind: 'lesson', lessonId: currentLesson.id })}
                  >
                    {t('learn.continue')}
                  </button>
                  <button type="button" onClick={() => setView({ kind: 'lesson', lessonId: currentLesson.id })}>
                    {t('learn.viewLesson')}
                  </button>
                </div>
              </section>
            )}
            {restLessons.length > 0 && (
              <ul className="learn-lesson-list">
                {restLessons.map((lesson) => (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      className="learn-lesson-card"
                      onClick={() => setView({ kind: 'lesson', lessonId: lesson.id })}
                    >
                      <span>{t(lesson.titleKey)}</span>
                      {isLessonRead(lesson.id) && <span className="learn-read-badge">{t('learn.read')}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="learn">
      <h2>{t('learn.title')}</h2>
      <button type="button" className="learn-about-cta" onClick={() => setView({ kind: 'about' })}>
        {t('about.cta')}
      </button>
      {overallProgress.total > 0 && (
        <div className="learn-progress-overall">
          <p className="learn-progress-label">
            {t('learn.progressOverall', { read: overallProgress.read, total: overallProgress.total })}
          </p>
          <div className="learn-progress-track">
            <div
              className="learn-progress-fill"
              style={{ width: `${Math.round((overallProgress.read / overallProgress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}
      <ul className="learn-level-list">
        {LEVELS.map((level) => {
          const lessons = lessonsByLevel[level]
          const readCount = lessons.filter((lesson) => isLessonRead(lesson.id)).length
          const complete = lessons.length > 0 && readCount === lessons.length
          return (
            <li key={level}>
              <button type="button" className="learn-level-card" onClick={() => setView({ kind: 'lessonList', level })}>
                <span className="learn-level-badge">{complete ? '✓' : level}</span>
                <span className="learn-level-info">
                  <span>{t(LEVEL_TITLE_KEY[level])}</span>
                  <span className="learn-level-meta">
                    {t('learn.lessonsCount', { read: readCount, total: lessons.length })}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
        {LOCKED_LEVELS.map((info) => (
          <li key={info.level}>
            <div className="learn-level-card learn-level-card-locked" aria-disabled="true">
              <span className="learn-level-badge learn-level-badge-locked">
                <LockIcon />
              </span>
              <span className="learn-level-info">
                <span>{t(info.titleKey)}</span>
                <span className="learn-level-meta">
                  {info.boardSize} · {t('learn.locked')}
                </span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
