import { useEffect, useMemo, useRef, useState } from 'react'
import { CONCEPTS } from '../../analysis/concepts'
import { createBoard } from '../../core/board'
import { applyMove, createGame, gameStateFromBoard, listLegalMoves } from '../../core/rules'
import { computeAreaOwnership, computeAreaScore, computeTerritoryScore } from '../../core/scoring'
import type { AreaScore } from '../../core/scoring'
import { gameRecordToSgf } from '../../core/sgf'
import type { RecordedMove } from '../../core/sgf'
import { BLACK, WHITE } from '../../core/types'
import type { GameState, IllegalReason } from '../../core/types'
import { EngineClient } from '../../engine/client'
import { EvalClient } from '../../eval/client'
import { EVAL_MODEL_URL } from '../../eval/modelUrl'
import { blendWithUniform, legalPolicyDistribution } from '../../eval/policy'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { getLesson } from '../../content/lessons'
import { goBack } from '../../navigation/backNav'
import { reportLocalBack } from '../../navigation/localBack'
import { listGames, saveGame } from '../../storage/db'
import { findConceptsToReopen } from '../../training-policy/session'
import { BoardCanvas } from '../board/BoardCanvas'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { reopenLesson } from '../lessons/readProgress'
import { useSettings } from '../settings'
import { PlayInGameControls } from './PlayInGameControls'
import type { PlayConfig } from './playConfig'
import { STRENGTH_LEVELS } from './strengthLevels'

/** Respaldo corto para la evaluacion de red DENTRO de una partida: es una
 * mejora invisible antes de que el bot juegue, no debe poder trabar el
 * turno por mucho tiempo si falla o el dispositivo es lento -- muy por
 * debajo del respaldo de 20s de EvalClient, pensado para el clic manual y
 * tolerante de Revisar. Medido en esta sesion con Chromium/WebGL real:
 * ~350ms en caliente, ~2.1s la primera vez (carga del modelo) -- 5000ms deja
 * margen de sobra para ambos casos en un dispositivo bastante mas lento. */
const EVAL_TIMEOUT_IN_GAME_MS = 5000

const KOMI = 6.5
/** Komi reducido estandar cuando hay piedras de handicap -- solo evita un
 * empate, no intenta replicar ninguna tabla de komi por cantidad de piedras. */
const HANDICAP_KOMI = 0.5

