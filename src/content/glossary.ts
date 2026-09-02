import type { TranslationKey } from '../i18n'

/**
 * Terminos japoneses que las lecciones existentes (niveles 0 a 3) ya
 * introducen y explican uno por uno. El glosario de Aprender > Sobre el Go
 * no agrega definiciones nuevas: reune las que ya estan verificadas en su
 * leccion o en `analysis/concepts.ts`, en un solo lugar de referencia.
 *
 * A proposito no incluye terminos como "hane", "sente", "gote" o "tenuki":
 * todavia no los ensena ninguna leccion real, y listarlos aca seria
 * introducir vocabulario que la app nunca enseño.
 */
export interface GlossaryTerm {
  japaneseTerm: string
  labelKey: TranslationKey
  definitionKey: TranslationKey
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  { japaneseTerm: 'atari', labelKey: 'lesson.n0-l5.title', definitionKey: 'lesson.n0-l5.p1' },
  { japaneseTerm: 'ko', labelKey: 'concept.KO.label', definitionKey: 'concept.KO.summary' },
  { japaneseTerm: 'nakade', labelKey: 'concept.NAKADE.label', definitionKey: 'concept.NAKADE.summary' },
  { japaneseTerm: 'shicho', labelKey: 'concept.ESCALERA.label', definitionKey: 'concept.ESCALERA.summary' },
  { japaneseTerm: 'geta', labelKey: 'concept.RED_GETA.label', definitionKey: 'concept.RED_GETA.summary' },
  { japaneseTerm: 'uttegaeshi', labelKey: 'concept.SNAPBACK.label', definitionKey: 'concept.SNAPBACK.summary' },
]
