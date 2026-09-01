import { BLACK, WHITE } from '../../core/types'
import type { Color } from '../../core/types'
import { useI18n } from '../../i18n'
import { STRENGTH_LEVELS } from './strengthLevels'
import type { StrengthLevel } from './strengthLevels'

const BOARD_SIZES = [5, 7, 9] as const

export type GameMode = 'local' | 'bot'

interface GameControlsProps {
  size: number
  onSizeChange: (size: number) => void
  mode: GameMode
  onModeChange: (mode: GameMode) => void
  strengthId: StrengthLevel['id']
  onStrengthChange: (id: StrengthLevel['id']) => void
  humanColor: Color
  onHumanColorChange: (color: Color) => void
  onNewGame: () => void
  onPass: () => void
  passDisabled: boolean
}

export function GameControls({
  size,
  onSizeChange,
  mode,
  onModeChange,
  strengthId,
  onStrengthChange,
  humanColor,
  onHumanColorChange,
  onNewGame,
  onPass,
  passDisabled,
}: GameControlsProps) {
  const { t } = useI18n()

  return (
    <div className="play-controls-grid">
      <div className="play-card-group">
        <span className="play-card-group-label">{t('board.size')}</span>
        <div className="play-card-row" role="group" aria-label={t('board.size')}>
          {BOARD_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              className={`play-size-card ${s === size ? 'active' : ''}`}
              aria-pressed={s === size}
              onClick={() => onSizeChange(s)}
            >
              {s}x{s}
            </button>
          ))}
        </div>
      </div>

      <div className="controls">
        <label htmlFor="game-mode">{t('play.mode.label')}</label>
        <select id="game-mode" value={mode} onChange={(event) => onModeChange(event.target.value as GameMode)}>
          <option value="local">{t('play.mode.local')}</option>
          <option value="bot">{t('play.mode.bot')}</option>
        </select>
      </div>

      {mode === 'bot' && (
        <>
          <div className="play-card-group">
            <span className="play-card-group-label">{t('play.strength.label')}</span>
            <div className="play-card-row" role="group" aria-label={t('play.strength.label')}>
              {STRENGTH_LEVELS.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  className={`play-bot-card ${level.id === strengthId ? 'active' : ''}`}
                  aria-pressed={level.id === strengthId}
                  onClick={() => onStrengthChange(level.id)}
                >
                  <span>{t(level.labelKey)}</span>
                  <span className="play-bot-card-kyu">~{level.approxKyu} kyu</span>
                </button>
              ))}
            </div>
          </div>

          <div className="controls">
            <label htmlFor="human-color">{t('play.color.label')}</label>
            <select
              id="human-color"
              value={humanColor}
              onChange={(event) => onHumanColorChange(Number(event.target.value) as Color)}
            >
              <option value={BLACK}>{t('color.black')}</option>
              <option value={WHITE}>{t('color.white')}</option>
            </select>
          </div>
        </>
      )}

      <div className="controls">
        <button type="button" onClick={onNewGame}>
          {t('board.newGame')}
        </button>
        <button type="button" onClick={onPass} disabled={passDisabled}>
          {t('board.pass')}
        </button>
      </div>
    </div>
  )
}
