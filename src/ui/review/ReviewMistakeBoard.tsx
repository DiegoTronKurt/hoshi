import { useState } from 'react'
import { listLegalMoves } from '../../core/rules'
import { BLACK } from '../../core/types'
import type { GameState } from '../../core/types'
import type { RecordedMove } from '../../core/sgf'
import type { EvalClient } from '../../eval/client'
import { legalPolicyDistribution } from '../../eval/policy'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import type { SavedGameRecord } from '../../storage/db'
import { BoardCanvas } from '../board/BoardCanvas'
import type { BoardTheme } from '../board/themes'
import type { Mistake } from './ReviewScreen'
import { bucketOwnership, stateAtMove } from './reviewState'

interface ReviewMistakeBoardProps {
  game: SavedGameRecord
  moves: RecordedMove[]
  event: Mistake
  boardState: GameState
  theme: BoardTheme
  evalClient: EvalClient | null
}

interface AiResult {
  /** Probabilidad de victoria de event.color (quien cometio el error),
   * ya en su propia perspectiva -- ver la nota de evalState mas abajo,
   * no hace falta invertir signo aca. */
  winProbability: number
  topPoint: number | null
  territory: Int8Array
}

export function ReviewMistakeBoard({ game, moves, event, boardState, theme, evalClient }: ReviewMistakeBoardProps) {
  const { t } = useI18n()
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [aiResult, setAiResult] = useState<AiResult | null>(null)

  const canAskAi = evalClient !== null && event.conceptId !== 'GRUPO_MURIO_SIN_OJOS'

  async function askAi() {
    if (!evalClient) return
    setAiState('loading')
    try {
      // Un ply antes de boardState a proposito: boardState ya incluye la
      // jugada del error (es la vista "ya jugado, mira el anillo de lo que
      // debiste jugar"), asi que su toMove es el RIVAL de quien se
      // equivoco. Preguntarle a la red por boardState le daria la
      // perspectiva del rival -- "como aprovechar este error" -- no la
      // de la persona que lo cometio. Ver NOTAS.md para el detalle
      // completo de este hallazgo.
      const evalMoveNumber = event.moveNumber - 1
      const evalState = stateAtMove(game.size, game.komi, moves, evalMoveNumber)
      const recentMoves = moves.slice(Math.max(0, evalMoveNumber - 5), evalMoveNumber)
      const priorBoards = [
        stateAtMove(game.size, game.komi, moves, evalMoveNumber - 2).board,
        stateAtMove(game.size, game.komi, moves, evalMoveNumber - 1).board,
      ]

      const output = await evalClient.evaluate({ state: evalState, recentMoves, priorBoards })

      const legal = listLegalMoves(evalState)
      const legalPoints = legal.filter((p): p is number => p !== null)
      const legalPass = legal.includes(null)
      const distribution = legalPolicyDistribution(output.policy, legalPoints, legalPass)
      let topPoint: number | null = null
      let topProbability = -1
      for (const [point, probability] of distribution) {
        if (probability > topProbability) {
          topProbability = probability
          topPoint = point
        }
      }

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

  const aiHintMove = aiResult && aiResult.topPoint !== null && aiResult.topPoint !== event.point ? aiResult.topPoint : null
  const aiAgrees = aiResult !== null && aiResult.topPoint === event.point
  const hintMove = aiHintMove ?? (event.suggestedPoint ?? null)
  const colorKey: TranslationKey = event.color === BLACK ? 'color.black' : 'color.white'

  return (
    <div className="review-board">
      <BoardCanvas
        width={game.size}
        height={game.size}
        stones={boardState.board.stones}
        lastMove={event.point}
        hintMove={hintMove}
        territory={aiResult?.territory ?? null}
        theme={theme}
        onIntersectionClick={() => {}}
      />

      {aiHintMove !== null ? (
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
            {t('review.aiWinProbability', { color: t(colorKey), percent: Math.round(aiResult.winProbability * 100) })}
          </p>
          {aiAgrees && <p>{t('review.aiAgreesWithMove')}</p>}
          <p className="review-ai-disclaimer">{t('review.aiDisclaimer')}</p>
        </div>
      )}
    </div>
  )
}
