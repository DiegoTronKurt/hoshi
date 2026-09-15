import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { BOARD_THEMES, getTheme, minimoTheme } from '../board/themes'
import type { BoardTheme } from '../board/themes'
import { APP_THEMES, getAppTheme } from '../theme/appThemes'
import type { AppTheme } from '../theme/appThemes'
import { playStoneSound } from '../sound'

const THEME_STORAGE_KEY = 'hoshi-theme'
const SOUND_STORAGE_KEY = 'hoshi-sound-enabled'
const DAILY_GOAL_STORAGE_KEY = 'hoshi-daily-goal'
const APP_THEME_STORAGE_KEY = 'hoshi-app-theme'
const STREAK_STORAGE_KEY = 'hoshi-streak-enabled'
const CAPTURE_ANIMATION_STORAGE_KEY = 'hoshi-capture-animation-enabled'
const REMOTE_EVAL_URL_STORAGE_KEY = 'hoshi-remote-eval-url'
const COORDINATES_STORAGE_KEY = 'hoshi-coordinates-enabled'
const GRID_THICKNESS_STORAGE_KEY = 'hoshi-grid-thickness-multiplier'
/** 13, no un numero redondo: es la cantidad de problemas que hoy planifica
 * planSession con su DEFAULT_SESSION_MINUTES (10) antes de que la meta
 * diaria realmente la determine (ver training-policy/session.ts). Asi una
 * instalacion nueva arranca con el mismo tamano de sesion que tenia antes
 * de que esta meta afectara la planificacion de verdad. */
export const DEFAULT_DAILY_GOAL = 13
const MIN_DAILY_GOAL = 1
const MAX_DAILY_GOAL = 20
const DEFAULT_APP_THEME_ID = 'system'
export const MIN_GRID_THICKNESS_MULTIPLIER = 1
export const MAX_GRID_THICKNESS_MULTIPLIER = 3
export const DEFAULT_GRID_THICKNESS_MULTIPLIER = 1

interface SettingsContextValue {
  themeId: string
  setThemeId: (id: string) => void
  theme: BoardTheme
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
  playStoneSoundIfEnabled: () => void
  dailyGoal: number
  setDailyGoal: (goal: number) => void
  appThemeId: string
  setAppThemeId: (id: string) => void
  appTheme: AppTheme
  streakEnabled: boolean
  setStreakEnabled: (enabled: boolean) => void
  /** Anima el desvanecido de las piedras capturadas en PlayGameScreen (ver
   * BoardCanvas capturedFlash). Opt-in a pedido explicito de la persona
   * usuaria, no siempre-on como el resto del feedback visual. */
  captureAnimationEnabled: boolean
  setCaptureAnimationEnabled: (enabled: boolean) => void
  /** URL base de un servidor de inferencia remota (E3 del roadmap), o null
   * para usar el Worker local (comportamiento por defecto, siempre
   * disponible sin configurar nada). Ver eval/remoteClient.ts y
   * tools/eval-server.ts -- desplegar ese servidor es decision de la
   * persona usuaria, la app nunca elige ni paga uno por su cuenta. */
  remoteEvalUrl: string | null
  setRemoteEvalUrl: (url: string | null) => void
  /** Letras/numeros de coordenadas alrededor del tablero, ver BoardCanvas. */
  coordinatesEnabled: boolean
  setCoordinatesEnabled: (enabled: boolean) => void
  /** Multiplicador sobre el grosor de linea base de cada tema (no un
   * reemplazo), ver BoardCanvas.tsx. */
  gridThicknessMultiplier: number
  setGridThicknessMultiplier: (multiplier: number) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function detectInitialThemeId(): string {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored && BOARD_THEMES.some((theme) => theme.id === stored)) return stored
  } catch {
    // localStorage puede fallar en modo privado, se ignora y se usa el tema por defecto
  }
  return minimoTheme.id
}

