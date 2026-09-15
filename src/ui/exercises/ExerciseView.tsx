import { CONCEPTS } from '../../analysis/concepts'
import type { LoadedProblem } from '../../content/problemBank'
import { BLACK } from '../../core/types'
import type { GameState } from '../../core/types'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { BoardCanvas } from '../board/BoardCanvas'
import type { BoardTheme } from '../board/themes'
import { useSettings } from '../settings'
import type { ProblemStatus, WrongFlash } from './useSolvableExercise'

interface ExerciseViewProps {
  loaded: LoadedProblem
  game: GameState
  lastMove: number | null
  status: ProblemStatus
  thinking: boolean
  solverError: boolean
  solutionMoves: number | null
  wrongReason: TranslationKey | null
  wrongFlash: WrongFlash | null
  hintPoint: number | null
  hintLoading: boolean
  hintAvailable: boolean
  onHint: () => void
  theme: BoardTheme
  onIntersectionClick: (point: number) => void
  onPass: () => void
}

/** A quien le toca jugar, para la linea de metadatos (mismo criterio que
 * initialToMove en useSolvableExercise). */
function displayColor(loaded: LoadedProblem) {
  if (loaded.kind === 'tsumego') return loaded.problem.toMove
  if (loaded.kind === 'ladder') return loaded.problem.chaserColor
  if (loaded.kind === 'areaValue') return loaded.problem.toMove
  if (loaded.kind === 'semeaiLiberty') return loaded.problem.toMove
  return loaded.problem.color
}

/**
 * Tablero + linea de metadatos + estado, compartido entre Ejercicios y Hoy.
 * La linea de metadatos varia por tipo de problema: tsumego trae su propio
 * objetivo (vivir/matar); en una escalera el perseguidor siempre busca
 * capturar, asi que reutiliza el mismo texto "matar"; doble atari no tiene
 * un objetivo aparte que mostrar, el concepto ya lo dice todo.
 */
export function ExerciseView({
  loaded,
  game,
  lastMove,
  status,
  thinking,
  solverError,
  solutionMoves,
  wrongReason,
  wrongFlash,
  hintPoint,
  hintLoading,
  hintAvailable,
  onHint,
  theme,
  onIntersectionClick,
  onPass,
}: ExerciseViewProps) {
  const { t } = useI18n()
  const { coordinatesEnabled, gridThicknessMultiplier } = useSettings()
  const toMoveKey: TranslationKey = displayColor(loaded) === BLACK ? 'color.black' : 'color.white'

  return (
    <>
      <p className="exercises-meta">
        {t('exercises.concept')}: {t(`concept.${loaded.problem.conceptId}.label` as TranslationKey)} ·{' '}
        {t('exercises.toMove')} {t(toMoveKey)}
        {loaded.kind === 'tsumego' && (
          <>
            {' '}
            · {t(loaded.problem.objective === 'live' ? 'exercises.objective.live' : 'exercises.objective.kill')}
          </>
        )}
        {loaded.kind === 'ladder' && <> · {t('exercises.objective.kill')}</>}
        {loaded.kind === 'semeaiLiberty' && (
          <>
            {' '}
            ·{' '}
            {t(
              loaded.problem.conceptId === 'LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO'
                ? 'exercises.objective.sharedLiberty'
                : 'exercises.objective.behindGroup',
            )}
          </>
        )}
        {solutionMoves !== null && (
          <> · {solutionMoves === 1 ? t('exercises.solvesInOne') : t('exercises.solvesInMany', { count: solutionMoves })}</>
        )}
      </p>

      <BoardCanvas
        width={loaded.problem.board.width}
        height={loaded.problem.board.height}
        stones={game.board.stones}
        lastMove={lastMove}
        hintMove={hintPoint}
        wrongFlash={status === 'incorrect' ? wrongFlash : null}
        theme={theme}
        coordinatesEnabled={coordinatesEnabled}
        lineWidthMultiplier={gridThicknessMultiplier}
        onIntersectionClick={onIntersectionClick}
      />

      {loaded.kind === 'areaValue' && status !== 'solved' && (
        <button type="button" className="exercises-pass-button" onClick={onPass}>
          {t('board.pass')}
        </button>
      )}

      {hintAvailable &&
        (hintPoint !== null ? (
          <p className="exercises-hint-legend">{t('exercises.hint.legend')}</p>
        ) : (
          <button type="button" className="exercises-hint-button" onClick={onHint} disabled={hintLoading}>
            {hintLoading ? t('exercises.hint.loading') : t('exercises.hint.button')}
          </button>
        ))}

      <div className="exercises-status" aria-live="polite">
        {status === 'solved' && (
          <div className="exercises-solved-panel">
            <p className="exercises-solved">{t('exercises.solved')}</p>
            <p className="exercises-why">
              <strong>{t('exercises.why')}</strong> {t(CONCEPTS[loaded.problem.conceptId].summaryKey as TranslationKey)}
            </p>
          </div>
        )}
        {status === 'incorrect' && !thinking && (
          <p className="exercises-incorrect">{t(wrongReason ?? 'exercises.incorrect')}</p>
        )}
        {solverError && <p className="exercises-error">{t('engine.error')}</p>}
        {thinking && <p>{t('exercises.thinking')}</p>}
      </div>
    </>
  )
}
