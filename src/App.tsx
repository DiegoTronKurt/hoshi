import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import type { ConceptId } from './analysis/concepts'
import { useI18n } from './i18n'
import type { TranslationKey } from './i18n'
import { ExercisesIcon, LearnIcon, PlayIcon, ProfileIcon, ReviewIcon, TodayIcon } from './ui/icons/NavIcons'
import { ConfirmDialog } from './ui/common/ConfirmDialog'
import { ExercisesScreen } from './ui/exercises/ExercisesScreen'
import { LearnScreen } from './ui/lessons/LearnScreen'
import { PlayScreen } from './ui/play/PlayScreen'
import type { PlaySeed } from './ui/play/playConfig'
import { ProfileScreen } from './ui/profile/ProfileScreen'
import { ReviewScreen } from './ui/review/ReviewScreen'
import { useSettings } from './ui/settings'
import { TodayScreen } from './ui/today/TodayScreen'
import './App.css'

type Screen = 'today' | 'learn' | 'play' | 'exercises' | 'review' | 'profile'

interface PendingNavigation {
  screen: Screen
  conceptId?: ConceptId
  gameId?: number
  playSeed?: PlaySeed
  lessonId?: string
}

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
  const { t } = useI18n()
  const { appThemeId, appTheme } = useSettings()
  const systemScheme = useSystemScheme()
  const scheme = appThemeId === 'system' ? systemScheme : appTheme.scheme
  const [screen, setScreen] = useState<Screen>('today')
  const [exercisesConcept, setExercisesConcept] = useState<ConceptId | undefined>(undefined)
  const [reviewGameId, setReviewGameId] = useState<number | undefined>(undefined)
  const [playSeed, setPlaySeed] = useState<PlaySeed | undefined>(undefined)
  const [playGameActive, setPlayGameActive] = useState(false)
  const [exercisesActive, setExercisesActive] = useState(false)
  const [pendingNav, setPendingNav] = useState<PendingNavigation | null>(null)
  const [learnLessonId, setLearnLessonId] = useState<string | undefined>(undefined)

  /** Se incrementa en cada navegacion real (aunque el destino sea la misma
   * pestana ya activa) y se usa como `key` de las 4 pantallas con estado
   * interno propio (Aprender/Jugar/Ejercicios/Revisar). Reactocar una
   * pestana ya activa para volver a su raiz (p.ej. goToExercises(undefined)
   * estando ya en Ejercicios) a veces no cambia ningun valor -- React
   * entonces ni siquiera vuelve a invocar el componente hijo, asi que un
   * useEffect mirando el prop nunca llega a dispararse. Un contador que
   * siempre cambia fuerza el remount sin depender de que el valor en si
   * haya cambiado. */
  const [navToken, setNavToken] = useState(0)

  function applyNav(target: PendingNavigation) {
    setNavToken((t) => t + 1)
    if (target.screen === 'exercises') setExercisesConcept(target.conceptId)
    if (target.screen === 'review') setReviewGameId(target.gameId)
    if (target.screen === 'play') setPlaySeed(target.playSeed)
    if (target.screen === 'learn') setLearnLessonId(target.lessonId)
    setScreen(target.screen)
  }

  /** Toda navegacion entre pestanas pasa por aca: si Jugar tiene una partida
   * sin terminar o Ejercicios tiene un intento en curso, pide confirmacion
   * en pantalla antes de abandonarlo en vez de desmontar la pantalla en
   * silencio -- incluye retocar la propia pestana activa, que gracias a
   * navToken tambien la reinicia y por lo tanto tambien debe confirmar.
   * Hoy y Aprender quedan afuera a proposito (ver plan de este pase):
   * una tarjeta de repaso o una leccion leida son mucho mas baratas de
   * repetir que una partida completa o un intento de tsumego. */
  function attemptNav(target: PendingNavigation) {
    if ((screen === 'play' && playGameActive) || (screen === 'exercises' && exercisesActive)) {
      setPendingNav(target)
      return
    }
    applyNav(target)
  }

  function goToExercises(conceptId?: ConceptId) {
    attemptNav({ screen: 'exercises', conceptId })
  }

  return (
    <div className="app" data-app-theme={appThemeId} data-scheme={scheme}>
      <header className="app-header">
        <h1>{t('app.title')}</h1>
        <p className="tagline">{t('app.tagline')}</p>
      </header>

      <main className="app-main">
        {screen === 'today' && (
          <TodayScreen
            onNavigateToPlay={() => attemptNav({ screen: 'play' })}
            onNavigateToLearn={(lessonId) => attemptNav({ screen: 'learn', lessonId })}
          />
        )}
        {screen === 'learn' && (
          <LearnScreen
            key={navToken}
            initialLessonId={learnLessonId}
            onNavigateToExercises={(conceptId) => goToExercises(conceptId)}
            onNavigateToPlay={(seed) => attemptNav({ screen: 'play', playSeed: seed })}
          />
        )}
        {screen === 'play' && (
          <PlayScreen
            key={navToken}
            onGameActiveChange={setPlayGameActive}
            onNavigateToToday={() => attemptNav({ screen: 'today' })}
            onNavigateToReview={(gameId) => attemptNav({ screen: 'review', gameId })}
            initialSeed={playSeed}
          />
        )}
        {screen === 'exercises' && (
          <ExercisesScreen key={navToken} initialConcept={exercisesConcept} onActiveChange={setExercisesActive} />
        )}
        {screen === 'review' && (
          <ReviewScreen key={navToken} onPracticeConcept={goToExercises} initialGameId={reviewGameId} />
        )}
        {screen === 'profile' && <ProfileScreen />}
      </main>

      <nav className="bottom-nav" role="navigation" aria-label={t('nav.label')}>
        {NAV_ITEMS.map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            type="button"
            className={screen === id ? 'active' : ''}
            aria-current={screen === id ? 'page' : undefined}
            onClick={() => (id === 'exercises' ? goToExercises(undefined) : attemptNav({ screen: id }))}
          >
            <Icon />
            <span>{t(labelKey)}</span>
          </button>
        ))}
      </nav>

      {pendingNav && (
        <ConfirmDialog
          title={t(screen === 'play' ? 'play.exitConfirm.title' : 'exercises.exitConfirm.title')}
          message={t(screen === 'play' ? 'play.exitConfirm.message' : 'exercises.exitConfirm.message')}
          confirmLabel={t(screen === 'play' ? 'play.exitConfirm.confirm' : 'exercises.exitConfirm.confirm')}
          cancelLabel={t(screen === 'play' ? 'play.exitConfirm.cancel' : 'exercises.exitConfirm.cancel')}
          onConfirm={() => {
            applyNav(pendingNav)
            setPendingNav(null)
          }}
          onCancel={() => setPendingNav(null)}
        />
      )}
    </div>
  )
}

export default App
