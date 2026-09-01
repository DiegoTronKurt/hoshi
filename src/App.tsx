import { useState } from 'react'
import type { ConceptId } from './analysis/concepts'
import { useI18n } from './i18n'
import { ExercisesScreen } from './ui/exercises/ExercisesScreen'
import { LearnScreen } from './ui/lessons/LearnScreen'
import { PlayScreen } from './ui/play/PlayScreen'
import { ProfileScreen } from './ui/profile/ProfileScreen'
import { ReviewScreen } from './ui/review/ReviewScreen'
import { TodayScreen } from './ui/today/TodayScreen'
import './App.css'

type Screen = 'today' | 'learn' | 'play' | 'exercises' | 'review' | 'profile'

function App() {
  const { language, setLanguage, t } = useI18n()
  const [screen, setScreen] = useState<Screen>('today')
  const [exercisesConcept, setExercisesConcept] = useState<ConceptId | undefined>(undefined)

  function goToExercises(conceptId?: ConceptId) {
    setExercisesConcept(conceptId)
    setScreen('exercises')
  }

  return (
    <div className="app">
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
        <nav className="screen-nav" role="group" aria-label={t('nav.today')}>
          <button type="button" className={screen === 'today' ? 'active' : ''} onClick={() => setScreen('today')}>
            {t('nav.today')}
          </button>
          <button type="button" className={screen === 'learn' ? 'active' : ''} onClick={() => setScreen('learn')}>
            {t('nav.learn')}
          </button>
          <button type="button" className={screen === 'play' ? 'active' : ''} onClick={() => setScreen('play')}>
            {t('nav.play')}
          </button>
          <button
            type="button"
            className={screen === 'exercises' ? 'active' : ''}
            onClick={() => goToExercises(undefined)}
          >
            {t('nav.exercises')}
          </button>
          <button
            type="button"
            className={screen === 'review' ? 'active' : ''}
            onClick={() => setScreen('review')}
          >
            {t('nav.review')}
          </button>
          <button
            type="button"
            className={screen === 'profile' ? 'active' : ''}
            onClick={() => setScreen('profile')}
          >
            {t('nav.profile')}
          </button>
        </nav>
      </header>

      <main className="app-main">
        {screen === 'today' && <TodayScreen />}
        {screen === 'learn' && (
          <LearnScreen
            onNavigateToExercises={(conceptId) => goToExercises(conceptId)}
            onNavigateToPlay={() => setScreen('play')}
          />
        )}
        {screen === 'play' && <PlayScreen />}
        {screen === 'exercises' && <ExercisesScreen initialConcept={exercisesConcept} />}
        {screen === 'review' && <ReviewScreen />}
        {screen === 'profile' && <ProfileScreen />}
      </main>
    </div>
  )
}

export default App
