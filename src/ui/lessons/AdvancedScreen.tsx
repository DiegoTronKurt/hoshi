import { useState } from 'react'
import { ADVANCED_ENTRIES } from '../../content/advanced'
import type { AdvancedEntry } from '../../content/advanced'
import { useI18n } from '../../i18n'
import { GuidedDemo } from './GuidedDemo'

interface AdvancedScreenProps {
  onBack: () => void
}

/**
 * Contenido mas dificil que la escalera graduada 0-10, en su propia
 * seccion -- ver el comentario de content/advanced.ts sobre por que no es
 * "Nivel 11". Mismo patron de router de sub-pantalla que JosekiScreen (lista
 * + detalle con GuidedDemo), sin seguimiento de lectura ni SRS.
 */
export function AdvancedScreen({ onBack }: AdvancedScreenProps) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<AdvancedEntry | null>(null)

  if (selected) {
    return (
      <div className="learn advanced">
        <div className="lesson-header">
          <button type="button" onClick={() => setSelected(null)}>
            {t('advanced.backToList')}
          </button>
          <h2>{t(selected.titleKey)}</h2>
        </div>
        <p className="lesson-paragraph">{t(selected.descriptionKey)}</p>
        <GuidedDemo script={selected.demo} />
      </div>
    )
  }

  return (
    <div className="learn advanced">
      <div className="lesson-header">
        <button type="button" onClick={onBack}>
          {t('learn.backToLevels')}
        </button>
        <h2>{t('advanced.title')}</h2>
      </div>
      <p className="lesson-paragraph">{t('advanced.intro')}</p>
      <ul className="learn-lesson-list">
        {ADVANCED_ENTRIES.map((entry) => (
          <li key={entry.id}>
            <button type="button" className="learn-lesson-card" onClick={() => setSelected(entry)}>
              <span>{t(entry.titleKey)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
