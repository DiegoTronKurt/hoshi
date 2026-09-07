import { useState } from 'react'
import type { LessonBlock } from '../../content/lessons/types'
import { useI18n } from '../../i18n'
import { BoardCanvas } from '../board/BoardCanvas'
import { useSettings } from '../settings'

interface ComparePromptProps {
  block: Extract<LessonBlock, { kind: 'compare' }>
}

/**
 * "Adivina antes de ver": las dos opciones se muestran sin caption hasta que
 * la persona elige una, recien ahi se revelan ambas explicaciones. No es un
 * ejercicio evaluado ni se registra en FSRS (mismo criterio que GuidedDemo)
 * -- es una ayuda de lectura activa para el contenido de nivel 5 en
 * adelante, que es mas juicio comparativo que "hay un solo punto correcto".
 */
export function ComparePrompt({ block }: ComparePromptProps) {
  const { t } = useI18n()
  const { theme } = useSettings()
  const [chosen, setChosen] = useState<0 | 1 | null>(null)

  return (
    <div className="lesson-compare">
      <p className="lesson-compare-prompt">{t(block.promptKey)}</p>
      <div className="lesson-compare-options">
        {block.options.map((option, index) => {
          const revealed = chosen !== null
          const isCorrect = index === block.correctIndex
          return (
            <div
              key={index}
              className={`lesson-compare-option${revealed && isCorrect ? ' lesson-compare-option-correct' : ''}`}
            >
              <BoardCanvas
                width={option.width}
                height={option.height}
                stones={option.stones}
                lastMove={option.highlightPoint ?? null}
                theme={theme}
                onIntersectionClick={() => {}}
              />
              {revealed ? (
                <p className="lesson-compare-caption">{t(option.captionKey, option.captionParams)}</p>
              ) : (
                <button type="button" onClick={() => setChosen(index as 0 | 1)}>
                  {t('learn.compare.choose')}
                </button>
              )}
            </div>
          )
        })}
      </div>
      {chosen !== null && (
        <p className={chosen === block.correctIndex ? 'lesson-compare-correct' : 'lesson-compare-incorrect'}>
          {t(chosen === block.correctIndex ? block.resultCorrectKey : block.resultIncorrectKey)}
        </p>
      )}
    </div>
  )
}
