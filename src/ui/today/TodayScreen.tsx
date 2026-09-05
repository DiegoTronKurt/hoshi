import { useEffect, useMemo, useState } from 'react'
import type { ConceptId } from '../../analysis/concepts'
import { listBankEntries, loadEntry } from '../../content/problemBank'
import type { BankEntry, LoadedProblem } from '../../content/problemBank'
import { getLesson, lessonsForLevel } from '../../content/lessons'
import type { Lesson } from '../../content/lessons'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { countCompletedToday } from '../../learning/dailyProgress'
import { computeKnowledgeApplicationInsights } from '../../learning/insights'
import { computeProfiles, currentLevel } from '../../learning/profile'
import { computeStreak } from '../../learning/streak'
import { minutesForGoal, planSession } from '../../training-policy/session'
import type { SessionItem, SessionPlan, SessionReason } from '../../training-policy/session'
import { SolverClient } from '../../solver/client'
import { listAttempts, listGames, listSrsCards } from '../../storage/db'
import type { AttemptRecord, SavedGameRecord, SrsCardRecord } from '../../storage/db'
import { BoardCanvas } from '../board/BoardCanvas'
import { ProgressRing } from '../common/ProgressRing'
import { ExerciseView } from '../exercises/ExerciseView'
import { useSolvableExercise } from '../exercises/useSolvableExercise'
import { StreakIcon } from '../icons/StreakIcon'
import { getReopenedLessons, isLessonRead } from '../lessons/readProgress'
import { useSettings } from '../settings'

const REASON_KEY: Record<SessionReason, TranslationKey> = {
  overdue: 'today.reason.overdue',
  weak: 'today.reason.weak',
  new: 'today.reason.new',
}

const LEVEL_TITLE_KEY: Record<0 | 1 | 2 | 3, TranslationKey> = {
  0: 'learn.level.0',
  1: 'learn.level.1',
  2: 'learn.level.2',
  3: 'learn.level.3',
}

function focusReasonKey(item: SessionItem): TranslationKey {
  if (item.reason === 'overdue') {
    return (item.reasonDetail?.overdueDays ?? 0) > 0 ? 'today.focus.reason.overdueDays' : 'today.focus.reason.overdueToday'
  }
  if (item.reason === 'weak') return 'today.focus.reason.weak'
  return 'today.focus.reason.new'
}

interface TodayScreenProps {
  onNavigateToPlay: () => void
  onNavigateToLearn: (lessonId?: string) => void
}

