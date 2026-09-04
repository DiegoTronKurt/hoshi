import { useEffect, useMemo, useRef, useState } from 'react'
import { CONCEPTS } from '../../analysis/concepts'
import { applyMove, createGame, gameStateFromBoard } from '../../core/rules'
import { computeAreaOwnership, computeAreaScore, computeTerritoryScore } from '../../core/scoring'
import type { AreaScore } from '../../core/scoring'
import { gameRecordToSgf } from '../../core/sgf'
import type { RecordedMove } from '../../core/sgf'
import { BLACK } from '../../core/types'
import type { GameState, IllegalReason } from '../../core/types'
import { EngineClient } from '../../engine/client'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { getLesson } from '../../content/lessons'
import { listGames, saveGame } from '../../storage/db'
import { findConceptsToReopen } from '../../training-policy/session'
import { BoardCanvas } from '../board/BoardCanvas'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { reopenLesson } from '../lessons/readProgress'
import { useSettings } from '../settings'
import { PlayInGameControls } from './PlayInGameControls'
import type { PlayConfig } from './playConfig'
import { STRENGTH_LEVELS } from './strengthLevels'

const KOMI = 6.5

const BOT_STYLE_LABEL_KEY: Record<string, TranslationKey> = {
  standard: 'play.botStyle.standard',
  territorial: 'play.botStyle.territorial',
  influence: 'play.botStyle.influence',
  combative: 'play.botStyle.combative',
}

function computeScore(game: GameState, scoringRule: PlayConfig['scoringRule']): AreaScore {
  return scoringRule === 'japanese'
    ? computeTerritoryScore(game.board, game.komi, game.captures)
    : computeAreaScore(game.board, game.komi)
}

interface PlayGameScreenProps {
  config: PlayConfig
  onExitToConfig: () => void
  onNavigateToToday: () => void
  onNavigateToReview: (gameId: number) => void
  onActiveChange: (active: boolean) => void
}

