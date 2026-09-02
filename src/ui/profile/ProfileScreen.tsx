import { useEffect, useMemo, useState } from 'react'
import { conceptsWithEvidence } from '../../analysis/concepts'
import { AXIS_LABEL_KEY, computeAxisScores } from '../../analysis/axes'
import { getFirstOpenAt } from '../../learning/firstOpen'
import { bucketFirstWin, computeFirstWin } from '../../learning/firstWin'
import { computeKnowledgeApplicationInsights } from '../../learning/insights'
import { computeProfiles, weakestConcepts } from '../../learning/profile'
import type { ConceptProfile } from '../../learning/profile'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { listAttempts, listGames } from '../../storage/db'
import type { AttemptRecord, SavedGameRecord } from '../../storage/db'
import { SettingsScreen } from '../settings/SettingsScreen'
import { RadarChart } from './RadarChart'

const LEVELS = [0, 1, 2, 3] as const

function scoreClass(score: number): string {
  if (score >= 70) return 'profile-bar-good'
  if (score >= 40) return 'profile-bar-medium'
  return 'profile-bar-low'
}

export function ProfileScreen() {
  const { t } = useI18n()
  const [view, setView] = useState<'profile' | 'settings'>('profile')
  const [attempts, setAttempts] = useState<AttemptRecord[]>([])
  const [games, setGames] = useState<SavedGameRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    Promise.all([listAttempts(), listGames()])
      .then(([a, g]) => {
        setAttempts(a)
        setGames(g)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const profiles = useMemo(() => computeProfiles(attempts, games), [attempts, games])
  const weakest = useMemo(() => weakestConcepts(profiles, 5), [profiles])
  const concepts = useMemo(() => conceptsWithEvidence(), [])
  const axisScores = useMemo(() => computeAxisScores(profiles), [profiles])
  const insights = useMemo(() => computeKnowledgeApplicationInsights(profiles), [profiles])
  const firstWin = useMemo(() => computeFirstWin(games, getFirstOpenAt()), [games])
  const firstWinDisplay = firstWin.elapsedMs === null ? null : bucketFirstWin(firstWin.elapsedMs)

  if (!loaded) return null

  if (view === 'settings') {
    return <SettingsScreen onBack={() => setView('profile')} />
  }

  return (
    <div className="profile">
      <div className="profile-header">
        <h2>{t('profile.title')}</h2>
        <button type="button" onClick={() => setView('settings')}>
          {t('profile.settings')}
        </button>
      </div>

      <section className="profile-radar">
        <RadarChart
          axes={axisScores.map((a) => ({ id: a.axisId, label: t(AXIS_LABEL_KEY[a.axisId] as TranslationKey), score: a.score }))}
          noDataLabel={t('profile.noData')}
        />
      </section>

      {firstWinDisplay && (
        <section className="profile-first-win">
          <p>{t(`profile.firstWin.${firstWinDisplay.unit}` as TranslationKey, { n: firstWinDisplay.value })}</p>
        </section>
      )}

      {weakest.length > 0 && (
        <section className="profile-weakest">
          <h3>{t('profile.weakest')}</h3>
          <ul>
            {weakest.map((p) => (
              <li key={p.conceptId}>
                {t(`concept.${p.conceptId}.label` as TranslationKey)} · {Math.round(p.score)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {insights.length > 0 && (
        <section className="profile-insights">
          <h3>{t('profile.insight.title')}</h3>
          <ul>
            {insights.slice(0, 3).map((insight) => (
              <li key={insight.conceptId} className="profile-insight-row">
                <p className="profile-insight-stat">
                  {t('profile.insight.line', {
                    concept: t(`concept.${insight.conceptId}.label` as TranslationKey),
                    exercisePct: Math.round(insight.exercisePct),
                    gamePct: Math.round(insight.gamePct),
                  })}
                </p>
                <p className="profile-insight-detail">
                  {t(
                    insight.kind === 'knowsNotApplies'
                      ? 'profile.insight.knowsNotApplies'
                      : insight.kind === 'appliesBetterThanKnows'
                        ? 'profile.insight.appliesBetterThanKnows'
                        : 'profile.insight.consistent',
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button type="button" className="profile-detail-toggle" onClick={() => setShowDetail((v) => !v)}>
        {t(showDetail ? 'profile.detail.hide' : 'profile.detail.show')}
      </button>

      {showDetail &&
        LEVELS.map((level) => {
          const levelConcepts = concepts.filter((c) => c.level === level)
          if (levelConcepts.length === 0) return null
          return (
            <section key={level} className="profile-level">
              <h3>{t('profile.level', { n: level })}</h3>
              <ul className="profile-concept-list">
                {levelConcepts.map((concept) => {
                  const profile: ConceptProfile = profiles[concept.id]
                  return (
                    <li key={concept.id} className="profile-concept-row">
                      <span className="profile-concept-label">{t(concept.labelKey as TranslationKey)}</span>
                      {profile.score === null ? (
                        <span className="profile-no-data">{t('profile.noData')}</span>
                      ) : (
                        <div className="profile-bar-track" aria-label={`${Math.round(profile.score)}`}>
                          <div
                            className={`profile-bar-fill ${scoreClass(profile.score)}`}
                            style={{ width: `${Math.round(profile.score)}%` }}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
    </div>
  )
}
