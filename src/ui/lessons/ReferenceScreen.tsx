import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'

export type ReferenceKind = 'about' | 'joseki' | 'advanced' | 'historicGames' | 'tutorials' | 'tesuji'

interface ReferenceScreenProps {
  onBack: () => void
  onOpen: (kind: ReferenceKind) => void
}

const ITEMS: Array<{ kind: ReferenceKind; ctaKey: TranslationKey }> = [
  { kind: 'about', ctaKey: 'about.cta' },
  { kind: 'joseki', ctaKey: 'joseki.cta' },
  { kind: 'advanced', ctaKey: 'advanced.cta' },
  { kind: 'historicGames', ctaKey: 'historicGames.cta' },
  { kind: 'tutorials', ctaKey: 'tutorials.cta' },
  { kind: 'tesuji', ctaKey: 'tesuji.cta' },
]

/**
 * Vestibulo unico para las seis secciones de consulta (Sobre el Go, Joseki,
 * Avanzado, Partidas historicas, Tutoriales, Tesuji), antes mostradas como
 * seis botones apilados directo en la pantalla principal de Aprender --
 * mucho espacio vertical fijo para algo que se abre rara vez. Ahora la
 * pantalla principal solo tiene un boton ("Referencia") que entra aca; cada
 * seccion sigue viviendo en su propio componente sin cambios de contenido.
 */
export function ReferenceScreen({ onBack, onOpen }: ReferenceScreenProps) {
  const { t } = useI18n()

  return (
    <div className="learn reference">
      <div className="lesson-header">
        <button type="button" onClick={onBack}>
          {t('learn.backToLevels')}
        </button>
        <h2>{t('reference.title')}</h2>
      </div>
      <p className="lesson-paragraph">{t('reference.intro')}</p>
      <div className="learn-reference-ctas">
        {ITEMS.map((item) => (
          <button key={item.kind} type="button" className="learn-about-cta" onClick={() => onOpen(item.kind)}>
            {t(item.ctaKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
