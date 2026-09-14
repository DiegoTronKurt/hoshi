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
  return gameStateFromBoard({ width: script.width, height: script.height, stones: script.initialStones }, script.toMove)
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
  /** Si este es el ultimo paso, pasar directo a 'done' en vez de 'feedback':
   * un boton "Continuar" que lleva de un mensaje de exito a otro casi
   * identico se sentia como que no hacia nada (ver NOTAS.md). El feedback
   * del ultimo paso no se pierde -- se muestra junto con el mensaje de
   * completado en el branch 'done' de mas abajo. */
  const isLastStep = stepIndex === script.steps.length - 1
  /** Muchos promptKey dicen "toca el punto marcado", pero el tablero nunca
   * dibujaba ningun marcador -- la persona tenia que ubicarlo solo leyendo
   * la posicion (ver NOTAS.md). Cuando el paso tiene un unico punto valido
   * lo mostramos como hintMove (el mismo anillo que ya usan los ejercicios).
   * Con varios puntos validos no marcamos ninguno: resaltar uno solo daria a
   * entender que es la unica respuesta correcta. */
  const hintPoint =
    step && step.expectedPoints.length === 1 && (status === 'awaiting-move' || status === 'wrong')
      ? step.expectedPoints[0]
      : null

  useEffect(() => {
    if (!step || step.auto === undefined || step.auto === false || status !== 'awaiting-move') return
    const movePoint = step.auto === true ? null : step.auto
    const result = applyMove(game, movePoint)
    if (result.legal && result.state) {
      if (movePoint !== null) playStoneSoundIfEnabled()
      setGame(result.state)
    }
    setStatus(isLastStep ? 'done' : 'feedback')
  }, [step, status, game, playStoneSoundIfEnabled, isLastStep])

  function handleClick(point: number) {
    // 'wrong' tiene que seguir aceptando clicks -- si no, el primer click
    // equivocado deja la demo trabada para siempre (el mensaje invita a
    // "probar otro punto" pero ningun click, ni siquiera el correcto, volvia
    // a hacer nada hasta salir y reentrar a la leccion).
    if ((status !== 'awaiting-move' && status !== 'wrong') || !step || step.auto !== undefined) return
    if (!step.expectedPoints.includes(point)) {
      setStatus('wrong')
      return
    }

    const result = applyMove(game, point)

    if (step.expectIllegal) {
      if (!result.legal) {
        setStatus(isLastStep ? 'done' : 'feedback')
      } else {
        setStatus('wrong')
      }
      return
    }

    if (result.legal && result.state) {
      playStoneSoundIfEnabled()
      setGame(result.state)
      setStatus(isLastStep ? 'done' : 'feedback')
    } else {
      setStatus('wrong')
    }
  }

  // Solo se llega aca desde el estado 'feedback', que ya nunca ocurre en el
  // ultimo paso (ver isLastStep arriba) -- siempre hay un paso siguiente.
  function handleContinue() {
    setStepIndex((i) => i + 1)
    setStatus('awaiting-move')
  }

  return (
    <div className="lesson-demo">
      <h3>{t('learn.demo.title')}</h3>
      <BoardCanvas
        width={script.width}
        height={script.height}
        stones={game.board.stones}
        lastMove={null}
        hintMove={hintPoint}
        theme={theme}
        onIntersectionClick={handleClick}
      />
      <div className="lesson-demo-status" aria-live="polite">
        {status === 'done' ? (
          <>
            <p className="lesson-demo-feedback">{t(script.steps[script.steps.length - 1].feedbackKey)}</p>
            <p className="lesson-demo-done">{t(script.completionKey)}</p>
          </>
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
