import { GLOSSARY_TERMS } from '../../content/glossary'
import { useI18n } from '../../i18n'

interface AboutGoScreenProps {
  onBack: () => void
}

const RULE_SECTIONS = [
  { titleKey: 'about.rules.chinese.title', descriptionKey: 'about.rules.chinese.description' },
  { titleKey: 'about.rules.japanese.title', descriptionKey: 'about.rules.japanese.description' },
  { titleKey: 'about.rules.aga.title', descriptionKey: 'about.rules.aga.description' },
  { titleKey: 'about.rules.nz.title', descriptionKey: 'about.rules.nz.description' },
] as const

const HISTORY_PARAGRAPHS = [
  'about.history.p1',
  'about.history.p2',
  'about.history.p3',
  'about.history.p4',
  'about.history.p5',
] as const

/**
 * "Sobre el Go", seccion de referencia dentro de Aprender (roadmap maestro,
 * seccion 6): historia, glosario y comparacion de reglas de conteo. No es
 * una pestana nueva -- vive como una sub-pantalla mas de Aprender, mismo
 * patron de router que ya usa LearnScreen para niveles/lecciones.
 */
export function AboutGoScreen({ onBack }: AboutGoScreenProps) {
  const { t } = useI18n()

  return (
    <div className="learn about-go">
      <div className="lesson-header">
        <button type="button" onClick={onBack}>
          {t('learn.backToLevels')}
        </button>
        <h2>{t('about.title')}</h2>
      </div>

      <section className="about-go-section">
        <h3>{t('about.history.title')}</h3>
        {HISTORY_PARAGRAPHS.map((key) => (
          <p key={key} className="lesson-paragraph">
            {t(key)}
          </p>
        ))}
      </section>

      <section className="about-go-section">
        <h3>{t('about.glossary.title')}</h3>
        <dl className="about-go-glossary">
          {GLOSSARY_TERMS.map((term) => (
            <div key={term.japaneseTerm} className="about-go-glossary-entry">
              <dt>
                {t(term.labelKey)} <span className="about-go-glossary-term">({term.japaneseTerm})</span>
              </dt>
              <dd>{t(term.definitionKey)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="about-go-section">
        <h3>{t('about.rules.title')}</h3>
        <p className="lesson-paragraph">{t('about.rules.intro')}</p>
        {RULE_SECTIONS.map((rule) => (
          <div key={rule.titleKey} className="about-go-rule">
            <h4>{t(rule.titleKey)}</h4>
            <p className="lesson-paragraph">{t(rule.descriptionKey)}</p>
          </div>
        ))}
        <div className="about-go-rule">
          <h4>{t('concept.KO.label')}</h4>
          <p className="lesson-paragraph">{t('concept.KO.summary')}</p>
        </div>
        <div className="about-go-rule">
          <h4>{t('about.rules.seki.title')}</h4>
          <p className="lesson-paragraph">{t('about.rules.seki.description')}</p>
        </div>
      </section>
    </div>
  )
}
