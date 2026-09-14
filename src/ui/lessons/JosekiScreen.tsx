import { useState } from 'react'
import { JOSEKI_ENTRIES } from '../../content/joseki'
import type { JosekiEntry } from '../../content/joseki'
import { useI18n } from '../../i18n'
import { GuidedDemo } from './GuidedDemo'

interface JosekiScreenProps {
  onBack: () => void
}

/**
 * Referencia de joseki, seccion aparte de la escalera graduada de Aprender
 * (niveles 0-10) -- no es "el siguiente nivel", es material de consulta sin
 * seguimiento de lectura ni SRS. Mismo patron de router de sub-pantalla que
 * AboutGoScreen: vive dentro de Aprender, no es una pestana nueva. Pocos
 * fragmentos por diseno (ver content/joseki.ts sobre por que crecer esto
 * tiene que ir uno por uno, cada uno corroborado contra la red antes de
 * aceptarlo).
 */
export function JosekiScreen({ onBack }: JosekiScreenProps) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<JosekiEntry | null>(null)

  if (selected) {
    return (
      <div className="learn joseki">
        <div className="lesson-header">
          <button type="button" onClick={() => setSelected(null)}>
            {t('joseki.backToList')}
          </button>
          <h2>{t(selected.titleKey)}</h2>
        </div>
        <p className="lesson-paragraph">{t(selected.descriptionKey)}</p>
        <GuidedDemo script={selected.demo} />
      </div>
    )
  }

  return (
    <div className="learn joseki">
      <div className="lesson-header">
        <button type="button" onClick={onBack}>
          {t('learn.back')}
        </button>
        <h2>{t('joseki.title')}</h2>
      </div>
      <p className="lesson-paragraph">{t('joseki.intro')}</p>
      <ul className="learn-lesson-list">
        {JOSEKI_ENTRIES.map((entry) => (
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