function detectInitialSoundEnabled(): boolean {
  try {
    const stored = window.localStorage.getItem(SOUND_STORAGE_KEY)
    if (stored === 'false') return false
  } catch {
    // sin persistencia disponible, el sonido queda activado por defecto para esta sesion
  }
  return true
}

function detectInitialAppThemeId(): string {
  try {
    const stored = window.localStorage.getItem(APP_THEME_STORAGE_KEY)
    if (stored && (stored === 'system' || APP_THEMES.some((theme) => theme.id === stored))) return stored
  } catch {
    // localStorage puede fallar en modo privado, se ignora y se usa "system" por defecto
  }
  return DEFAULT_APP_THEME_ID
}

function detectInitialStreakEnabled(): boolean {
  try {
    const stored = window.localStorage.getItem(STREAK_STORAGE_KEY)
    if (stored === 'false') return false
  } catch {
    // sin persistencia disponible, la racha queda activada por defecto para esta sesion
  }
  return true
}

function detectInitialCaptureAnimationEnabled(): boolean {
  try {
    const stored = window.localStorage.getItem(CAPTURE_ANIMATION_STORAGE_KEY)
    if (stored === 'false') return false
  } catch {
    // sin persistencia disponible, la animacion de captura queda activada por defecto para esta sesion
  }
  return true
}

function detectInitialRemoteEvalUrl(): string | null {
  try {
    const stored = window.localStorage.getItem(REMOTE_EVAL_URL_STORAGE_KEY)
    if (stored) return stored
  } catch {
    // sin persistencia disponible, la inferencia remota queda desactivada para esta sesion
  }
  return null
}

function clampDailyGoal(value: number): number {
  return Math.max(MIN_DAILY_GOAL, Math.min(MAX_DAILY_GOAL, Math.round(value)))
}

function detectInitialCoordinatesEnabled(): boolean {
  try {
    if (window.localStorage.getItem(COORDINATES_STORAGE_KEY) === 'true') return true
  } catch {
    // sin persistencia disponible, las coordenadas quedan desactivadas por defecto para esta sesion
  }
  return false
}

function clampGridThicknessMultiplier(value: number): number {
  return Math.max(MIN_GRID_THICKNESS_MULTIPLIER, Math.min(MAX_GRID_THICKNESS_MULTIPLIER, value))
}

function detectInitialGridThicknessMultiplier(): number {
  try {
    const stored = window.localStorage.getItem(GRID_THICKNESS_STORAGE_KEY)
    if (stored) {
      const parsed = Number(stored)
      if (Number.isFinite(parsed)) return clampGridThicknessMultiplier(parsed)
    }
  } catch {
    // sin persistencia disponible, se usa el valor por defecto para esta sesion
  }
  return DEFAULT_GRID_THICKNESS_MULTIPLIER
}

