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
    <div className="controls">
      <label htmlFor="board-size">{t('board.size')}</label>
      <select id="board-size" value={size} onChange={(event) => onSizeChange(Number(event.target.value))}>
        {BOARD_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}x{s}
          </option>
        ))}
      </select>

      <label htmlFor="game-mode">{t('play.mode.label')}</label>
      <select id="game-mode" value={mode} onChange={(event) => onModeChange(event.target.value as GameMode)}>
        <option value="local">{t('play.mode.local')}</option>
        <option value="bot">{t('play.mode.bot')}</option>
      </select>

      {mode === 'bot' && (
        <>
          <label htmlFor="bot-strength">{t('play.strength.label')}</label>
          <select
            id="bot-strength"
            value={strengthId}
            onChange={(event) => onStrengthChange(event.target.value as StrengthLevel['id'])}
          >
            {STRENGTH_LEVELS.map((level) => (
              <option key={level.id} value={level.id}>
                {t(level.labelKey)}
              </option>
            ))}
          </select>

          <label htmlFor="human-color">{t('play.color.label')}</label>
          <select
            id="human-color"
            value={humanColor}
            onChange={(event) => onHumanColorChange(Number(event.target.value) as Color)}
          >
            <option value={BLACK}>{t('color.black')}</option>
            <option value={WHITE}>{t('color.white')}</option>
          </select>
        </>
      )}

      <button type="button" onClick={onNewGame}>
        {t('board.newGame')}
      </button>
      <button type="button" onClick={onPass} disabled={passDisabled}>
        {t('board.pass')}
      </button>
    </div>
  )
}
