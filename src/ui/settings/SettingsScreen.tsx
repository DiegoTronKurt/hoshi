import { useMemo } from 'react'
import { createBoard, toPoint } from '../../core/board'
import { BLACK, WHITE } from '../../core/types'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { BoardCanvas } from '../board/BoardCanvas'
import { BOARD_THEMES, getTheme } from '../board/themes'
import { APP_THEMES } from '../theme/appThemes'
import { useSettings } from '../settings'

const THEME_NAME_KEY: Record<string, TranslationKey> = {
  minimo: 'settings.theme.minimo',
  sumie: 'settings.theme.sumie',
  kaya: 'settings.theme.kaya',
  nocturno: 'settings.theme.nocturno',
}

const APP_THEME_NAME_KEY: Record<string, TranslationKey> = {
  system: 'settings.appTheme.system',
  crema: 'settings.appTheme.crema',
  piedra: 'settings.appTheme.piedra',
  bambu: 'settings.appTheme.bambu',
  amanecer: 'settings.appTheme.amanecer',
  noche: 'settings.appTheme.noche',
  pizarra: 'settings.appTheme.pizarra',
}

const APP_THEME_OPTION_IDS = ['system', ...APP_THEMES.map((theme) => theme.id)]

function buildPreviewBoard() {
  const size = 5
  const board = createBoard(size)
  board.stones[toPoint(size, 1, 1)] = BLACK
  board.stones[toPoint(size, 2, 1)] = WHITE
  board.stones[toPoint(size, 1, 3)] = WHITE
  board.stones[toPoint(size, 3, 3)] = BLACK
  return { size, stones: board.stones }
}

const PREVIEW = buildPreviewBoard()

interface SettingsScreenProps {
  onBack: () => void
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { t } = useI18n()
  const {
    themeId,
    setThemeId,
    soundEnabled,
    setSoundEnabled,
    dailyGoal,
    setDailyGoal,
    appThemeId,
    setAppThemeId,
    streakEnabled,
    setStreakEnabled,
  } = useSettings()
  const previewThemes = useMemo(() => BOARD_THEMES.map((theme) => getTheme(theme.id)), [])

  return (
    <div className="settings">
      <div className="settings-header">
        <button type="button" onClick={onBack}>
          {t('settings.back')}
        </button>
        <h2>{t('settings.title')}</h2>
      </div>

      <section className="settings-section">
        <h3>{t('settings.appTheme.label')}</h3>
        <p className="settings-description">{t('settings.appTheme.description')}</p>
        <div className="settings-apptheme-grid">
          {APP_THEME_OPTION_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`settings-apptheme-option ${id === appThemeId ? 'active' : ''}`}
              onClick={() => setAppThemeId(id)}
              aria-pressed={id === appThemeId}
            >
              {id === 'system' ? (
                <span className="settings-apptheme-swatches">
                  <span className="settings-apptheme-swatch settings-apptheme-swatch-system" />
                </span>
              ) : (
                (() => {
                  const theme = APP_THEMES.find((t) => t.id === id)
                  if (!theme) return null
                  return (
                    <span className="settings-apptheme-swatches">
                      <span className="settings-apptheme-swatch" style={{ background: theme.colors.bg }} />
                      <span className="settings-apptheme-swatch" style={{ background: theme.colors.surface }} />
                      <span className="settings-apptheme-swatch" style={{ background: theme.colors.accent }} />
                    </span>
                  )
                })()
              )}
              <span className="settings-apptheme-name">{t(APP_THEME_NAME_KEY[id] ?? 'settings.appTheme.system')}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>{t('settings.theme.label')}</h3>
        <div className="settings-theme-grid">
          {previewThemes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`settings-theme-option ${theme.id === themeId ? 'active' : ''}`}
              onClick={() => setThemeId(theme.id)}
              aria-pressed={theme.id === themeId}
            >
              <span className="settings-theme-preview">
                <BoardCanvas
                  size={PREVIEW.size}
                  stones={PREVIEW.stones}
                  lastMove={null}
                  theme={theme}
                  onIntersectionClick={() => {}}
                />
              </span>
              <span className="settings-theme-name">{t(THEME_NAME_KEY[theme.id] ?? 'settings.theme.minimo')}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>{t('settings.sound.label')}</h3>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(event) => setSoundEnabled(event.target.checked)}
          />
          {t('settings.sound.enabled')}
        </label>
      </section>

      <section className="settings-section">
        <h3>{t('settings.dailyGoal.label')}</h3>
        <p className="settings-description">{t('settings.dailyGoal.description')}</p>
        <label className="settings-daily-goal">
          <input
            type="number"
            min={1}
            max={20}
            value={dailyGoal}
            onChange={(event) => setDailyGoal(Number(event.target.value))}
          />
          {t('settings.dailyGoal.unit')}
        </label>
      </section>

      <section className="settings-section">
        <h3>{t('settings.streak.label')}</h3>
        <p className="settings-description">{t('settings.streak.description')}</p>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={streakEnabled}
            onChange={(event) => setStreakEnabled(event.target.checked)}
          />
          {t('settings.streak.enabled')}
        </label>
      </section>
    </div>
  )
}
