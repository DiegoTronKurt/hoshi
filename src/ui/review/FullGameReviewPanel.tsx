import { useState } from 'react'
import type { RecordedMove } from '../../core/sgf'
import { BLACK } from '../../core/types'
import type { EvalBackend } from '../../eval/backend'
import { useI18n } from '../../i18n'
import { useSettings } from '../settings'
import { BoardCanvas } from '../board/BoardCanvas'
import { buildFullGameEvalPositions, explainSwing, formatSwingPercent, summarizeWinRates } from './fullGameReview'
import type { SwingExplanation, WinRatePoint, WinRateSwing } from './fullGameReview'
import { stateAtMove } from './reviewState'
import { WinRateChart } from './WinRateChart'

/** Mismo tamano que la medicion real contra el modelo vendorizado (ver el
 * comentario de evaluatePositionsBatch en eval/model.ts): el costo por
 * llamada es practicamente constante entre lote 1 y 32, asi que juntar de a
 * 32 evita pagar el overhead fijo por jugada al recorrer una partida entera
 * sin aventurarse a un tamano de lote nunca medido contra el modelo real. */
const EVAL_BATCH_SIZE = 32
const TOP_SWINGS_SHOWN = 5

interface FullGameReviewPanelProps {
  /** Sin SavedGameRecord a proposito: tambien lo usa HistoricGamesScreen
   * sobre contenido fijo (content/historicGames.ts) que nunca pasa por
   * storage/db.ts -- las unicas 3 partes de una partida que esta pantalla
   * necesita de verdad. */
  width: number
  height: number
  komi: number
  moves: RecordedMove[]
  evalClient: EvalBackend | null
}

interface FullGameReviewResult {
  curve: WinRatePoint[]
  swings: WinRateSwing[]
}

/**
 * Complemento de la deteccion de errores por concepto (ver ReviewScreen):
 * en vez de reconocer patrones especificos, recorre la partida entera
 * jugada a jugada preguntandole a la red su probabilidad de victoria en
 * cada posicion (una sola pasada por posicion, sin busqueda -- mismo tipo
 * de consulta que ReviewMistakeBoard::askAi, ver su disclaimer) y arma una
 * curva mas la lista de mayores caidas. Un componente propio (no dentro de
 * ReviewScreen) siguiendo el mismo patron que ReviewMistakeBoard: estado
 * propio, se reinicia solo (la key que le pasa ReviewScreen cambia con la
 * partida seleccionada), sin logica de reset explicita.
 */
export function FullGameReviewPanel({ width, height, komi, moves, evalClient }: FullGameReviewPanelProps) {
  const { t } = useI18n()
  const { theme } = useSettings()
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<FullGameReviewResult | null>(null)
  const [swingExplanations, setSwingExplanations] = useState<Map<number, SwingExplanation>>(new Map())
  const [expandedSwing, setExpandedSwing] = useState<number | null>(null)

  async function analyze() {
    if (!evalClient) return
    setStatus('loading')
    setExpandedSwing(null)
    try {
      const positions = buildFullGameEvalPositions(width, height, komi, moves)
      setProgress({ done: 0, total: positions.length })
      const values: number[] = []
      // Se guarda la politica cruda de cada posicion (no solo value[0]) para
      // poder explicar los mayores vaivenes despues -- ver explainSwing en
      // fullGameReview.ts. El costo de memoria es chico incluso para una
      // partida larga (362 floats por posicion).
      const policies: Float32Array[] = []
      for (let i = 0; i < positions.length; i += EVAL_BATCH_SIZE) {
        const chunk = positions.slice(i, i + EVAL_BATCH_SIZE)
        // Timeout generoso (igual criterio que el default de EvalClient):
        // este analisis es un clic manual y tolerante, no debe cortarse
        // solo porque un lote de 32 posiciones tarda mas en un dispositivo
        // lento.
        const chunkResults = await evalClient.evaluateBatch(chunk, 30000)
        for (const r of chunkResults) {
          values.push(r.value[0])
          policies.push(r.policy)
        }
        setProgress({ done: values.length, total: positions.length })
      }
      const summary = summarizeWinRates(moves, values)
      const explanations = new Map<number, SwingExplanation>()
      for (const swing of summary.swings.slice(0, TOP_SWINGS_SHOWN)) {
        const beforeState = stateAtMove(width, height, komi, moves, swing.moveNumber - 1)
        explanations.set(swing.moveNumber, explainSwing(policies[swing.moveNumber - 1], beforeState, swing.point))
      }
      setSwingExplanations(explanations)
      setResult(summary)
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  if (!evalClient) return null

  return (
    <section className="review-full-analysis">
      {!result && (
        <button type="button" className="review-ask-ai" onClick={analyze} disabled={status === 'loading'}>
          {status === 'loading'
            ? t('review.fullAnalysis.progress', { done: progress?.done ?? 0, total: progress?.total ?? 0 })
            : t('review.fullAnalysis.button')}
        </button>
      )}

      {status === 'error' && <p className="review-ai-error">{t('engine.error')}</p>}

      {result && (
        <div className="review-full-analysis-result">
          <h3>{t('review.fullAnalysis.title')}</h3>
          <WinRateChart
            curve={result.curve}
            highlightMoveNumbers={result.swings.slice(0, TOP_SWINGS_SHOWN).map((s) => s.moveNumber)}
            blackLabel={t('color.black')}
            whiteLabel={t('color.white')}
            ariaLabel={t('review.fullAnalysis.title')}
          />
          <p className="review-ai-disclaimer">{t('review.aiDisclaimer')}</p>

          {result.swings.length > 0 && (
            <>
              <h4>{t('review.fullAnalysis.swingsTitle')}</h4>
              <ul className="review-full-analysis-swings">
                {result.swings.slice(0, TOP_SWINGS_SHOWN).map((swing) => {
                  const expanded = expandedSwing === swing.moveNumber
                  const explanation = swingExplanations.get(swing.moveNumber) ?? null
                  return (
                    <li key={swing.moveNumber}>
                      <button
                        type="button"
                        className="review-full-analysis-swing-toggle"
                        aria-expanded={expanded}
                        onClick={() => setExpandedSwing(expanded ? null : swing.moveNumber)}
                      >
                        <span>
                          {t('review.moveNumber', { n: swing.moveNumber })} ·{' '}
                          {t(swing.color === BLACK ? 'color.black' : 'color.white')}
                        </span>
                        <span className="review-full-analysis-swing-amount">
                          {t('review.fullAnalysis.swingAmount', { percent: Math.round(swing.swing * 100) })}
                        </span>
                      </button>
                      {expanded && (
                        <div className="review-board">
                          {explanation && (
                            <p className="review-full-analysis-swing-explanation">
                              {explanation.rank === 1
                                ? t('review.fullAnalysis.swingExplanation.wasFavorite', {
                                    percent: formatSwingPercent(explanation.playedProbability),
                                  })
                                : t('review.fullAnalysis.swingExplanation.wasSurprising', {
                                    percent: formatSwingPercent(explanation.playedProbability),
                                    rank: explanation.rank,
                                    total: explanation.candidateCount,
                                    topPercent: formatSwingPercent(explanation.topProbability),
                                  })}
                            </p>
                          )}
                          <BoardCanvas
                            width={width}
                            height={height}
                            stones={stateAtMove(width, height, komi, moves, swing.moveNumber).board.stones}
                            lastMove={swing.point}
                            theme={theme}
                            onIntersectionClick={() => {}}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}
