import { useState } from 'react'
import { TUTORIALS } from '../../content/tutorials'
import type { Tutorial, TutorialTheme } from '../../content/tutorials'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { GuidedDemo } from './GuidedDemo'

interface TutorialsScreenProps {
  onBack: () => void
}

const THEME_LABEL_KEY: Record<TutorialTheme, TranslationKey> = {
  attack: 'tutorials.theme.attack',
  defense: 'tutorials.theme.defense',
  expansion: 'tutorials.theme.expansion',
}

/**
 * Tutoriales de varios pasos con retroalimentacion en cada uno -- algunos
 * de partidas historicas reales (ver content/tutorials.ts), otros
 * sinteticos (posiciones armadas a proposito y verificadas con el
 * solucionador, como el resto de Avanzado/Tesuji). A diferencia de Partidas
 * Historicas (que muestra la partida completa con el grafico de
 * FullGameReviewPanel), cada entrada aca se enfoca en un momento puntual.
 * Mismo patron de sub-pantalla de consulta que Joseki/Avanzado/Tesuji (vive
 * dentro de Aprender, sin seguimiento de progreso ni SRS).
 */
export function TutorialsScreen({ onBack }: TutorialsScreenProps) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<Tutorial | null>(null)

  if (selected) {
    return (
      <div className="learn tutorials">
        <div className="lesson-header">
          <button type="button" onClick={() => setSelected(null)}>
            {t('tutorials.backToList')}
          </button>
          <h2>{t(selected.titleKey)}</h2>
        </div>
        <p className="lesson-paragraph">{t(selected.descriptionKey)}</p>
        <GuidedDemo script={selected.demo} />
      </div>
    )
  }

  return (
    <div className="learn tutorials">
      <div className="lesson-header">
        <button type="button" onClick={onBack}>
          {t('learn.back')}
        </button>
        <h2>{t('tutorials.title')}</h2>
      </div>
      <p className="lesson-paragraph">{t('tutorials.intro')}</p>
      <ul className="learn-lesson-list">
        {TUTORIALS.map((entry) => (
          <li key={entry.id}>
            <button type="button" className="learn-lesson-card" onClick={() => setSelected(entry)}>
              <span className="tutorial-theme">{t(THEME_LABEL_KEY[entry.theme])}</span>
              <span>{t(entry.titleKey)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
