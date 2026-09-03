/**
 * Taxonomia unica de conceptos de Go. Se define antes que cualquier otro
 * archivo de dominio nuevo. Detectores de errores, etiquetas de ejercicios,
 * ejes del perfil de habilidad y claves de repeticion espaciada usan siempre
 * este mismo identificador, nunca una etiqueta paralela.
 */
export type ConceptId =
  // Nivel 0
  | 'LIBERTADES'
  | 'CAPTURA_SIMPLE'
  | 'ATARI_IGNORADO'
  | 'AUTOATARI'
  | 'CAPTURA_PERDIDA'
  // Nivel 1
  | 'KO'
  | 'CONTEO_AREA'
  | 'RELLENO_TERRITORIO_PROPIO'
  | 'PASE_PREMATURO'
  | 'PIEDRA_MUERTA_ATACADA_EN_VANO'
  // Nivel 2
  | 'DOS_OJOS'
  | 'OJO_FALSO'
  | 'RELLENO_OJO_PROPIO'
  | 'PUNTO_VITAL'
  | 'NAKADE'
  | 'GRUPO_MURIO_SIN_OJOS'
  // Nivel 3
  | 'DOBLE_ATARI'
  | 'ESCALERA'
  | 'ESCALERA_FALLIDA'
  | 'RED_GETA'
  | 'SNAPBACK'
  | 'CORTE_NO_DEFENDIDO'
  | 'CONEXION_INNECESARIA'
  | 'TRIANGULO_VACIO'
  // Transversales
  | 'PRIMERA_LINEA_TEMPRANA'
  | 'JUGADA_LEJOS_DEL_COMBATE'
  // Nivel 4 (Forma) -- DIRECCION_LADO_GRANDE (direccion) queda pendiente:
  // ni el estimador de influencia ni partidas simuladas completas con el
  // bot MCTS dieron todavia una diferencia real, reproducible y en el
  // sentido correcto -- ver NOTAS.md, decision pendiente del usuario antes
  // de agregarla.
  | 'FORMA_EFICIENTE'
  | 'CORTE_DEL_KEIMA'
  | 'HANE_Y_CORTE'
  | 'EXTENSION_DESDE_PARED'

export type ConceptSeverity = 'high' | 'medium' | 'low'

export interface Concept {
  id: ConceptId
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6
  /** Clave de traduccion para el nombre visible del concepto. */
  labelKey: string
  /** Clave de traduccion para la explicacion de una frase. */
  summaryKey: string
  /** Termino japones estandar, cuando corresponde. No se traduce. */
  japaneseTerm?: string
  lessonId: string
  hasDetector: boolean
  generatesExercises: boolean
  severity: ConceptSeverity
}

