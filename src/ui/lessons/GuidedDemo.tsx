import { useEffect, useState } from 'react'
import type { DemoScript } from '../../content/lessons/types'
import { applyMove, gameStateFromBoard } from '../../core/rules'
import type { GameState } from '../../core/types'
import { useI18n } from '../../i18n'
import { BoardCanvas } from '../board/BoardCanvas'
import { useSettings } from '../settings'

interface GuidedDemoProps {
  script: DemoScript
}

type DemoStatus = 'awaiting-move' | 'wrong' | 'feedback' | 'done'

function buildInitialGame(script: DemoScript): GameState {
  return gameStateFromBoard({ size: script.size, stones: script.initialStones }, script.toMove)
}

/**
 * "Ejemplo interactivo" de una leccion: una secuencia guionada de jugadas
 * validadas contra el motor de reglas real (core/rules.applyMove), no un
 * ejercicio evaluado por el solucionador ni registrado en FSRS. Cada paso
 * lo juega quien le toque el turno en la posicion real (sin forzar un color
 * fijo de "la persona"); un paso marcado `auto` juega automaticamente sin
 * pedir un click, ya sea un pase (para narrar "el rival no responde") o una
 * jugada concreta (para narrar la respuesta forzada del otro bando, como la
 * extension del que huye en una escalera).
 */
export function GuidedDemo({ script }: GuidedDemoProps) {
  const { t } = useI18n()
  const { theme, playStoneSoundIfEnabled } = useSettings()

  const [game, setGame] = useState<GameState>(() => buildInitialGame(script))
  const [stepIndex, setStepIndex] = useState(0)
  const [status, setStatus] = useState<DemoStatus>('awaiting-move')

  useEffect(() => {
    setGame(buildInitialGame(script))
    setStepIndex(0)
    setStatus('awaiting-move')
  }, [script])

  const step = stepIndex < script.steps.length ? script.steps[stepIndex] : null

  useEffect(() => {
    if (!step || step.auto === undefined || step.auto === false || status !== 'awaiting-move') return
    const movePoint = step.auto === true ? null : step.auto
    const result = applyMove(game, movePoint)
    if (result.legal && result.state) {
      if (movePoint !== null) playStoneSoundIfEnabled()
      setGame(result.state)
    }
    setStatus('feedback')
  }, [step, status, game, playStoneSoundIfEnabled])

  function handleClick(point: number) {
    if (status !== 'awaiting-move' || !step || step.auto !== undefined) return
    if (!step.expectedPoints.includes(point)) {
      setStatus('wrong')
      return
    }

    const result = applyMove(game, point)

    if (step.expectIllegal) {
      if (!result.legal) {
        setStatus('feedback')
      } else {
        setStatus('wrong')
      }
      return
    }

    if (result.legal && result.state) {
      playStoneSoundIfEnabled()
      setGame(result.state)
      setStatus('feedback')
    } else {
      setStatus('wrong')
    }
  }

  function handleContinue() {
    const next = stepIndex + 1
    setStepIndex(next)
    setStatus(next < script.steps.length ? 'awaiting-move' : 'done')
  }

  return (
    <div className="lesson-demo">
      <h3>{t('learn.demo.title')}</h3>
      <BoardCanvas
        size={script.size}
        stones={game.board.stones}
        lastMove={null}
        theme={theme}
        onIntersectionClick={handleClick}
      />
      <div className="lesson-demo-status" aria-live="polite">
        {status === 'done' ? (
          <p className="lesson-demo-done">{t(script.completionKey)}</p>
        ) : status === 'feedback' && step ? (
          <>
            <p className="lesson-demo-feedback">{t(step.feedbackKey)}</p>
            <button type="button" onClick={handleContinue}>
              {t('learn.demo.continue')}
            </button>
          </>
        ) : (
          <>
            {step && <p>{t(step.promptKey)}</p>}
            {status === 'wrong' && <p className="lesson-demo-wrong">{t('learn.demo.tryAgain')}</p>}
          </>
        )}
      </div>
    </div>
  )
}
