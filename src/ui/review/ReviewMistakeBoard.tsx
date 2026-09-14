import { useState } from 'react'
import { listLegalMoves } from '../../core/rules'
import { BLACK } from '../../core/types'
import type { GameState } from '../../core/types'
import type { RecordedMove } from '../../core/sgf'
import type { EvalBackend } from '../../eval/backend'
import type { EvalPosition, EvalMove } from '../../eval/features'
import { topLegalPoint } from '../../eval/policy'
import { DEEP_ANALYZE_DEFAULT_PLAYOUTS } from '../../engine/mctsNet'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { gameHeight, gameWidth } from '../../storage/db'
import type { SavedGameRecord } from '../../storage/db'
import { BoardCanvas } from '../board/BoardCanvas'
import type { BoardTheme } from '../board/themes'
import type { Mistake } from './ReviewScreen'
import { formatWinProbabilityPercent } from './fullGameReview'
import { bucketOwnership, stateAtMove } from './reviewState'

interface ReviewMistakeBoardProps {
  game: SavedGameRecord
  moves: RecordedMove[]
  event: Mistake
  boardState: GameState
  theme: BoardTheme
  evalClient: EvalBackend | null
}

interface AiResult {
  /** Probabilidad de victoria de event.color (quien cometio el error),
   * ya en su propia perspectiva -- ver la nota de evalState mas abajo,
   * no hace falta invertir signo aca. */
  winProbability: number
  topPoint: number | null
  territory: Int8Array
}

interface DeepResult {
  /** Misma perspectiva/convencion que AiResult.winProbability (ver
   * EvalBackend.analyzeDeeply) -- viene de una busqueda PUCT real
   * (engine/mctsNet.ts), no de una sola pasada hacia adelante. */
  winProbability: number
  topPoint: number | null
  playoutsRun: number
}

