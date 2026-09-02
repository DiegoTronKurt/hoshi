import { useEffect, useMemo, useState } from 'react'
import { BLACK, WHITE } from '../../core/types'
import type { Color } from '../../core/types'
import type { BotStyleId } from '../../engine/botStyles'
import { BOT_STYLES } from '../../engine/botStyles'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { computeAdaptiveStrength } from '../../learning/adaptiveDifficulty'
import { ADAPTIVE_MIN_GAMES } from '../../learning/adaptiveDifficulty'
import { listGames } from '../../storage/db'
import type { SavedGameRecord } from '../../storage/db'
import { LockIcon } from '../common/LockIcon'
import type { DifficultyMode, GameMode, PlayConfig } from './playConfig'
import { loadLastPlayConfig, saveLastPlayConfig } from './playConfig'
import { SavedGamesList } from './SavedGamesList'
import { STRENGTH_LEVELS } from './strengthLevels'
import type { StrengthLevel } from './strengthLevels'

const BOARD_SIZES = [5, 7, 9] as const
// 13x13 y 19x19 se suman cuando el curriculo llegue a esos niveles (roadmap
// maestro, seccion 2.2; flujo-pantallas.md seccion 3.1): mientras tanto se
// muestran bloqueados, no ocultos, mismo principio que los niveles 4-10
// bloqueados en Aprender (LearnScreen.tsx).
const LOCKED_BOARD_SIZES = [13, 19] as const

const BOT_STYLE_LABEL_KEY: Record<BotStyleId, TranslationKey> = {
  standard: 'play.botStyle.standard',
  territorial: 'play.botStyle.territorial',
  influence: 'play.botStyle.influence',
  combative: 'play.botStyle.combative',
}

interface PlayConfigScreenProps {
  onStart: (config: PlayConfig) => void
}

export function PlayConfigScreen({ onStart }: PlayConfigScreenProps) {
  const { t } = useI18n()
  const lastConfig = useMemo(() => loadLastPlayConfig(), [])

  const [size, setSize] = useState(lastConfig?.size ?? 9)
  const [mode, setMode] = useState<GameMode>(lastConfig?.mode ?? 'local')
  const [difficultyMode, setDifficultyMode] = useState<DifficultyMode>(lastConfig?.difficultyMode ?? 'manual')
  const [strengthId, setStrengthId] = useState<StrengthLevel['id']>(lastConfig?.strengthId ?? 'normal')
  const [botStyle, setBotStyle] = useState<BotStyleId>(lastConfig?.botStyle ?? 'standard')
  const [humanColor, setHumanColor] = useState<Color>(lastConfig?.humanColor ?? BLACK)

  const [savedGames, setSavedGames] = useState<SavedGameRecord[]>([])
  useEffect(() => {
    listGames()
      .then(setSavedGames)
      .catch(() => setSavedGames([]))
  }, [])

  const adaptiveResult = useMemo(() => computeAdaptiveStrength(savedGames), [savedGames])
  const adaptiveLevel = STRENGTH_LEVELS.find((level) => level.id === adaptiveResult.strengthId) ?? STRENGTH_LEVELS[1]

  function handleStart() {
    const resolvedStrengthId = difficultyMode === 'adaptive' ? adaptiveResult.strengthId : strengthId
    saveLastPlayConfig({ size, mode, difficultyMode, strengthId, botStyle, humanColor })
    onStart({ size, mode, strengthId: resolvedStrengthId, botStyle, humanColor })
  }

  return (
    <div className="play-config">
      <h2>{t('play.config.title')}</h2>

      <div className="play-card-group">
        <span className="play-card-group-label">{t('board.size')}</span>
        <div className="play-card-row" role="group" aria-label={t('board.size')}>
          {BOARD_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              className={`play-size-card ${s === size ? 'active' : ''}`}
              aria-pressed={s === size}
              onClick={() => setSize(s)}
            >
              {s}x{s}
            </button>
          ))}
          {LOCKED_BOARD_SIZES.map((s) => (
            <div key={s} className="play-size-card play-size-card-locked" aria-disabled="true">
              <LockIcon />
              <span>
                {s}x{s}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="controls">
        <label htmlFor="game-mode">{t('play.mode.label')}</label>
        <select id="game-mode" value={mode} onChange={(event) => setMode(event.target.value as GameMode)}>
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
                onClick={() => setDifficultyMode('manual')}
              >
                <span>{t('play.difficultyMode.manual')}</span>
              </button>
              <button
                type="button"
                className={`play-bot-card ${difficultyMode === 'adaptive' ? 'active' : ''}`}
                aria-pressed={difficultyMode === 'adaptive'}
                onClick={() => setDifficultyMode('adaptive')}
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
                    onClick={() => setStrengthId(level.id)}
                  >
                    <span>{t(level.labelKey)}</span>
                    <span className="play-bot-card-kyu">~{level.approxKyu} kyu</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="play-adaptive-status">
              <p className="play-adaptive-current">{t('play.adaptive.current', { kyu: adaptiveLevel.approxKyu })}</p>
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
                  onClick={() => setBotStyle(style)}
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
              onChange={(event) => setHumanColor(Number(event.target.value) as Color)}
            >
              <option value={BLACK}>{t('color.black')}</option>
              <option value={WHITE}>{t('color.white')}</option>
            </select>
          </div>
        </>
      )}

      <button type="button" className="play-start-button" onClick={handleStart}>
        {t('play.config.start')}
      </button>

      <section className="saved-games">
        <h2>{t('play.savedGames.title')}</h2>
        <SavedGamesList games={savedGames} />
      </section>
    </div>
  )
}