function detectInitialDailyGoal(): number {
  try {
    const stored = window.localStorage.getItem(DAILY_GOAL_STORAGE_KEY)
    if (stored) {
      const parsed = Number(stored)
      if (Number.isFinite(parsed)) return clampDailyGoal(parsed)
    }
  } catch {
    // sin persistencia disponible, se usa el valor por defecto para esta sesion
  }
  return DEFAULT_DAILY_GOAL
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<string>(detectInitialThemeId)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(detectInitialSoundEnabled)
  const [dailyGoal, setDailyGoalState] = useState<number>(detectInitialDailyGoal)
  const [appThemeId, setAppThemeId] = useState<string>(detectInitialAppThemeId)
  const [streakEnabled, setStreakEnabled] = useState<boolean>(detectInitialStreakEnabled)
  const [captureAnimationEnabled, setCaptureAnimationEnabled] = useState<boolean>(detectInitialCaptureAnimationEnabled)
  const [remoteEvalUrl, setRemoteEvalUrl] = useState<string | null>(detectInitialRemoteEvalUrl)
  const [coordinatesEnabled, setCoordinatesEnabled] = useState<boolean>(detectInitialCoordinatesEnabled)
  const [gridThicknessMultiplier, setGridThicknessMultiplierState] = useState<number>(detectInitialGridThicknessMultiplier)

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeId)
    } catch {
      // sin persistencia disponible, el tema sigue funcionando solo para esta sesion
    }
  }, [themeId])

  useEffect(() => {
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, String(soundEnabled))
    } catch {
      // sin persistencia disponible, la preferencia de sonido sigue funcionando solo para esta sesion
    }
  }, [soundEnabled])

  useEffect(() => {
    try {
      window.localStorage.setItem(DAILY_GOAL_STORAGE_KEY, String(dailyGoal))
    } catch {
      // sin persistencia disponible, la meta diaria sigue funcionando solo para esta sesion
    }
  }, [dailyGoal])

  useEffect(() => {
    try {
      window.localStorage.setItem(APP_THEME_STORAGE_KEY, appThemeId)
    } catch {
      // sin persistencia disponible, el tema de app sigue funcionando solo para esta sesion
    }
  }, [appThemeId])

  useEffect(() => {
    try {
      window.localStorage.setItem(STREAK_STORAGE_KEY, String(streakEnabled))
    } catch {
      // sin persistencia disponible, la preferencia de racha sigue funcionando solo para esta sesion
    }
  }, [streakEnabled])

  useEffect(() => {
    try {
      window.localStorage.setItem(CAPTURE_ANIMATION_STORAGE_KEY, String(captureAnimationEnabled))
    } catch {
      // sin persistencia disponible, la preferencia de animacion de captura sigue funcionando solo para esta sesion
    }
  }, [captureAnimationEnabled])

  useEffect(() => {
    try {
      if (remoteEvalUrl) window.localStorage.setItem(REMOTE_EVAL_URL_STORAGE_KEY, remoteEvalUrl)
      else window.localStorage.removeItem(REMOTE_EVAL_URL_STORAGE_KEY)
    } catch {
      // sin persistencia disponible, la preferencia de inferencia remota sigue funcionando solo para esta sesion
    }
  }, [remoteEvalUrl])

  useEffect(() => {
    try {
      window.localStorage.setItem(COORDINATES_STORAGE_KEY, String(coordinatesEnabled))
    } catch {
      // sin persistencia disponible, la preferencia de coordenadas sigue funcionando solo para esta sesion
    }
  }, [coordinatesEnabled])

  useEffect(() => {
    try {
      window.localStorage.setItem(GRID_THICKNESS_STORAGE_KEY, String(gridThicknessMultiplier))
    } catch {
      // sin persistencia disponible, el grosor de rejilla sigue funcionando solo para esta sesion
    }
  }, [gridThicknessMultiplier])

  const value = useMemo<SettingsContextValue>(
    () => ({
      themeId,
      setThemeId,
      theme: getTheme(themeId),
      soundEnabled,
      setSoundEnabled,
      playStoneSoundIfEnabled: () => {
        if (soundEnabled) playStoneSound()
      },
      dailyGoal,
      setDailyGoal: (goal: number) => setDailyGoalState(clampDailyGoal(goal)),
      appThemeId,
      setAppThemeId,
      appTheme: getAppTheme(appThemeId),
      streakEnabled,
      setStreakEnabled,
      captureAnimationEnabled,
      setCaptureAnimationEnabled,
      remoteEvalUrl,
      setRemoteEvalUrl: (url: string | null) => setRemoteEvalUrl(url && url.trim() !== '' ? url.trim() : null),
      coordinatesEnabled,
      setCoordinatesEnabled,
      gridThicknessMultiplier,
      setGridThicknessMultiplier: (multiplier: number) =>
        setGridThicknessMultiplierState(clampGridThicknessMultiplier(multiplier)),
    }),
    [
      themeId,
      soundEnabled,
      dailyGoal,
      appThemeId,
      streakEnabled,
      captureAnimationEnabled,
      remoteEvalUrl,
      coordinatesEnabled,
      gridThicknessMultiplier,
    ],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings debe usarse dentro de SettingsProvider')
  }
  return context
}
