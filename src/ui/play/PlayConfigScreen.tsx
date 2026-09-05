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
import { getHandicapPoints } from '../board/handicapPoints'
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

// Solo 9x9/13x13 (hasta 5, sus unicos puntos hoshi reales) y 19x19 (2 a 9,
// sus 9 puntos hoshi reales) tienen una convencion de handicap real -- ver
// ui/board/handicapPoints.ts. Los demas tamanos (5x5, 7x7, 9x13) no ofrecen
// el grupo en absoluto, en vez de inventar puntos sin respaldo.
const HANDICAP_OPTIONS_BY_SIZE: Record<string, number[]> = {
  '9x9': [0, 2, 3, 4, 5],
  '13x13': [0, 2, 3, 4, 5],
  '19x19': [0, 2, 3, 4, 5, 6, 7, 8, 9],
}

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
  const [handicapCount, setHandicapCount] = useState(lastConfig?.handicapCount ?? 0)
  const [hintsEnabled, setHintsEnabled] = useState(lastConfig?.hintsEnabled ?? false)

  const handicapOptions = HANDICAP_OPTIONS_BY_SIZE[`${width}x${height}`]

  // Un cambio de tamaño puede dejar la cantidad elegida sin sentido (p.ej.
  // veniamos de 19x19 con 8 piedras y se pasa a 9x9, que solo llega a 5) o
  // sacar el grupo entero de la pantalla (9x13) -- en ambos casos se vuelve a
  // "sin handicap" en vez de dejar un valor invalido silencioso.
  useEffect(() => {
    if (!handicapOptions?.includes(handicapCount)) setHandicapCount(0)
  }, [handicapOptions, handicapCount])

  // El handicap es de Negro por convencion -- forzar el color cuando se elige
  // alguno evita una combinacion sin sentido (handicap para Blanco). Solo
  // aplica contra el bot: en local no hay un unico "color de la persona".
  useEffect(() => {
    if (mode === 'bot' && handicapCount > 0) setHumanColor(BLACK)
  }, [mode, handicapCount])

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
    const handicapPoints = getHandicapPoints(width, height, handicapCount)
    const resolvedHumanColor = mode === 'bot' && handicapPoints.length > 0 ? BLACK : humanColor
    saveLastPlayConfig({
      width,
      height,
      mode,
      difficultyMode,
      strengthId,
      botStyle,
      humanColor: resolvedHumanColor,
      scoringRule,
      handicapCount,
      hintsEnabled,
    })
    onStart({
      width,
      height,
      mode,
      strengthId: resolvedStrengthId,
      botStyle,
      humanColor: resolvedHumanColor,
      scoringRule,
      handicapStones: handicapPoints.length > 0 ? handicapPoints : undefined,
      hintsEnabled,
    })
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

      {handicapOptions && (
        <div className="play-card-group">
          <span className="play-card-group-label">{t('play.handicap.label')}</span>
          <div className="play-card-row" role="group" aria-label={t('play.handicap.label')}>
            {handicapOptions.map((count) => (
              <button
                key={count}
                type="button"
                className={`play-bot-card ${count === handicapCount ? 'active' : ''}`}
                aria-pressed={count === handicapCount}
                onClick={() => setHandicapCount(count)}
              >
                <span>{count === 0 ? t('play.handicap.off') : t('play.handicap.count', { n: count })}</span>
              </button>
            ))}
          </div>
          {handicapCount > 0 && <p className="settings-description">{t('play.handicap.disclaimer')}</p>}
        </div>
      )}

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

      <div className="play-card-group">
        <span className="play-card-group-label">{t('play.hint.toggle.label')}</span>
        <div className="play-card-row" role="group" aria-label={t('play.hint.toggle.label')}>
          <button
            type="button"
            className={`play-bot-card ${!hintsEnabled ? 'active' : ''}`}
            aria-pressed={!hintsEnabled}
            onClick={() => setHintsEnabled(false)}
          >
            <span>{t('play.hint.toggle.off')}</span>
          </button>
          <button
            type="button"
            className={`play-bot-card ${hintsEnabled ? 'active' : ''}`}
            aria-pressed={hintsEnabled}
            onClick={() => setHintsEnabled(true)}
          >
            <span>{t('play.hint.toggle.on')}</span>
          </button>
        </div>
        {hintsEnabled && <p className="settings-description">{t('play.hint.disclaimer')}</p>}
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

          {handicapCount === 0 && (
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
          )}
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