export function TodayScreen({ onNavigateToPlay, onNavigateToLearn }: TodayScreenProps) {
  const { t } = useI18n()
  const { theme, dailyGoal, streakEnabled } = useSettings()
  const [attempts, setAttempts] = useState<AttemptRecord[]>([])
  const [games, setGames] = useState<SavedGameRecord[]>([])
  const [srsCards, setSrsCards] = useState<SrsCardRecord[]>([])
  const [entries] = useState<BankEntry[]>(() => listBankEntries())
  const [loaded, setLoadedState] = useState(false)

  useEffect(() => {
    Promise.all([listAttempts(), listGames(), listSrsCards()])
      .then(([a, g, s]) => {
        setAttempts(a)
        setGames(g)
        setSrsCards(s)
        setLoadedState(true)
      })
      .catch(() => setLoadedState(true))
  }, [])

  const profiles = useMemo(() => computeProfiles(attempts, games), [attempts, games])
  const level = useMemo(() => currentLevel(profiles), [profiles])
  const streak = useMemo(() => computeStreak(attempts, games), [attempts, games])
  const completedToday = useMemo(() => countCompletedToday(attempts), [attempts])

  const levelProgress = useMemo(() => {
    const lessons = lessonsForLevel(level)
    const read = lessons.filter((lesson) => isLessonRead(lesson.id)).length
    return { read, total: lessons.length }
  }, [level])

  // Insight de conocimiento vs. aplicacion (ya existe en Perfil): en Hoy solo
  // se muestra el de mayor brecha, y solo cuando es del tipo "sabes pero
  // todavia no lo aplicas en partidas" -- el mismo caso de ejemplo del
  // documento de pantallas. Sin eso, no se fuerza ningun insight generico.
  const topInsight = useMemo(() => {
    const insights = computeKnowledgeApplicationInsights(profiles)
    return insights.find((insight) => insight.kind === 'knowsNotApplies') ?? null
  }, [profiles])

  // Lecciones reabiertas por 3+ errores del mismo concepto en las ultimas 5
  // partidas (training-policy/session.ts::findConceptsToReopen, disparado
  // en PlayGameScreen.tsx al guardar cada partida). Se lee una sola vez por
  // montaje, mismo criterio que entries mas abajo: si el usuario juega una
  // partida nueva y vuelve a Hoy, esta pantalla se desmonta y remonta con
  // la pestana (ver App.tsx), asi que no hace falta releer en caliente.
  const reopenedLessons = useMemo(() => {
    const result: Array<{ lesson: Lesson; conceptId: ConceptId }> = []
    for (const { lessonId, conceptId } of getReopenedLessons()) {
      const lesson = getLesson(lessonId)
      if (lesson) result.push({ lesson, conceptId })
    }
    return result
  }, [])

  const plan: SessionPlan | null = useMemo(() => {
    if (!loaded) return null
    return planSession(entries, srsCards, profiles, new Date(), minutesForGoal(dailyGoal))
  }, [loaded, profiles, srsCards, entries, dailyGoal])

  const [sessionStarted, setSessionStarted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [solvedCount, setSolvedCount] = useState(0)
  const [planExpanded, setPlanExpanded] = useState(false)
  const [reopenExpanded, setReopenExpanded] = useState(false)

  const [solverClient, setSolverClient] = useState<SolverClient | null>(null)
  useEffect(() => {
    const client = new SolverClient()
    setSolverClient(client)
    return () => client.terminate()
  }, [])

  const currentItem = sessionStarted && plan ? (plan.items[currentIndex] ?? null) : null
  const currentEntry = currentItem?.entry ?? null

  const [loadedProblem, setLoadedProblem] = useState<LoadedProblem | null>(null)
  useEffect(() => {
    setLoadedProblem(currentEntry ? loadEntry(currentEntry) : null)
  }, [currentEntry])

  const { game, lastMove, status, thinking, solverError, solutionMoves, handleIntersectionClick, handlePass, giveUp } =
    useSolvableExercise(
    currentEntry,
    loadedProblem,
    solverClient,
  )

  function handleStart(index = 0) {
    setSessionStarted(true)
    setCurrentIndex(index)
    setSolvedCount(0)
  }

  function handleNextItem() {
    if (status === 'solved') setSolvedCount((n) => n + 1)
    setCurrentIndex((i) => i + 1)
  }

  function handleSkip() {
    giveUp()
    setCurrentIndex((i) => i + 1)
  }

  if (!loaded || !plan) return null

  if (entries.length === 0) {
    return (
      <div className="today-empty">
        <p>{t('today.empty')}</p>
      </div>
    )
  }

  if (!sessionStarted) {
    const focus = plan.items[0] ?? null
    const rest = plan.items.slice(1)
    const focusPreview = focus ? loadEntry(focus.entry).problem.board : null
    return (
      <div className="today">
        <div className="today-header">
          <div className="today-header-text">
            <p className="today-level">{t(LEVEL_TITLE_KEY[level])}</p>
            <h2>{t('today.title')}</h2>
          </div>
          {levelProgress.total > 0 && (
            <ProgressRing
              percent={(levelProgress.read / levelProgress.total) * 100}
              label={t('today.levelProgress', { read: levelProgress.read, total: levelProgress.total })}
            />
          )}
        </div>

        {focus && (
          <section
            className="today-focus-card"
            role="button"
            tabIndex={0}
            onClick={() => handleStart(0)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleStart(0)
            }}
          >
            <div className="today-focus-text">
              <div className="today-focus-top">
                <span className={`today-plan-badge today-reason-${focus.reason}`}>1</span>
                <span className={`today-reason today-reason-${focus.reason}`}>{t(REASON_KEY[focus.reason])}</span>
              </div>
              <p className="today-focus-concept">{t(`concept.${focus.entry.conceptId}.label` as TranslationKey)}</p>
              <p className="today-focus-why">
                {t(focusReasonKey(focus), {
                  days: focus.reasonDetail?.overdueDays ?? 0,
                  score: Math.round(focus.reasonDetail?.conceptScore ?? 0),
                })}
              </p>
            </div>
            {focusPreview && (
              <div className="today-focus-diagram">
                <BoardCanvas
                  width={focusPreview.width}
                  height={focusPreview.height}
                  stones={focusPreview.stones}
                  lastMove={null}
                  theme={theme}
                  onIntersectionClick={() => {}}
                />
              </div>
            )}
          </section>
        )}

        <div className="today-stats-row">
          <div className="today-stat-tile">
            <span className="today-stat-value">{plan.items.length}</span>
            <span className="today-stat-label">{t('today.stat.exercises')}</span>
          </div>
          {streakEnabled && streak.current > 0 && (
            <div className="today-stat-tile">
              <StreakIcon className="today-stat-icon" />
              <span className="today-stat-value">{streak.current}</span>
              <span className="today-stat-label">{t('today.stat.streak')}</span>
            </div>
          )}
          <div className="today-stat-tile">
            <span className="today-stat-value">
              {completedToday}/{dailyGoal}
            </span>
            <span className="today-stat-label">{t('today.stat.goal')}</span>
          </div>
        </div>

        {rest.length > 0 && (
          <>
            <button
              type="button"
              className="today-plan-toggle"
              aria-expanded={planExpanded}
              onClick={() => setPlanExpanded((v) => !v)}
            >
              {planExpanded
                ? t('today.planOverview.collapse')
                : t('today.planOverview.expand', { count: rest.length })}
            </button>
            {planExpanded && (
              <ul className="today-plan-list">
                {rest.map((item, index) => (
                  <li key={`${item.entry.id}-${index}`}>
                    <button type="button" className="today-plan-item" onClick={() => handleStart(index + 1)}>
                      <span className={`today-plan-badge today-reason-${item.reason}`}>{index + 2}</span>
                      <span className="today-plan-info">
                        <span className="today-plan-concept">
                          {t(`concept.${item.entry.conceptId}.label` as TranslationKey)}
                        </span>
                        <span className={`today-reason today-reason-${item.reason}`}>{t(REASON_KEY[item.reason])}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {focus && focusPreview && (
          <section className="today-exercise-preview">
            <p className="today-exercise-preview-count">
              {t('today.exercisePreview.count', { current: 1, total: plan.items.length })}
            </p>
            <h3>{t(`concept.${focus.entry.conceptId}.label` as TranslationKey)}</h3>
            <BoardCanvas
              width={focusPreview.width}
              height={focusPreview.height}
              stones={focusPreview.stones}
              lastMove={null}
              theme={theme}
              onIntersectionClick={() => {}}
            />
            <button type="button" onClick={() => handleStart(0)}>
              {t('today.exercisePreview.start')}
            </button>
          </section>
        )}

        {!focus && plan.items.length > 0 && (
          <button type="button" onClick={() => handleStart(0)}>
            {t('today.start')}
          </button>
        )}

        {reopenedLessons.length === 1 && (
          <section className="today-reopen-card">
            <p className="today-reopen-detail">
              {t('today.reopen.detail', {
                concept: t(`concept.${reopenedLessons[0].conceptId}.label` as TranslationKey),
                lesson: t(reopenedLessons[0].lesson.titleKey),
              })}
            </p>
            <button
              type="button"
              className="today-reopen-cta"
              onClick={() => onNavigateToLearn(reopenedLessons[0].lesson.id)}
            >
              {t('today.reopen.cta')}
            </button>
          </section>
        )}

        {reopenedLessons.length > 1 && (
          <section className="today-reopen-card">
            <button
              type="button"
              className="today-reopen-toggle"
              aria-expanded={reopenExpanded}
              onClick={() => setReopenExpanded((v) => !v)}
            >
              {reopenExpanded
                ? t('today.reopen.collapse')
                : t('today.reopen.summary', { count: reopenedLessons.length })}
            </button>
            {reopenExpanded && (
              <ul className="today-reopen-list">
                {reopenedLessons.map(({ lesson, conceptId }) => (
                  <li key={lesson.id}>
                    <span className="today-reopen-lesson">
                      <span className="today-reopen-lesson-title">{t(lesson.titleKey)}</span>
                      <span className="today-reopen-lesson-concept">
                        {t(`concept.${conceptId}.label` as TranslationKey)}
                      </span>
                    </span>
                    <button type="button" onClick={() => onNavigateToLearn(lesson.id)}>
                      {t('today.reopen.cta')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {topInsight && (
          <section className="today-insight-card">
            <p className="today-insight-stat">
              {t('profile.insight.line', {
                concept: t(`concept.${topInsight.conceptId}.label` as TranslationKey),
                exercisePct: Math.round(topInsight.exercisePct),
                gamePct: Math.round(topInsight.gamePct),
              })}
            </p>
            <p className="today-insight-detail">{t('profile.insight.knowsNotApplies')}</p>
          </section>
        )}

        <button type="button" className="today-play-bot" onClick={onNavigateToPlay}>
          {t('today.playBot')}
        </button>
      </div>
    )
  }

  if (!currentItem || !loadedProblem || !game) {
    return (
      <div className="today">
        <h2>{t('today.complete.title')}</h2>
        <p>{t('today.complete.summary', { solved: solvedCount, total: plan.items.length })}</p>
      </div>
    )
  }

  return (
    <div className="today">
      <p className="today-progress">
        {t('today.progress', { current: currentIndex + 1, total: plan.items.length })} ·{' '}
        <span className={`today-reason today-reason-${currentItem.reason}`}>{t(REASON_KEY[currentItem.reason])}</span>
      </p>

      <ExerciseView
        loaded={loadedProblem}
        game={game}
        lastMove={lastMove}
        status={status}
        thinking={thinking}
        solverError={solverError}
        solutionMoves={solutionMoves}
        theme={theme}
        onIntersectionClick={handleIntersectionClick}
        onPass={handlePass}
      />

      <div className="today-controls">
        {status === 'solved' ? (
          <button type="button" onClick={handleNextItem}>
            {t('today.next')}
          </button>
        ) : (
          <button type="button" onClick={handleSkip}>
            {t('today.skip')}
          </button>
        )}
      </div>
    </div>
  )
}