export const CONCEPTS: Record<ConceptId, Concept> = {
  LIBERTADES: {
    id: 'LIBERTADES',
    level: 0,
    labelKey: 'concept.LIBERTADES.label',
    summaryKey: 'concept.LIBERTADES.summary',
    lessonId: 'n0-l2',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  CAPTURA_SIMPLE: {
    id: 'CAPTURA_SIMPLE',
    level: 0,
    labelKey: 'concept.CAPTURA_SIMPLE.label',
    summaryKey: 'concept.CAPTURA_SIMPLE.summary',
    lessonId: 'n0-l4',
    hasDetector: false,
    generatesExercises: true,
    severity: 'medium',
  },
  ATARI_IGNORADO: {
    id: 'ATARI_IGNORADO',
    level: 0,
    labelKey: 'concept.ATARI_IGNORADO.label',
    summaryKey: 'concept.ATARI_IGNORADO.summary',
    japaneseTerm: 'atari',
    lessonId: 'n0-l5',
    hasDetector: true,
    generatesExercises: true,
    severity: 'high',
  },
  AUTOATARI: {
    id: 'AUTOATARI',
    level: 0,
    labelKey: 'concept.AUTOATARI.label',
    summaryKey: 'concept.AUTOATARI.summary',
    japaneseTerm: 'atari',
    lessonId: 'n0-l5',
    hasDetector: true,
    generatesExercises: true,
    severity: 'medium',
  },
  CAPTURA_PERDIDA: {
    id: 'CAPTURA_PERDIDA',
    level: 0,
    labelKey: 'concept.CAPTURA_PERDIDA.label',
    summaryKey: 'concept.CAPTURA_PERDIDA.summary',
    lessonId: 'n0-l4',
    hasDetector: true,
    generatesExercises: false,
    severity: 'medium',
  },
  KO: {
    id: 'KO',
    level: 1,
    labelKey: 'concept.KO.label',
    summaryKey: 'concept.KO.summary',
    japaneseTerm: 'ko',
    lessonId: 'n1-l5',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  CONTEO_AREA: {
    id: 'CONTEO_AREA',
    level: 1,
    labelKey: 'concept.CONTEO_AREA.label',
    summaryKey: 'concept.CONTEO_AREA.summary',
    lessonId: 'n1-l3',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  RELLENO_TERRITORIO_PROPIO: {
    id: 'RELLENO_TERRITORIO_PROPIO',
    level: 1,
    labelKey: 'concept.RELLENO_TERRITORIO_PROPIO.label',
    summaryKey: 'concept.RELLENO_TERRITORIO_PROPIO.summary',
    lessonId: 'n1-l7',
    hasDetector: true,
    generatesExercises: true,
    severity: 'low',
  },
  PASE_PREMATURO: {
    id: 'PASE_PREMATURO',
    level: 1,
    labelKey: 'concept.PASE_PREMATURO.label',
    summaryKey: 'concept.PASE_PREMATURO.summary',
    lessonId: 'n1-l2',
    hasDetector: true,
    generatesExercises: true,
    severity: 'medium',
  },
  PIEDRA_MUERTA_ATACADA_EN_VANO: {
    id: 'PIEDRA_MUERTA_ATACADA_EN_VANO',
    level: 1,
    labelKey: 'concept.PIEDRA_MUERTA_ATACADA_EN_VANO.label',
    summaryKey: 'concept.PIEDRA_MUERTA_ATACADA_EN_VANO.summary',
    lessonId: 'n1-l6',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  DOS_OJOS: {
    id: 'DOS_OJOS',
    level: 2,
    labelKey: 'concept.DOS_OJOS.label',
    summaryKey: 'concept.DOS_OJOS.summary',
    lessonId: 'n2-l3',
    hasDetector: false,
    generatesExercises: true,
    severity: 'low',
  },
  OJO_FALSO: {
    id: 'OJO_FALSO',
    level: 2,
    labelKey: 'concept.OJO_FALSO.label',
    summaryKey: 'concept.OJO_FALSO.summary',
    lessonId: 'n2-l4',
    hasDetector: false,
    generatesExercises: true,
    severity: 'medium',
  },
  RELLENO_OJO_PROPIO: {
    id: 'RELLENO_OJO_PROPIO',
    level: 2,
    labelKey: 'concept.RELLENO_OJO_PROPIO.label',
    summaryKey: 'concept.RELLENO_OJO_PROPIO.summary',
    lessonId: 'n2-l1',
    hasDetector: true,
    generatesExercises: true,
    severity: 'high',
  },
  PUNTO_VITAL: {
    id: 'PUNTO_VITAL',
    level: 2,
    labelKey: 'concept.PUNTO_VITAL.label',
    summaryKey: 'concept.PUNTO_VITAL.summary',
    lessonId: 'n2-l6',
    hasDetector: false,
    generatesExercises: true,
    severity: 'medium',
  },
  NAKADE: {
    id: 'NAKADE',
    level: 2,
    labelKey: 'concept.NAKADE.label',
    summaryKey: 'concept.NAKADE.summary',
    japaneseTerm: 'nakade',
    lessonId: 'n2-l8',
    hasDetector: false,
    generatesExercises: true,
    severity: 'medium',
  },
  GRUPO_MURIO_SIN_OJOS: {
    id: 'GRUPO_MURIO_SIN_OJOS',
    level: 2,
    labelKey: 'concept.GRUPO_MURIO_SIN_OJOS.label',
    summaryKey: 'concept.GRUPO_MURIO_SIN_OJOS.summary',
    lessonId: 'n2-l3',
    hasDetector: true,
    generatesExercises: false,
    severity: 'high',
  },
  DOBLE_ATARI: {
    id: 'DOBLE_ATARI',
    level: 3,
    labelKey: 'concept.DOBLE_ATARI.label',
    summaryKey: 'concept.DOBLE_ATARI.summary',
    japaneseTerm: 'atari',
    lessonId: 'n3-l1',
    hasDetector: false,
    generatesExercises: true,
    severity: 'medium',
  },
  ESCALERA: {
    id: 'ESCALERA',
    level: 3,
    labelKey: 'concept.ESCALERA.label',
    summaryKey: 'concept.ESCALERA.summary',
    japaneseTerm: 'shicho',
    lessonId: 'n3-l2',
    hasDetector: false,
    generatesExercises: true,
    severity: 'medium',
  },
  ESCALERA_FALLIDA: {
    id: 'ESCALERA_FALLIDA',
    level: 3,
    labelKey: 'concept.ESCALERA_FALLIDA.label',
    summaryKey: 'concept.ESCALERA_FALLIDA.summary',
    japaneseTerm: 'shicho',
    lessonId: 'n3-l3',
    hasDetector: true,
    generatesExercises: false,
    severity: 'high',
  },
  RED_GETA: {
    id: 'RED_GETA',
    level: 3,
    labelKey: 'concept.RED_GETA.label',
    summaryKey: 'concept.RED_GETA.summary',
    japaneseTerm: 'geta',
    lessonId: 'n3-l4',
    hasDetector: false,
    generatesExercises: true,
    severity: 'medium',
  },
  SNAPBACK: {
    id: 'SNAPBACK',
    level: 3,
    labelKey: 'concept.SNAPBACK.label',
    summaryKey: 'concept.SNAPBACK.summary',
    japaneseTerm: 'uttegaeshi',
    lessonId: 'n3-l5',
    hasDetector: false,
    generatesExercises: true,
    severity: 'medium',
  },
  CORTE_NO_DEFENDIDO: {
    id: 'CORTE_NO_DEFENDIDO',
    level: 3,
    labelKey: 'concept.CORTE_NO_DEFENDIDO.label',
    summaryKey: 'concept.CORTE_NO_DEFENDIDO.summary',
    lessonId: 'n3-l6',
    hasDetector: true,
    generatesExercises: true,
    severity: 'medium',
  },
  CONEXION_INNECESARIA: {
    id: 'CONEXION_INNECESARIA',
    level: 3,
    labelKey: 'concept.CONEXION_INNECESARIA.label',
    summaryKey: 'concept.CONEXION_INNECESARIA.summary',
    lessonId: 'n3-l7',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  TRIANGULO_VACIO: {
    id: 'TRIANGULO_VACIO',
    level: 3,
    labelKey: 'concept.TRIANGULO_VACIO.label',
    summaryKey: 'concept.TRIANGULO_VACIO.summary',
    lessonId: 'n3-l8',
    hasDetector: true,
    generatesExercises: true,
    severity: 'low',
  },
  PRIMERA_LINEA_TEMPRANA: {
    id: 'PRIMERA_LINEA_TEMPRANA',
    level: 1,
    labelKey: 'concept.PRIMERA_LINEA_TEMPRANA.label',
    summaryKey: 'concept.PRIMERA_LINEA_TEMPRANA.summary',
    lessonId: 'transversal',
    hasDetector: true,
    generatesExercises: false,
    severity: 'low',
  },
  JUGADA_LEJOS_DEL_COMBATE: {
    id: 'JUGADA_LEJOS_DEL_COMBATE',
    level: 2,
    labelKey: 'concept.JUGADA_LEJOS_DEL_COMBATE.label',
    summaryKey: 'concept.JUGADA_LEJOS_DEL_COMBATE.summary',
    lessonId: 'transversal',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  // Nivel 4 (Forma): sin detector ni banco de ejercicios verificado todavia
  // (a diferencia de los niveles 0-3, no hay un solucionador exhaustivo para
  // "esta forma es eficiente" -- la afirmacion se verifica con el motor de
  // evaluacion en la leccion misma, ver content/lessons/n4.ts, no con un
  // banco de problemas generado aparte). Mismo patron ya establecido por
  // KO/CONTEO_AREA en nivel 1: concepto con demo interactiva pero sin
  // evidencia de Perfil todavia.
  FORMA_EFICIENTE: {
    id: 'FORMA_EFICIENTE',
    level: 4,
    labelKey: 'concept.FORMA_EFICIENTE.label',
    summaryKey: 'concept.FORMA_EFICIENTE.summary',
    lessonId: 'n4-l1',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  CORTE_DEL_KEIMA: {
    id: 'CORTE_DEL_KEIMA',
    level: 4,
    labelKey: 'concept.CORTE_DEL_KEIMA.label',
    summaryKey: 'concept.CORTE_DEL_KEIMA.summary',
    japaneseTerm: 'keima',
    lessonId: 'n4-l2',
    hasDetector: false,
    generatesExercises: false,
    severity: 'medium',
  },
  HANE_Y_CORTE: {
    id: 'HANE_Y_CORTE',
    level: 4,
    labelKey: 'concept.HANE_Y_CORTE.label',
    summaryKey: 'concept.HANE_Y_CORTE.summary',
    japaneseTerm: 'hane',
    lessonId: 'n4-l3',
    hasDetector: false,
    generatesExercises: false,
    severity: 'medium',
  },
  EXTENSION_DESDE_PARED: {
    id: 'EXTENSION_DESDE_PARED',
    level: 4,
    labelKey: 'concept.EXTENSION_DESDE_PARED.label',
    summaryKey: 'concept.EXTENSION_DESDE_PARED.summary',
    lessonId: 'n4-l4',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
}

export const ALL_CONCEPT_IDS = Object.keys(CONCEPTS) as ConceptId[]

export function conceptsThatGenerateExercises(): Concept[] {
  return ALL_CONCEPT_IDS.map((id) => CONCEPTS[id]).filter((c) => c.generatesExercises)
}

/** Conceptos que alguna vez pueden acumular evidencia real (un detector que
 * dispare en una partida, o un ejercicio que se resuelva). Los que no tienen
 * ninguna de las dos cosas nunca van a dejar de estar "sin datos", asi que
 * la pantalla de Perfil los deja afuera en vez de mostrar filas muertas. */
export function conceptsWithEvidence(): Concept[] {
  return ALL_CONCEPT_IDS.map((id) => CONCEPTS[id]).filter((c) => c.hasDetector || c.generatesExercises)
}

/** Conceptos cuyo lessonId apunta a una leccion dada. Se deriva de CONCEPTS
 * en vez de duplicar la lista a mano en cada leccion, para que un solo
 * enumerado siga siendo la unica fuente de verdad (principio 2 del
 * documento de diseno). */
export function conceptsForLesson(lessonId: string): Concept[] {
  return ALL_CONCEPT_IDS.map((id) => CONCEPTS[id]).filter((c) => c.lessonId === lessonId)
}
