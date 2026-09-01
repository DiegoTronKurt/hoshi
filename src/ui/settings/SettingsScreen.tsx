import { useMemo } from 'react'
import { createBoard, toPoint } from '../../core/board'
import { BLACK, WHITE } from '../../core/types'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { BoardCanvas } from '../board/BoardCanvas'
import { BOARD_THEMES, getTheme } from '../board/themes'
import { useSettings } from '../settings'

const THEME_NAME_KEY: Record<string, TranslationKey> = {
  minimo: 'settings.theme.minimo',
  sumie: 'settings.theme.sumie',
  kaya: 'settings.theme.kaya',
  nocturno: 'settings.theme.nocturno',
}

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
  const { themeId, setThemeId, soundEnabled, setSoundEnabled, dailyGoal, setDailyGoal } = useSettings()
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
    </div>
  )
}
