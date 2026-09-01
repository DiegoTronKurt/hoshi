import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { BOARD_THEMES, getTheme, minimoTheme } from '../board/themes'
import type { BoardTheme } from '../board/themes'
import { playStoneSound } from '../sound'

const THEME_STORAGE_KEY = 'hoshi-theme'
const SOUND_STORAGE_KEY = 'hoshi-sound-enabled'

interface SettingsContextValue {
  themeId: string
  setThemeId: (id: string) => void
  theme: BoardTheme
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
  playStoneSoundIfEnabled: () => void
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

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<string>(detectInitialThemeId)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(detectInitialSoundEnabled)

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
    }),
    [themeId, soundEnabled],
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
