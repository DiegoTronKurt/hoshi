import { useEffect, useMemo, useState } from 'react'
import { listBankEntries, loadProblem } from '../../content/problemBank'
import type { BankEntry } from '../../content/problemBank'
import type { Problem } from '../../content/problemSgf'
import { BLACK } from '../../core/types'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { computeProfiles } from '../../learning/profile'
import { DEFAULT_SESSION_MINUTES, planSession } from '../../training-policy/session'
import type { SessionPlan, SessionReason } from '../../training-policy/session'
import { SolverClient } from '../../solver/client'
import { listAttempts, listGames, listSrsCards } from '../../storage/db'
import type { AttemptRecord, SavedGameRecord, SrsCardRecord } from '../../storage/db'
import { BoardCanvas } from '../board/BoardCanvas'
import { useSolvableProblem } from '../exercises/useSolvableProblem'
import { useSettings } from '../settings'

const REASON_KEY: Record<SessionReason, TranslationKey> = {
  overdue: 'today.reason.overdue',
  weak: 'today.reason.weak',
  new: 'today.reason.new',
}

export function TodayScreen() {
  const { t } = useI18n()
  const { theme } = useSettings()
  const [attempts, setAttempts] = useState<AttemptRecord[]>([])
  const [games, setGames] = useState<SavedGameRecord[]>([])
  const [srsCards, setSrsCards] = useState<SrsCardRecord[]>([])
  const [entries] = useState<BankEntry[]>(() => listBankEntries())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([listAttempts(), listGames(), listSrsCards()])
      .then(([a, g, s]) => {
        setAttempts(a)
        setGames(g)
        setSrsCards(s)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const plan: SessionPlan | null = useMemo(() => {
    if (!loaded) return null
    const profiles = computeProfiles(attempts, games)
    return planSession(entries, srsCards, profiles, new Date(), DEFAULT_SESSION_MINUTES)
  }, [loaded, attempts, games, srsCards, entries])

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

  const [problem, setProblem] = useState<Problem | null>(null)
  useEffect(() => {
    setProblem(currentEntry ? loadProblem(currentEntry) : null)
  }, [currentEntry])

  const { game, lastMove, status, thinking, solutionMoves, handleIntersectionClick, giveUp } = useSolvableProblem(
    currentEntry,
    problem,
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
    return (
      <div className="today">
        <h2>{t('today.title')}</h2>
        <p className="today-plan-count">{t('today.planOverview.count', { n: plan.items.length })}</p>
        <ul className="today-plan-list">
          {plan.items.map((item, index) => (
            <li key={`${item.entry.id}-${index}`}>
              <span className={`today-reason today-reason-${item.reason}`}>{t(REASON_KEY[item.reason])}</span>
              {t(`concept.${item.entry.conceptId}.label` as TranslationKey)}
            </li>
          ))}
        </ul>
        <button type="button" onClick={handleStart}>
          {t('today.start')}
        </button>
      </div>
    )
  }

  if (!currentItem || !problem || !game) {
    return (
      <div className="today">
        <h2>{t('today.complete.title')}</h2>
        <p>{t('today.complete.summary', { solved: solvedCount, total: plan.items.length })}</p>
      </div>
    )
  }

  const userColor = problem.toMove
  const objectiveKey: TranslationKey = problem.objective === 'live' ? 'exercises.objective.live' : 'exercises.objective.kill'
  const toMoveKey: TranslationKey = userColor === BLACK ? 'color.black' : 'color.white'

  return (
    <div className="today">
      <p className="today-progress">
        {t('today.progress', { current: currentIndex + 1, total: plan.items.length })} ·{' '}
        <span className={`today-reason today-reason-${currentItem.reason}`}>{t(REASON_KEY[currentItem.reason])}</span>
      </p>

      <p className="exercises-meta">
        {t('exercises.concept')}: {t(`concept.${problem.conceptId}.label` as TranslationKey)} · {t('exercises.toMove')}{' '}
        {t(toMoveKey)} · {t(objectiveKey)}
        {solutionMoves !== null && (
          <> · {solutionMoves === 1 ? t('exercises.solvesInOne') : t('exercises.solvesInMany', { count: solutionMoves })}</>
        )}
      </p>

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
