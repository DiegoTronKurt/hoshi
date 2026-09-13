import { useState } from 'react'
import { TESUJI_ENTRIES } from '../../content/tesuji'
import type { TesujiEntry } from '../../content/tesuji'
import { useI18n } from '../../i18n'
import { GuidedDemo } from './GuidedDemo'

interface TesujiScreenProps {
  onBack: () => void
}

/**
 * Diccionario de tesuji, mismo patron de sub-pantalla de consulta que
 * JosekiScreen/AdvancedScreen (vive dentro de Aprender, sin seguimiento de
 * progreso ni SRS). A diferencia de joseki.ts (convencion sin verificacion
 * matematica posible), cada entrada aca es una tactica de captura con
 * resultado verificable por el solucionador exhaustivo -- ver el comentario
 * de content/tesuji.ts.
 */
export function TesujiScreen({ onBack }: TesujiScreenProps) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<TesujiEntry | null>(null)

  if (selected) {
    return (
      <div className="learn tesuji">
        <div className="lesson-header">
          <button type="button" onClick={() => setSelected(null)}>
            {t('tesuji.backToList')}
          </button>
          <h2>{t(selected.titleKey)}</h2>
        </div>
        <p className="lesson-paragraph">{t(selected.descriptionKey)}</p>
        <GuidedDemo script={selected.demo} />
      </div>
    )
  }

  return (
    <div className="learn tesuji">
      <div className="lesson-header">
        <button type="button" onClick={onBack}>
          {t('learn.back')}
        </button>
        <h2>{t('tesuji.title')}</h2>
      </div>
      <p className="lesson-paragraph">{t('tesuji.intro')}</p>
      <ul className="learn-lesson-list">
        {TESUJI_ENTRIES.map((entry) => (
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
