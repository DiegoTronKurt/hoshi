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
import type { DifficultyMode, GameMode, PlayConfig, ScoringRule } from './playConfig'
import { loadLastPlayConfig, saveLastPlayConfig } from './playConfig'
import { SavedGamesList } from './SavedGamesList'
import { STRENGTH_LEVELS } from './strengthLevels'
import type { StrengthLevel } from './strengthLevels'

// 13x13 desbloqueado 2026-09-03, 19x19 desbloqueado 2026-09-04: la deuda
// tecnica de tamaño de tablero (roadmap maestro, seccion 8) resulto ya estar
// resuelta al verificarla de nuevo (Zobrist/region/BOARD_TRANSFORMS ya eran
// genericos), y en ambos casos el curriculo ya habia llegado a ese tamaño
// (13x13: niveles 4 a 6; 19x19: niveles 7 a 10, v3 completo) -- mismo
// principio que los niveles bloqueados en Aprender (LearnScreen.tsx).
// Confirmado con una partida bot-vs-bot completa de principio a fin en cada
// tamaño (9x9, 13x13 y 19x19), no solo unas pocas jugadas sin crashear -- ver
// NOTAS.md. 9x13 agregado el mismo dia: unico tablero rectangular ya en uso
// real en contenido (Nivel 4), misma orientacion que ui/board/hoshiPoints.ts
// (width=9, height=13) -- BoardCanvas y el motor de deteccion de errores ya
// eran genericos en ancho/alto, lo unico cuadrado era este selector.
interface BoardPreset {
  width: number
  height: number
  label: string
}

const BOARD_PRESETS: BoardPreset[] = [
  { width: 5, height: 5, label: '5x5' },
  { width: 7, height: 7, label: '7x7' },
  { width: 9, height: 9, label: '9x9' },
  { width: 13, height: 13, label: '13x13' },
  { width: 19, height: 19, label: '19x19' },
  { width: 9, height: 13, label: '9x13' },
]

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

  const [width, setWidth] = useState(lastConfig?.width ?? 9)
  const [height, setHeight] = useState(lastConfig?.height ?? 9)
  const [mode, setMode] = useState<GameMode>(lastConfig?.mode ?? 'local')
  const [difficultyMode, setDifficultyMode] = useState<DifficultyMode>(lastConfig?.difficultyMode ?? 'manual')
  const [strengthId, setStrengthId] = useState<StrengthLevel['id']>(lastConfig?.strengthId ?? 'normal')
  const [botStyle, setBotStyle] = useState<BotStyleId>(lastConfig?.botStyle ?? 'standard')
  const [humanColor, setHumanColor] = useState<Color>(lastConfig?.humanColor ?? BLACK)
  const [scoringRule, setScoringRule] = useState<ScoringRule>(lastConfig?.scoringRule ?? 'chinese')

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
    saveLastPlayConfig({ width, height, mode, difficultyMode, strengthId, botStyle, humanColor, scoringRule })
    onStart({ width, height, mode, strengthId: resolvedStrengthId, botStyle, humanColor, scoringRule })
  }

  return (
    <div className="play-config">
      <h2>{t('play.config.title')}</h2>

      <div className="play-card-group">
        <span className="play-card-group-label">{t('board.size')}</span>
        <div className="play-card-row" role="group" aria-label={t('board.size')}>
          {BOARD_PRESETS.map((preset) => {
            const active = preset.width === width && preset.height === height
            return (
              <button
                key={preset.label}
                type="button"
                className={`play-size-card ${active ? 'active' : ''}`}
                aria-pressed={active}
                onClick={() => {
                  setWidth(preset.width)
                  setHeight(preset.height)
                }}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="play-card-group">
        <span className="play-card-group-label">{t('play.scoringRule.label')}</span>
        <div className="play-card-row" role="group" aria-label={t('play.scoringRule.label')}>
          <button
            type="button"
            className={`play-bot-card ${scoringRule === 'chinese' ? 'active' : ''}`}
            aria-pressed={scoringRule === 'chinese'}
            onClick={() => setScoringRule('chinese')}
          >
            <span>{t('play.scoringRule.chinese')}</span>
          </button>
          <button
            type="button"
            className={`play-bot-card ${scoringRule === 'japanese' ? 'active' : ''}`}
            aria-pressed={scoringRule === 'japanese'}
            onClick={() => setScoringRule('japanese')}
          >
            <span>{t('play.scoringRule.japanese')}</span>
          </button>
        </div>
        <p className="settings-description">{t('play.scoringRule.disclaimer')}</p>
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
          <p className="settings-description">{t('play.strength.disclaimer')}</p>

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
