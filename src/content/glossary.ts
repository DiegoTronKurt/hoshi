import type { TranslationKey } from '../i18n'

/**
 * Terminos japoneses que las lecciones existentes ya introducen y explican
 * uno por uno. El glosario de Aprender > Sobre el Go no agrega definiciones
 * nuevas: reune las que ya estan verificadas en su leccion o en
 * `analysis/concepts.ts`, en un solo lugar de referencia.
 *
 * Lista revisada de nuevo tras agregar los niveles 4 a 9 (sesion 2026-09-08):
 * hane (n4-l3), tenuki (n6-l3 / concept.TENUKI_JOSEKI), joseki (n6-l1), moyo
 * (n7-l1) y sente/gote (concept.SENTE_Y_GOTE) ya estan enseñados y se
 * agregan aca. No incluye terminos que la app todavia no enseña de verdad.
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
  { japaneseTerm: 'hane', labelKey: 'concept.HANE_Y_CORTE.label', definitionKey: 'concept.HANE_Y_CORTE.summary' },
  { japaneseTerm: 'tenuki', labelKey: 'concept.TENUKI_JOSEKI.label', definitionKey: 'concept.TENUKI_JOSEKI.summary' },
  { japaneseTerm: 'joseki', labelKey: 'lesson.n6-l1.title', definitionKey: 'lesson.n6-l1.p1' },
  { japaneseTerm: 'moyo', labelKey: 'lesson.n7-l1.title', definitionKey: 'lesson.n7-l1.p1' },
  { japaneseTerm: 'sente / gote', labelKey: 'concept.SENTE_Y_GOTE.label', definitionKey: 'concept.SENTE_Y_GOTE.summary' },
]