export function ReviewMistakeBoard({ game, moves, event, boardState, theme, evalClient }: ReviewMistakeBoardProps) {
  const { t } = useI18n()
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [aiResult, setAiResult] = useState<AiResult | null>(null)
  const [deepState, setDeepState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [deepResult, setDeepResult] = useState<DeepResult | null>(null)

  const canAskAi = evalClient !== null && event.conceptId !== 'GRUPO_MURIO_SIN_OJOS'
  // No repite el chequeo de conceptId: solo se ofrece una vez que ya hay
  // aiResult (ver el boton mas abajo), y aiResult nunca se llena para
  // GRUPO_MURIO_SIN_OJOS porque canAskAi ya lo excluye antes.
  const canAnalyzeDeeply = evalClient !== null && evalClient.supportsDeepAnalysis

  /** Posicion evaluable compartida por askAi y analyzeDeeply -- ver el
   * comentario de mas abajo sobre por que es un ply antes de boardState.
   * Ambas acciones necesitan exactamente el mismo {state, recentMoves,
   * priorBoards}, solo cambia que hacen con el (una pasada vs. una
   * busqueda). */
  function buildEvalPosition(): EvalPosition & { width: number } {
    // Un ply antes de boardState a proposito: boardState ya incluye la
    // jugada del error (es la vista "ya jugado, mira el anillo de lo que
    // debiste jugar"), asi que su toMove es el RIVAL de quien se
    // equivoco. Preguntarle a la red por boardState le daria la
    // perspectiva del rival -- "como aprovechar este error" -- no la
    // de la persona que lo cometio. Ver NOTAS.md para el detalle
    // completo de este hallazgo.
    const evalMoveNumber = event.moveNumber - 1
    const width = gameWidth(game)
    const height = gameHeight(game)
    const state = stateAtMove(width, height, game.komi, moves, evalMoveNumber)
    const recentMoves: EvalMove[] = moves.slice(Math.max(0, evalMoveNumber - 5), evalMoveNumber)
    const priorBoards = [
      stateAtMove(width, height, game.komi, moves, evalMoveNumber - 2).board,
      stateAtMove(width, height, game.komi, moves, evalMoveNumber - 1).board,
    ]
    return { state, recentMoves, priorBoards, width }
  }

  async function askAi() {
    if (!evalClient) return
    setAiState('loading')
    try {
      const { state: evalState, recentMoves, priorBoards, width } = buildEvalPosition()
      const output = await evalClient.evaluate({ state: evalState, recentMoves, priorBoards })

      const legal = listLegalMoves(evalState)
      const legalPoints = legal.filter((p): p is number => p !== null)
      const legalPass = legal.includes(null)
      const topPoint = topLegalPoint(output.policy, legalPoints, legalPass, width)

      setAiResult({
        winProbability: output.value[0],
        topPoint,
        territory: bucketOwnership(output.ownership, evalState),
      })
      setAiState('idle')
    } catch {
      setAiState('error')
    }
  }

  async function analyzeDeeply() {
    if (!evalClient || !evalClient.supportsDeepAnalysis) return
    setDeepState('loading')
    try {
      const { state, recentMoves, priorBoards } = buildEvalPosition()
      const result = await evalClient.analyzeDeeply({ state, recentMoves, priorBoards }, DEEP_ANALYZE_DEFAULT_PLAYOUTS)
      setDeepResult({ winProbability: result.winRate, topPoint: result.move, playoutsRun: result.playoutsRun })
      setDeepState('idle')
    } catch {
      setDeepState('error')
    }
  }

  const aiHintMove = aiResult && aiResult.topPoint !== null && aiResult.topPoint !== event.point ? aiResult.topPoint : null
  const deepHintMove =
    deepResult && deepResult.topPoint !== null && deepResult.topPoint !== event.point ? deepResult.topPoint : null
  const aiAgrees = aiResult !== null && aiResult.topPoint === event.point
  const deepAgrees = deepResult !== null && deepResult.topPoint === event.point
  const hintMove = deepHintMove ?? aiHintMove ?? (event.suggestedPoint ?? null)
  const colorKey: TranslationKey = event.color === BLACK ? 'color.black' : 'color.white'

  return (
    <div className="review-board">
      <BoardCanvas
        width={gameWidth(game)}
        height={gameHeight(game)}
        stones={boardState.board.stones}
        lastMove={event.point}
        hintMove={hintMove}
        territory={aiResult?.territory ?? null}
        theme={theme}
        onIntersectionClick={() => {}}
      />

      {deepHintMove !== null ? (
        <p className="review-hint-legend">{t('review.deepSuggestedMove')}</p>
      ) : aiHintMove !== null ? (
        <p className="review-hint-legend">{t('review.aiSuggestedMove')}</p>
      ) : (
        event.suggestedPoint !== undefined && <p className="review-hint-legend">{t('review.suggestedMove')}</p>
      )}

      {canAskAi && !aiResult && (
        <button type="button" className="review-ask-ai" onClick={askAi} disabled={aiState === 'loading'}>
          {aiState === 'loading' ? t('review.aiThinking') : t('review.askAi')}
        </button>
      )}

      {aiState === 'error' && <p className="review-ai-error">{t('engine.error')}</p>}

      {aiResult && (
        <div className="review-ai-panel">
          <p className="review-ai-winprob">
            {t('review.aiWinProbability', { color: t(colorKey), percent: formatWinProbabilityPercent(aiResult.winProbability) })}
          </p>
          {aiAgrees && <p>{t('review.aiAgreesWithMove')}</p>}
          <p className="review-ai-disclaimer">{t('review.winProbabilityExplainer')}</p>
          <p className="review-ai-disclaimer">{t('review.aiDisclaimer')}</p>
        </div>
      )}

      {canAnalyzeDeeply && aiResult && !deepResult && (
        <button type="button" className="review-ask-ai" onClick={analyzeDeeply} disabled={deepState === 'loading'}>
          {deepState === 'loading' ? t('review.analyzingDeeply') : t('review.analyzeDeeply')}
        </button>
      )}

      {deepState === 'error' && <p className="review-ai-error">{t('engine.error')}</p>}

      {deepResult && (
        <div className="review-ai-panel">
          <p className="review-ai-winprob">
            {t('review.deepWinProbability', {
              color: t(colorKey),
              percent: formatWinProbabilityPercent(deepResult.winProbability),
              playouts: deepResult.playoutsRun,
            })}
          </p>
          {deepAgrees && <p>{t('review.deepAgreesWithMove')}</p>}
          <p className="review-ai-disclaimer">{t('review.winProbabilityExplainer')}</p>
          <p className="review-ai-disclaimer">{t('review.deepDisclaimer', { playouts: deepResult.playoutsRun })}</p>
        </div>
      )}
    </div>
  )
}
