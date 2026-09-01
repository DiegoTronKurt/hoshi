import { useEffect, useMemo, useState } from 'react'
import { listBankEntries, loadEntry } from '../../content/problemBank'
import type { BankEntry, LoadedProblem } from '../../content/problemBank'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { computeProfiles, currentLevel } from '../../learning/profile'
import { computeStreak } from '../../learning/streak'
import { DEFAULT_SESSION_MINUTES, planSession } from '../../training-policy/session'
import type { SessionItem, SessionPlan, SessionReason } from '../../training-policy/session'
import { SolverClient } from '../../solver/client'
import { listAttempts, listGames, listSrsCards } from '../../storage/db'
import type { AttemptRecord, SavedGameRecord, SrsCardRecord } from '../../storage/db'
import { ExerciseView } from '../exercises/ExerciseView'
import { useSolvableExercise } from '../exercises/useSolvableExercise'
import { StreakIcon } from '../icons/StreakIcon'
import { STRENGTH_LEVELS } from '../play/strengthLevels'
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

const NORMAL_STRENGTH = STRENGTH_LEVELS.find((l) => l.id === 'normal') ?? STRENGTH_LEVELS[0]

function focusReasonKey(item: SessionItem): TranslationKey {
  if (item.reason === 'overdue') {
    return (item.reasonDetail?.overdueDays ?? 0) > 0 ? 'today.focus.reason.overdueDays' : 'today.focus.reason.overdueToday'
  }
  if (item.reason === 'weak') return 'today.focus.reason.weak'
  return 'today.focus.reason.new'
}

interface TodayScreenProps {
  onNavigateToPlay: () => void
}

export function TodayScreen({ onNavigateToPlay }: TodayScreenProps) {
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

  const plan: SessionPlan | null = useMemo(() => {
    if (!loaded) return null
    return planSession(entries, srsCards, profiles, new Date(), DEFAULT_SESSION_MINUTES)
  }, [loaded, profiles, srsCards, entries])

  const [sessionStarted, setSessionStarted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [solvedCount, setSolvedCount] = useState(0)

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

  const { game, lastMove, status, thinking, solutionMoves, handleIntersectionClick, giveUp } = useSolvableExercise(
    currentEntry,
    loadedProblem,
    solverClient,
  )

  function handleStart() {
    setSessionStarted(true)
    setCurrentIndex(0)
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
    return (
      <div className="today">
        <div className="today-header">
          <p className="today-level">{t(LEVEL_TITLE_KEY[level])}</p>
          {streakEnabled && streak.current > 0 && (
            <p className="today-streak">
              <StreakIcon className="today-streak-icon" />
              {t('today.streak.days', { n: streak.current })}
            </p>
          )}
          <h2>{t('today.title')}</h2>
        </div>

        <p className="today-daily-goal">{t('today.dailyGoal', { n: dailyGoal })}</p>

        {focus && (
          <section className="today-focus-card">
            <span className={`today-reason today-reason-${focus.reason}`}>{t(REASON_KEY[focus.reason])}</span>
            <p className="today-focus-concept">{t(`concept.${focus.entry.conceptId}.label` as TranslationKey)}</p>
            <p className="today-focus-why">
              {t(focusReasonKey(focus), {
                days: focus.reasonDetail?.overdueDays ?? 0,
                score: Math.round(focus.reasonDetail?.conceptScore ?? 0),
              })}
            </p>
          </section>
        )}

        <p className="today-plan-count">{t('today.planOverview.count', { n: plan.items.length })}</p>
        {rest.length > 0 && (
          <ul className="today-plan-list">
            {rest.map((item, index) => (
              <li key={`${item.entry.id}-${index}`}>
                <span className={`today-reason today-reason-${item.reason}`}>{t(REASON_KEY[item.reason])}</span>
                {t(`concept.${item.entry.conceptId}.label` as TranslationKey)}
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={handleStart}>
          {t('today.start')}
        </button>
        <button type="button" className="today-play-bot" onClick={onNavigateToPlay}>
          {t('today.playBot', { kyu: NORMAL_STRENGTH.approxKyu })}
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
        solutionMoves={solutionMoves}
        theme={theme}
        onIntersectionClick={handleIntersectionClick}
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
