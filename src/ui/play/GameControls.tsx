import { BLACK, WHITE } from '../../core/types'
import type { Color } from '../../core/types'
import type { BotStyleId } from '../../engine/botStyles'
import { BOT_STYLES } from '../../engine/botStyles'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import type { AdaptiveDifficultyResult } from '../../learning/adaptiveDifficulty'
import { ADAPTIVE_MIN_GAMES } from '../../learning/adaptiveDifficulty'
import { STRENGTH_LEVELS } from './strengthLevels'
import type { StrengthLevel } from './strengthLevels'

const BOARD_SIZES = [5, 7, 9] as const

const BOT_STYLE_LABEL_KEY: Record<BotStyleId, TranslationKey> = {
  standard: 'play.botStyle.standard',
  territorial: 'play.botStyle.territorial',
  influence: 'play.botStyle.influence',
  combative: 'play.botStyle.combative',
}

export type GameMode = 'local' | 'bot'
export type DifficultyMode = 'manual' | 'adaptive'

interface GameControlsProps {
  size: number
  onSizeChange: (size: number) => void
  mode: GameMode
  onModeChange: (mode: GameMode) => void
  difficultyMode: DifficultyMode
  onDifficultyModeChange: (mode: DifficultyMode) => void
  strengthId: StrengthLevel['id']
  onStrengthChange: (id: StrengthLevel['id']) => void
  adaptiveResult: AdaptiveDifficultyResult
  botStyle: BotStyleId
  onBotStyleChange: (style: BotStyleId) => void
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
  difficultyMode,
  onDifficultyModeChange,
  strengthId,
  onStrengthChange,
  adaptiveResult,
  botStyle,
  onBotStyleChange,
  humanColor,
  onHumanColorChange,
  onNewGame,
  onPass,
  passDisabled,
}: GameControlsProps) {
  const { t } = useI18n()
  const adaptiveLevel = STRENGTH_LEVELS.find((level) => level.id === adaptiveResult.strengthId) ?? STRENGTH_LEVELS[1]

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
            <span className="play-card-group-label">{t('play.difficultyMode.label')}</span>
            <div className="play-card-row" role="group" aria-label={t('play.difficultyMode.label')}>
              <button
                type="button"
                className={`play-bot-card ${difficultyMode === 'manual' ? 'active' : ''}`}
                aria-pressed={difficultyMode === 'manual'}
                onClick={() => onDifficultyModeChange('manual')}
              >
                <span>{t('play.difficultyMode.manual')}</span>
              </button>
              <button
                type="button"
                className={`play-bot-card ${difficultyMode === 'adaptive' ? 'active' : ''}`}
                aria-pressed={difficultyMode === 'adaptive'}
                onClick={() => onDifficultyModeChange('adaptive')}
              >
                <span>{t('play.difficultyMode.adaptive')}</span>
              </button>
            </div>
          </div>

          {difficultyMode === 'manual' ? (
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
          ) : (
            <div className="play-adaptive-status">
              <p className="play-adaptive-current">
                {t('play.adaptive.current', { kyu: adaptiveLevel.approxKyu })}
              </p>
              <p className="settings-description">
                {adaptiveResult.sampleSize < ADAPTIVE_MIN_GAMES
                  ? t('play.adaptive.warmup', { needed: ADAPTIVE_MIN_GAMES })
                  : t('play.adaptive.description', { winRate: Math.round((adaptiveResult.winRate ?? 0) * 100) })}
              </p>
            </div>
          )}

          <div className="play-card-group">
            <span className="play-card-group-label">{t('play.botStyle.label')}</span>
            <div className="play-card-row" role="group" aria-label={t('play.botStyle.label')}>
              {BOT_STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  className={`play-bot-card ${style === botStyle ? 'active' : ''}`}
                  aria-pressed={style === botStyle}
                  onClick={() => onBotStyleChange(style)}
                >
                  <span>{t(BOT_STYLE_LABEL_KEY[style])}</span>
                </button>
              ))}
            </div>
            <p className="settings-description">{t(`play.botStyle.description.${botStyle}` as TranslationKey)}</p>
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
