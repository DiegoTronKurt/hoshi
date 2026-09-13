import { useState } from 'react'
import { createBoard } from '../../core/board'
import { gameStateFromBoard, listLegalMoves } from '../../core/rules'
import { BLACK, EMPTY, WHITE } from '../../core/types'
import type { Color } from '../../core/types'
import type { EvalBackend } from '../../eval/backend'
import { topLegalPoint } from '../../eval/policy'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { BoardCanvas } from '../board/BoardCanvas'
import { useSettings } from '../settings'

interface DojoScreenProps {
  evalClient: EvalBackend | null
  onBack: () => void
}

const SIZES = [9, 13, 19] as const

// Mismo komi estandar que Jugar (PlayGameScreen.tsx::KOMI) -- el Dojo no
// ofrece un selector propio de komi, para no multiplicar controles en una
// primera version de la herramienta; una posicion libre ya es suficiente
// libertad sin necesitar tambien variar la regla de puntaje.
const DOJO_KOMI = 6.5

function cycleStone(current: number): number {
  if (current === EMPTY) return BLACK
  if (current === BLACK) return WHITE
  return EMPTY
}

interface Analysis {
  winProbability: number
  topPoint: number | null
}

/**
 * C2 del roadmap ("modo de analisis libre / dojo"): a diferencia de
 * Revisar/Partidas historicas (que analizan una partida real jugada por
 * alguien), aca la posicion es la que arma la persona, piedra por piedra --
 * util para probar "que dice la red de ESTA forma" sin tener que jugarla o
 * importarla primero. Reusa EvalClient/topLegalPoint/BoardCanvas tal cual
 * (gameStateFromBoard ya construye un GameState fresco y valido a partir de
 * cualquier tablero -- sin historial que violar, no hace falta nada nuevo
 * en el motor de reglas).
 */
export function DojoScreen({ evalClient, onBack }: DojoScreenProps) {
  const { t } = useI18n()
  const { theme } = useSettings()
  const [size, setSize] = useState(9)
  const [stones, setStones] = useState(() => createBoard(9).stones)
  const [toMove, setToMove] = useState<Color>(BLACK)
  const [analysisState, setAnalysisState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)

  function resetBoard(nextSize: number) {
    setSize(nextSize)
    setStones(createBoard(nextSize).stones)
    setToMove(BLACK)
    setAnalysis(null)
    setAnalysisState('idle')
  }

  function handleIntersectionClick(point: number) {
    setAnalysis(null)
    setAnalysisState('idle')
    setStones((prev) => {
      const next = new Int8Array(prev)
      next[point] = cycleStone(prev[point])
      return next
    })
  }

  function handleToMove(color: Color) {
    setToMove(color)
    setAnalysis(null)
    setAnalysisState('idle')
  }

  async function handleAnalyze() {
    if (!evalClient) return
    setAnalysisState('loading')
    try {
      const state = gameStateFromBoard({ width: size, height: size, stones }, toMove, DOJO_KOMI)
      const output = await evalClient.evaluate({ state })
      const legal = listLegalMoves(state)
      const legalPoints = legal.filter((p): p is number => p !== null)
      const legalPass = legal.includes(null)
      const topPoint = topLegalPoint(output.policy, legalPoints, legalPass, size)
      setAnalysis({ winProbability: output.value[0], topPoint })
      setAnalysisState('idle')
    } catch {
      setAnalysisState('error')
    }
  }

  const colorKey: TranslationKey = toMove === BLACK ? 'color.black' : 'color.white'

  return (
    <div className="review dojo">
      <div className="review-header">
        <button type="button" onClick={onBack}>
          {t('review.backToList')}
        </button>
        <h2>{t('dojo.title')}</h2>
      </div>
      <p className="lesson-paragraph">{t('dojo.intro')}</p>

      <div className="exercises-controls" role="group" aria-label={t('dojo.sizeLabel')}>
        {SIZES.map((option) => (
          <button
            key={option}
            type="button"
            className={option === size ? 'active' : ''}
            aria-pressed={option === size}
            onClick={() => resetBoard(option)}
          >
            {option}x{option}
          </button>
        ))}
      </div>

      <div className="exercises-controls" role="group" aria-label={t('dojo.toMoveLabel')}>
        <button
          type="button"
          className={toMove === BLACK ? 'active' : ''}
          aria-pressed={toMove === BLACK}
          onClick={() => handleToMove(BLACK)}
        >
          {t('color.black')}
        </button>
        <button
          type="button"
          className={toMove === WHITE ? 'active' : ''}
          aria-pressed={toMove === WHITE}
          onClick={() => handleToMove(WHITE)}
        >
          {t('color.white')}
        </button>
      </div>

      <BoardCanvas
        width={size}
        height={size}
        stones={stones}
        lastMove={null}
        hintMove={analysis?.topPoint ?? null}
        theme={theme}
        onIntersectionClick={handleIntersectionClick}
      />

      <div className="exercises-controls">
        <button type="button" onClick={() => resetBoard(size)}>
          {t('dojo.clear')}
        </button>
        <button type="button" className="primary" onClick={handleAnalyze} disabled={!evalClient || analysisState === 'loading'}>
          {analysisState === 'loading' ? t('review.aiThinking') : t('dojo.analyze')}
        </button>
      </div>

      {analysisState === 'error' && <p className="review-ai-error">{t('engine.error')}</p>}

      {analysis && (
        <div className="review-ai-panel">
          <p className="review-ai-winprob">
            {t('review.aiWinProbability', { color: t(colorKey), percent: Math.round(analysis.winProbability * 100) })}
          </p>
          {analysis.topPoint !== null && <p className="review-hint-legend">{t('review.aiSuggestedMove')}</p>}
          <p className="review-ai-disclaimer">{t('review.aiDisclaimer')}</p>
        </div>
      )}
    </div>
  )
}