const MAX_HINTS_PER_GAME = 5

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

  const komi = config.handicapStones && config.handicapStones.length > 0 ? HANDICAP_KOMI : KOMI

  const [history, setHistory] = useState<GameState[]>(() => {
    if (config.handicapStones && config.handicapStones.length > 0) {
      const board = createBoard(config.width, config.height)
      for (const p of config.handicapStones) board.stones[p] = BLACK
      return [gameStateFromBoard(board, WHITE, komi)]
    }
    if (config.initialStones) {
      return [
        gameStateFromBoard(
          { width: config.width, height: config.height, stones: config.initialStones },
          config.initialToMove ?? BLACK,
          komi,
        ),
      ]
    }
    return [createGame(config.width, config.height, komi)]
  })
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

  // Boton fisico "atras" de Android: con la partida en curso, primero abre
  // el mismo dialogo de confirmacion que el boton de salir en pantalla (no
  // se sale en silencio de una partida sin terminar); con la partida ya
  // terminada no hay nada que proteger, se sale directo -- ver
  // navigation/localBack.ts. Nivel aparte del de PlayScreen (config <-> game):
  // este componente es el que esta montado de verdad mientras se juega.
  useEffect(() => {
    reportLocalBack(() => {
      if (showExitConfirm) {
        setShowExitConfirm(false)
        return true
      }
      if (game.gameOver) {
        onExitToConfig()
        return true
      }
      setShowExitConfirm(true)
      return true
    }, showExitConfirm ? 2 : 1)
    return () => reportLocalBack(null, 0)
  }, [showExitConfirm, game.gameOver, onExitToConfig])

  const engineRef = useRef<EngineClient | null>(null)
  const evalRef = useRef<EvalClient | null>(null)
  const savedThisGameRef = useRef(false)
  // Cliente de red propio para la pista, separado de evalRef: ese solo existe
  // cuando config.mode==='bot' && netInfluence>0 (ver el efecto de abajo), pero
  // la pista tiene que funcionar tambien en partida local y en fuerza `weak`
  // -- se crea recien al primer clic, no de arranque, para no pagar la carga
  // del modelo (~11.5MB) en partidas donde nunca se pide una pista.
  const hintEvalRef = useRef<EvalClient | null>(null)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [hintPoint, setHintPoint] = useState<number | null>(null)
  const [hintLoading, setHintLoading] = useState(false)
  // Captura el tablero inicial una sola vez, para precalentar la red sin
  // depender de `history` (que cambia en cada jugada -- no queremos que el
  // efecto de abajo se repita por eso).
  const initialGameRef = useRef(history[0])

  useEffect(() => {
    engineRef.current = new EngineClient()
    return () => engineRef.current?.terminate()
  }, [])

  useEffect(() => {
    if (config.mode !== 'bot') return
    const strength = STRENGTH_LEVELS.find((level) => level.id === config.strengthId) ?? STRENGTH_LEVELS[1]
    if (strength.netInfluence <= 0) return

    const client = new EvalClient(EVAL_MODEL_URL)
    evalRef.current = client
    // Precalienta el modelo (~11.5MB, ~2s la primera vez, ver
    // EVAL_TIMEOUT_IN_GAME_MS) apenas arranca la partida, para que la
    // primera jugada real del bot no pague esa carga completa -- resultado
    // ignorado a proposito, es pura carga en caliente.
    client.evaluate({ state: initialGameRef.current }).catch(() => {})
    return () => client.terminate()
  }, [config.mode, config.strengthId])

  useEffect(() => {
    onActiveChange(!game.gameOver)
    return () => onActiveChange(false)
  }, [game.gameOver, onActiveChange])

  useEffect(() => () => hintEvalRef.current?.terminate(), [])

  // El anillo de la pista es de una posicion puntual: se borra en cuanto se
  // juega cualquier jugada real (propia, del bot, o un undo), para no dejarlo
  // pegado sobre un tablero que ya cambio.
  useEffect(() => {
    setHintPoint(null)
  }, [game])

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

  const hintDisabled = !config.hintsEnabled || !isHumanTurn() || hintsUsed >= MAX_HINTS_PER_GAME || hintLoading

  async function handleHint() {
    if (hintDisabled) return
    setHintLoading(true)
    try {
      if (!hintEvalRef.current) hintEvalRef.current = new EvalClient(EVAL_MODEL_URL)
      const recentMoves = moves.slice(Math.max(0, moves.length - 5))
      const priorBoards = [history[history.length - 3]?.board, history[history.length - 2]?.board].filter(
        (b): b is GameState['board'] => b !== undefined,
      )
      // Sin timeout corto a proposito: es un clic manual y tolerante de la
      // persona jugando, no el paso invisible antes de la jugada del bot --
      // usa el default de 20s de EvalClient, igual que "Preguntarle a la IA"
      // en Revisar (ReviewMistakeBoard.tsx), no EVAL_TIMEOUT_IN_GAME_MS.
      const output = await hintEvalRef.current.evaluate({ state: game, recentMoves, priorBoards })
      const legal = listLegalMoves(game)
      const legalPoints = legal.filter((p): p is number => p !== null)
      const legalPass = legal.includes(null)
      const distribution = legalPolicyDistribution(output.policy, legalPoints, legalPass, game.board.width)
      let topPoint: number | null = null
      let topProbability = -1
      for (const [point, probability] of distribution) {
        if (probability > topProbability) {
          topProbability = probability
          topPoint = point
        }
      }
      setHintPoint(topPoint)
      // Se descuenta siempre que la consulta responda, aun si la red
      // sugiere pasar (topPoint null, sin anillo visible) -- fue un uso
      // real, no se reintenta gratis por un resultado poco util.
      setHintsUsed((prev) => prev + 1)
    } catch {
      // Silencioso, mismo criterio que la guia de red del bot: una pista
      // fallida no debe interrumpir la partida ni gastar un uso.
    } finally {
      setHintLoading(false)
    }
  }

  // El bot juega automaticamente cuando le toca a el en modo "Contra el bot".
  // Si el nivel de fuerza pide guia de red (netInfluence > 0), primero le
  // pregunta a la red por una prioridad de jugadas de raiz (una sola
  // evaluacion, no una por playout -- ver engine/mcts.ts::MctsOptions.rootPriors)
  // y se la pasa al motor; si eso falla o tarda demasiado, sigue con MCTS
  // llano sin avisar -- es una mejora invisible, su falla no debe alarmar ni
  // trabar al bot.
  useEffect(() => {
    if (config.mode !== 'bot' || game.gameOver || game.toMove === config.humanColor) return
    const engine = engineRef.current
    if (!engine) return

    const strength = STRENGTH_LEVELS.find((level) => level.id === config.strengthId) ?? STRENGTH_LEVELS[1]
    let cancelled = false
    setBotThinking(true)
    setBotError(false)

    async function playBotMove(engine: EngineClient) {
      let rootPriors: Map<number | null, number> | undefined
      const evalClient = evalRef.current
      if (evalClient && strength.netInfluence > 0) {
        try {
          const recentMoves = moves.slice(Math.max(0, moves.length - 5))
          const priorBoards = [history[history.length - 3]?.board, history[history.length - 2]?.board].filter(
            (b): b is GameState['board'] => b !== undefined,
          )
          const output = await evalClient.evaluate({ state: game, recentMoves, priorBoards }, EVAL_TIMEOUT_IN_GAME_MS)
          const legal = listLegalMoves(game)
          const legalPoints = legal.filter((p): p is number => p !== null)
          const legalPass = legal.includes(null)
          const distribution = legalPolicyDistribution(output.policy, legalPoints, legalPass, game.board.width)
          rootPriors = blendWithUniform(distribution, strength.netInfluence)
        } catch {
          rootPriors = undefined
        }
      }
      if (cancelled) return

      try {
        const response = await engine.chooseMove(game, strength.playouts, undefined, strength.maxTimeMs, config.botStyle, rootPriors)
        if (cancelled) return
        setBotThinking(false)
        const color = game.toMove
        const result = applyMove(game, response.move)
        if (!result.legal || !result.state) return
        setMoves((prev) => [...prev, { color, point: response.move }])
        setHistory((prev) => [...prev, result.state as GameState])
        if (response.move !== null) playStoneSoundIfEnabled()
      } catch {
        if (cancelled) return
        setBotThinking(false)
        setBotError(true)
      }
    }

    playBotMove(engine)

    return () => {
      cancelled = true
    }
  }, [game, moves, history, config.mode, config.humanColor, config.strengthId, config.botStyle, playStoneSoundIfEnabled])

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
    const sgf = gameRecordToSgf(config.width, config.height, komi, moves)

    saveGame({
      createdAt: new Date().toISOString(),
      width: config.width,
      height: config.height,
      komi,
      mode: config.mode,
      botPlayouts: config.mode === 'bot' ? strength?.playouts : undefined,
      botStrengthId: config.mode === 'bot' ? strength?.id : undefined,
      botStyle: config.mode === 'bot' ? config.botStyle : undefined,
      humanColor: config.mode === 'bot' ? config.humanColor : undefined,
      scoringRule: config.scoringRule,
      handicapCount: config.handicapStones && config.handicapStones.length > 0 ? config.handicapStones.length : undefined,
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
  }, [game.gameOver, finalScore, config, moves, komi])

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
        hintMove={hintPoint}
        territory={territory}
        theme={theme}
        onIntersectionClick={handleIntersectionClick}
      />
      {hintPoint !== null && <p className="review-hint-legend">{t('play.hint.legend')}</p>}

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
          hintVisible={config.hintsEnabled}
          onHint={handleHint}
          hintDisabled={hintDisabled}
          hintsRemaining={MAX_HINTS_PER_GAME - hintsUsed}
          hintLoading={hintLoading}
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
          onCancel={goBack}
        />
      )}
    </div>
  )
}