export function PlayGameScreen({
  config,
  onExitToConfig,
  onNavigateToToday,
  onNavigateToReview,
  onActiveChange,
}: PlayGameScreenProps) {
  const { t } = useI18n()
  const { theme, playStoneSoundIfEnabled } = useSettings()

  const [history, setHistory] = useState<GameState[]>(() => [
    config.initialStones
      ? gameStateFromBoard(
          { width: config.width, height: config.height, stones: config.initialStones },
          config.initialToMove ?? BLACK,
          KOMI,
        )
      : createGame(config.width, config.height, KOMI),
  ])
  const [moves, setMoves] = useState<RecordedMove[]>([])
  const [message, setMessage] = useState<IllegalReason | null>(null)
  const [botThinking, setBotThinking] = useState(false)
  const [botError, setBotError] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [savedGameId, setSavedGameId] = useState<number | null>(null)
  const [showCount, setShowCount] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const game = history[history.length - 1]
  const lastMove = moves.length > 0 ? moves[moves.length - 1].point : null

  const engineRef = useRef<EngineClient | null>(null)
  const savedThisGameRef = useRef(false)

  useEffect(() => {
    engineRef.current = new EngineClient()
    return () => engineRef.current?.terminate()
  }, [])

  useEffect(() => {
    onActiveChange(!game.gameOver)
    return () => onActiveChange(false)
  }, [game.gameOver, onActiveChange])

  function isHumanTurn(): boolean {
    if (game.gameOver || botThinking) return false
    return config.mode === 'local' || game.toMove === config.humanColor
  }

  function applyPlayerMove(point: number | null) {
    const color = game.toMove
    const result = applyMove(game, point)
    if (!result.legal || !result.state) {
      setMessage(result.reason ?? null)
      return
    }
    setMoves((prev) => [...prev, { color, point }])
    setHistory((prev) => [...prev, result.state as GameState])
    setMessage(null)
    if (point !== null) playStoneSoundIfEnabled()
  }

  function handleIntersectionClick(point: number) {
    if (!isHumanTurn()) return
    applyPlayerMove(point)
  }

  function handlePass() {
    if (!isHumanTurn()) return
    applyPlayerMove(null)
  }

  function handleUndo() {
    if (moves.length === 0) return
    const last = moves[moves.length - 1]
    const popMoves = config.mode === 'bot' && last.color !== config.humanColor && moves.length >= 2 ? 2 : 1

    setMoves((prev) => prev.slice(0, prev.length - popMoves))
    setHistory((prev) => prev.slice(0, prev.length - popMoves))
    setMessage(null)
    setBotThinking(false)
    if (game.gameOver) {
      savedThisGameRef.current = false
      setJustSaved(false)
    }
  }

  // El bot juega automaticamente cuando le toca a el en modo "Contra el bot".
  useEffect(() => {
    if (config.mode !== 'bot' || game.gameOver || game.toMove === config.humanColor) return
    const engine = engineRef.current
    if (!engine) return

    const strength = STRENGTH_LEVELS.find((level) => level.id === config.strengthId) ?? STRENGTH_LEVELS[1]
    let cancelled = false
    setBotThinking(true)
    setBotError(false)

    engine
      .chooseMove(game, strength.playouts, undefined, strength.maxTimeMs, config.botStyle)
      .then((response) => {
        if (cancelled) return
        setBotThinking(false)
        const color = game.toMove
        const result = applyMove(game, response.move)
        if (!result.legal || !result.state) return
        setMoves((prev) => [...prev, { color, point: response.move }])
        setHistory((prev) => [...prev, result.state as GameState])
        if (response.move !== null) playStoneSoundIfEnabled()
      })
      .catch(() => {
        if (cancelled) return
        setBotThinking(false)
        setBotError(true)
      })

    return () => {
      cancelled = true
    }
  }, [game, config.mode, config.humanColor, config.strengthId, config.botStyle, playStoneSoundIfEnabled])

  const finalScore = useMemo(() => {
    if (!game.gameOver) return null
    return computeScore(game, config.scoringRule)
  }, [game, config.scoringRule])

  const liveScore = useMemo(() => computeScore(game, config.scoringRule), [game, config.scoringRule])

  /** Solo se calcula al terminar la partida (y solo una vez, ya que `game`
   * deja de cambiar): BoardCanvas usa el cambio de referencia null -> array
   * para disparar la animacion de revelado una sola vez. */
  const territory = useMemo(() => (game.gameOver ? computeAreaOwnership(game.board) : null), [game])

  // Guarda la partida en IndexedDB apenas termina, una sola vez.
  useEffect(() => {
    if (!game.gameOver || savedThisGameRef.current || !finalScore) return
    savedThisGameRef.current = true

    const winner: 'black' | 'white' = finalScore.black > finalScore.white ? 'black' : 'white'
    const strength = STRENGTH_LEVELS.find((level) => level.id === config.strengthId)
    const sgf = gameRecordToSgf(config.width, config.height, KOMI, moves)

    saveGame({
      createdAt: new Date().toISOString(),
      width: config.width,
      height: config.height,
      komi: KOMI,
      mode: config.mode,
      botPlayouts: config.mode === 'bot' ? strength?.playouts : undefined,
      botStrengthId: config.mode === 'bot' ? strength?.id : undefined,
      botStyle: config.mode === 'bot' ? config.botStyle : undefined,
      humanColor: config.mode === 'bot' ? config.humanColor : undefined,
      scoringRule: config.scoringRule,
      result: { black: finalScore.black, white: finalScore.white, winner },
      sgf,
    }).then((id) => {
      setJustSaved(true)
      setSavedGameId(id)

      // Chequeo de reapertura (una sola vez, aca, no en Hoy): si se hiciera
      // en Hoy cada vez que se abre la pantalla, releer una leccion ya
      // reabierta sin jugar una partida nueva la volveria a marcar como no
      // leida de la nada. Evaluando solo cuando se guarda una partida nueva,
      // "reabrir" es un evento real (esta partida disparo el patron), no un
      // estado que se reafirma solo. listGames() para incluir esta partida
      // recien guardada, no solo las anteriores.
      listGames().then((allGames) => {
        for (const conceptId of findConceptsToReopen(allGames)) {
          const lesson = getLesson(CONCEPTS[conceptId].lessonId)
          if (lesson) reopenLesson(lesson.id, conceptId)
        }
      })
    })
  }, [game.gameOver, finalScore, config, moves])

  const turnKey = game.toMove === BLACK ? 'board.turn.black' : 'board.turn.white'
  const strengthLevel = STRENGTH_LEVELS.find((level) => level.id === config.strengthId)

  return (
    <div className="play-game">
      <p className="play-game-header">
        {config.width}x{config.height} ·{' '}
        {config.mode === 'bot'
          ? t('play.bot.label', { kyu: strengthLevel?.approxKyu ?? 0 })
          : t('play.mode.local')}
        {config.mode === 'bot' && config.botStyle !== 'standard' && <> · {t(BOT_STYLE_LABEL_KEY[config.botStyle])}</>}
      </p>

      <BoardCanvas
        width={config.width}
        height={config.height}
        stones={game.board.stones}
        lastMove={lastMove}
        territory={territory}
        theme={theme}
        onIntersectionClick={handleIntersectionClick}
      />

      <div className="status" aria-live="polite">
        {game.gameOver ? (
          <p className="turn">{t('board.gameOver')}</p>
        ) : botThinking ? (
          <p className="turn">{t('play.thinking')}</p>
        ) : (
          <p className="turn">{t(turnKey)}</p>
        )}
        {message && <p className="illegal-message">{t(`board.illegal.${message}`)}</p>}
        {botError && <p className="illegal-message">{t('engine.error')}</p>}
        <p className="captures">
          {t('board.captures')}: {t('board.captures.black')} {game.captures.black} · {t('board.captures.white')}{' '}
          {game.captures.white}
        </p>
        {showCount && (
          <p className="play-count-panel">
            {t('play.count.estimate', { black: liveScore.black, white: liveScore.white })}
          </p>
        )}
      </div>

      {!game.gameOver && (
        <PlayInGameControls
          onUndo={handleUndo}
          undoDisabled={moves.length === 0}
          onPass={handlePass}
          passDisabled={!isHumanTurn()}
          showCount={showCount}
          onToggleCount={() => setShowCount((v) => !v)}
          onExit={() => setShowExitConfirm(true)}
        />
      )}

      {game.gameOver && (
        <section className="play-end-panel">
          <h3>{t('play.result.title')}</h3>
          {finalScore && (
            <p className="result">
              {t('color.black')} {finalScore.black} - {t('color.white')} {finalScore.white} (
              {finalScore.black > finalScore.white ? t('play.result.winnerBlack') : t('play.result.winnerWhite')})
            </p>
          )}
          {config.scoringRule === 'japanese' && <p className="settings-description">{t('play.scoringRule.japaneseBadge')}</p>}
          {justSaved && <p className="saved-note">{t('play.saved')}</p>}
          <div className="play-end-actions">
            <button
              type="button"
              disabled={savedGameId === null}
              onClick={() => savedGameId !== null && onNavigateToReview(savedGameId)}
            >
              {t('play.end.review')}
            </button>
            <button type="button" onClick={onExitToConfig}>
              {t('play.end.playAgain')}
            </button>
            <button type="button" onClick={onNavigateToToday}>
              {t('play.end.today')}
            </button>
          </div>
        </section>
      )}

      {showExitConfirm && (
        <ConfirmDialog
          title={t('play.exitConfirm.title')}
          message={t('play.exitConfirm.message')}
          confirmLabel={t('play.exitConfirm.confirm')}
          cancelLabel={t('play.exitConfirm.cancel')}
          onConfirm={() => {
            setShowExitConfirm(false)
            onExitToConfig()
          }}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}
    </div>
  )
}
