import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import type { ConceptId } from './analysis/concepts'
import { useI18n } from './i18n'
import type { TranslationKey } from './i18n'
import { recordFirstOpenIfNeeded } from './learning/firstOpen'
import { ExercisesIcon, LearnIcon, PlayIcon, ProfileIcon, ReviewIcon, TodayIcon } from './ui/icons/NavIcons'
import { ExercisesScreen } from './ui/exercises/ExercisesScreen'
import { LearnScreen } from './ui/lessons/LearnScreen'
import { PlayScreen } from './ui/play/PlayScreen'
import { ProfileScreen } from './ui/profile/ProfileScreen'
import { ReviewScreen } from './ui/review/ReviewScreen'
import { useSettings } from './ui/settings'
import { TodayScreen } from './ui/today/TodayScreen'
import './App.css'

type Screen = 'today' | 'learn' | 'play' | 'exercises' | 'review' | 'profile'

const NAV_ITEMS: Array<{ id: Screen; labelKey: TranslationKey; Icon: ComponentType<{ className?: string }> }> = [
  { id: 'today', labelKey: 'nav.today', Icon: TodayIcon },
  { id: 'learn', labelKey: 'nav.learn', Icon: LearnIcon },
  { id: 'play', labelKey: 'nav.play', Icon: PlayIcon },
  { id: 'exercises', labelKey: 'nav.exercises', Icon: ExercisesIcon },
  { id: 'review', labelKey: 'nav.review', Icon: ReviewIcon },
  { id: 'profile', labelKey: 'nav.profile', Icon: ProfileIcon },
]

/** Esquema claro/oscuro efectivo del SO, usado solo cuando el tema de app es
 * "system" (los demas temas ya traen su propio `scheme` fijo). */
function useSystemScheme(): 'light' | 'dark' {
  const [scheme, setScheme] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent) => setScheme(event.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return scheme
}

function App() {
  const { language, setLanguage, t } = useI18n()
  const { appThemeId, appTheme } = useSettings()
  const systemScheme = useSystemScheme()
  const scheme = appThemeId === 'system' ? systemScheme : appTheme.scheme
  const [screen, setScreen] = useState<Screen>('today')
  const [exercisesConcept, setExercisesConcept] = useState<ConceptId | undefined>(undefined)

  useEffect(() => {
    recordFirstOpenIfNeeded()
  }, [])

  function goToExercises(conceptId?: ConceptId) {
    setExercisesConcept(conceptId)
    setScreen('exercises')
  }

  return (
    <div className="app" data-app-theme={appThemeId} data-scheme={scheme}>
      <header className="app-header">
        <h1>{t('app.title')}</h1>
        <p className="tagline">{t('app.tagline')}</p>
        <div className="language-switch" role="group" aria-label={t('language.label')}>
          {(['en', 'es'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              className={lang === language ? 'active' : ''}
              onClick={() => setLanguage(lang)}
            >
              {t(lang === 'en' ? 'language.en' : 'language.es')}
            </button>
          ))}
        </div>
      </header>

      <main className="app-main">
        {screen === 'today' && <TodayScreen onNavigateToPlay={() => setScreen('play')} />}
        {screen === 'learn' && (
          <LearnScreen
            onNavigateToExercises={(conceptId) => goToExercises(conceptId)}
            onNavigateToPlay={() => setScreen('play')}
          />
        )}
        {screen === 'play' && <PlayScreen />}
        {screen === 'exercises' && <ExercisesScreen initialConcept={exercisesConcept} />}
        {screen === 'review' && <ReviewScreen onPracticeConcept={goToExercises} />}
        {screen === 'profile' && <ProfileScreen />}
      </main>

      <nav className="bottom-nav" role="navigation" aria-label={t('nav.today')}>
        {NAV_ITEMS.map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            type="button"
            className={screen === id ? 'active' : ''}
            aria-current={screen === id ? 'page' : undefined}
            onClick={() => (id === 'exercises' ? goToExercises(undefined) : setScreen(id))}
          >
            <Icon />
            <span>{t(labelKey)}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
