import { useState } from 'react'
import { useI18n } from './i18n'
import { ExercisesScreen } from './ui/exercises/ExercisesScreen'
import { PlayScreen } from './ui/play/PlayScreen'
import { ProfileScreen } from './ui/profile/ProfileScreen'
import { ReviewScreen } from './ui/review/ReviewScreen'
import { TodayScreen } from './ui/today/TodayScreen'
import './App.css'

type Screen = 'today' | 'play' | 'exercises' | 'review' | 'profile'

function App() {
  const { language, setLanguage, t } = useI18n()
  const [screen, setScreen] = useState<Screen>('today')

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
          <button type="button" className={screen === 'play' ? 'active' : ''} onClick={() => setScreen('play')}>
            {t('nav.play')}
          </button>
          <button
            type="button"
            className={screen === 'exercises' ? 'active' : ''}
            onClick={() => setScreen('exercises')}
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
        {screen === 'play' && <PlayScreen />}
        {screen === 'exercises' && <ExercisesScreen />}
        {screen === 'review' && <ReviewScreen />}
        {screen === 'profile' && <ProfileScreen />}
      </main>
    </div>
  )
}

export default App
