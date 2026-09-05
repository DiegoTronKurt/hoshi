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
  // Nivel 4 (Forma)
  | 'FORMA_EFICIENTE'
  | 'CORTE_DEL_KEIMA'
  | 'HANE_Y_CORTE'
  | 'EXTENSION_DESDE_PARED'
  | 'DIRECCION_LADO_GRANDE'
  // Nivel 5 (Apertura): resuelto con el libro de respaldo real (Kajiwara,
  // "The Direction of Play", capitulo 1 -- ver NOTAS-libro-direction-of-play.md)
  | 'PUNTO_ESTRELLA_DOS_DIRECCIONES'
  | 'PUNTO_3_4_DEPENDE_ESQUINAS'
  | 'PUNTO_3_3_SIN_DIRECCION'
  | 'PUERTA_PRINCIPAL_TRASERA'
  | 'COMBINAR_DIRECCIONES'
  // Nivel 6 (Joseki)
  | 'QUE_ES_JOSEKI'
  | 'BLOQUEO_HACIA_APOYO'
  | 'TENUKI_JOSEKI'
  | 'HOSHI_INVASION_3_3'
  | 'JOSEKI_SIMETRIA'
  // Nivel 7 (Fuseki): resuelto con el mismo libro de respaldo (Kajiwara,
  // capitulo 6 -- ver NOTAS-libro-direction-of-play.md)
  | 'MOYO_NO_ES_TERRITORIO'
  | 'JUICIO_LOCAL_VS_GLOBAL'
  | 'RELACION_CON_PIEDRAS_PROPIAS'
  | 'PACIENCIA_Y_MARGEN'
  | 'DIRECCION_NO_ES_TODO'
  // Nivel 8 (Medio juego: ataque y defensa): capitulos 4 y 8 del mismo libro
  | 'ATACAR_CONSTRUYENDO'
  | 'USAR_PIEDRAS_PROPIAS_PARA_ATACAR'
  | 'NO_PELEAR_CON_DEBILIDAD'
  | 'SACRIFICAR_LO_NECESARIO'
  | 'NO_PELEAR_SIN_NECESIDAD'
  // Nivel 9 (Yose): sin libro -- verificado con el motor real
  // (solver/areaValue.ts, core/groups.ts), mismo estandar que niveles 0-3.
  | 'EL_FINAL_TAMBIEN_ES_GRANDE'
  | 'SENTE_Y_GOTE'
  | 'SENTE_ANTES_QUE_GOTE'
  | 'COMPARAR_VALOR_REAL'
  | 'CONTAR_PARA_DECIDIR'
  // Nivel 10 (Semeai): sin libro -- verificado jugada por jugada con el
  // motor real (core/rules.ts::applyMove, core/groups.ts).
  | 'QUE_ES_SEMEAI'
  | 'CONTAR_LIBERTADES_ANTES_DE_JUGAR'
  | 'LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO'
  | 'UN_OJO_GANA'
  | 'CONECTAR_EN_VEZ_DE_PELEAR'

export type ConceptSeverity = 'high' | 'medium' | 'low'

export interface Concept {
  id: ConceptId
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  /** Clave de traduccion para el nombre visible del concepto. */
  labelKey: string
  /** Clave de traduccion para la explicacion de una frase. */
  summaryKey: string
  /** Termino japones estandar, cuando corresponde. No se traduce. */
  japaneseTerm?: string
  /** null cuando el concepto todavia no tiene una leccion propia que lo
   * cubra (ver PRIMERA_LINEA_TEMPRANA/JUGADA_LEJOS_DEL_COMBATE mas abajo:
   * se revisaron todas las lecciones de su nivel y ninguna encaja -- no es
   * un dato faltante por descuido, es contenido que todavia no se escribio,
   * ver NOTAS.md). */
  lessonId: string | null
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
    lessonId: null,
    hasDetector: true,
    generatesExercises: false,
    severity: 'low',
  },
  JUGADA_LEJOS_DEL_COMBATE: {
    id: 'JUGADA_LEJOS_DEL_COMBATE',
    level: 2,
    labelKey: 'concept.JUGADA_LEJOS_DEL_COMBATE.label',
    summaryKey: 'concept.JUGADA_LEJOS_DEL_COMBATE.summary',
    lessonId: null,
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
  DIRECCION_LADO_GRANDE: {
    id: 'DIRECCION_LADO_GRANDE',
    level: 4,
    labelKey: 'concept.DIRECCION_LADO_GRANDE.label',
    summaryKey: 'concept.DIRECCION_LADO_GRANDE.summary',
    lessonId: 'n4-l5',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  // Nivel 5 (Apertura): mismo patron que Nivel 4 -- sin detector ni banco de
  // ejercicios, la afirmacion vive en la leccion misma (content/lessons/n5.ts).
  PUNTO_ESTRELLA_DOS_DIRECCIONES: {
    id: 'PUNTO_ESTRELLA_DOS_DIRECCIONES',
    level: 5,
    labelKey: 'concept.PUNTO_ESTRELLA_DOS_DIRECCIONES.label',
    summaryKey: 'concept.PUNTO_ESTRELLA_DOS_DIRECCIONES.summary',
    japaneseTerm: 'hoshi',
    lessonId: 'n5-l1',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  PUNTO_3_4_DEPENDE_ESQUINAS: {
    id: 'PUNTO_3_4_DEPENDE_ESQUINAS',
    level: 5,
    labelKey: 'concept.PUNTO_3_4_DEPENDE_ESQUINAS.label',
    summaryKey: 'concept.PUNTO_3_4_DEPENDE_ESQUINAS.summary',
    japaneseTerm: 'komoku',
    lessonId: 'n5-l2',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  PUNTO_3_3_SIN_DIRECCION: {
    id: 'PUNTO_3_3_SIN_DIRECCION',
    level: 5,
    labelKey: 'concept.PUNTO_3_3_SIN_DIRECCION.label',
    summaryKey: 'concept.PUNTO_3_3_SIN_DIRECCION.summary',
    lessonId: 'n5-l3',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  PUERTA_PRINCIPAL_TRASERA: {
    id: 'PUERTA_PRINCIPAL_TRASERA',
    level: 5,
    labelKey: 'concept.PUERTA_PRINCIPAL_TRASERA.label',
    summaryKey: 'concept.PUERTA_PRINCIPAL_TRASERA.summary',
    lessonId: 'n5-l4',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  COMBINAR_DIRECCIONES: {
    id: 'COMBINAR_DIRECCIONES',
    level: 5,
    labelKey: 'concept.COMBINAR_DIRECCIONES.label',
    summaryKey: 'concept.COMBINAR_DIRECCIONES.summary',
    japaneseTerm: 'nirensei',
    lessonId: 'n5-l5',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  // Nivel 6 (Joseki): mismo patron que Nivel 4 -- sin detector ni banco de
  // ejercicios, la afirmacion vive en la leccion misma (content/lessons/n6.ts).
  QUE_ES_JOSEKI: {
    id: 'QUE_ES_JOSEKI',
    level: 6,
    labelKey: 'concept.QUE_ES_JOSEKI.label',
    summaryKey: 'concept.QUE_ES_JOSEKI.summary',
    japaneseTerm: 'joseki',
    lessonId: 'n6-l1',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  BLOQUEO_HACIA_APOYO: {
    id: 'BLOQUEO_HACIA_APOYO',
    level: 6,
    labelKey: 'concept.BLOQUEO_HACIA_APOYO.label',
    summaryKey: 'concept.BLOQUEO_HACIA_APOYO.summary',
    lessonId: 'n6-l2',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  TENUKI_JOSEKI: {
    id: 'TENUKI_JOSEKI',
    level: 6,
    labelKey: 'concept.TENUKI_JOSEKI.label',
    summaryKey: 'concept.TENUKI_JOSEKI.summary',
    japaneseTerm: 'tenuki',
    lessonId: 'n6-l3',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  HOSHI_INVASION_3_3: {
    id: 'HOSHI_INVASION_3_3',
    level: 6,
    labelKey: 'concept.HOSHI_INVASION_3_3.label',
    summaryKey: 'concept.HOSHI_INVASION_3_3.summary',
    japaneseTerm: 'hoshi',
    lessonId: 'n6-l4',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  JOSEKI_SIMETRIA: {
    id: 'JOSEKI_SIMETRIA',
    level: 6,
    labelKey: 'concept.JOSEKI_SIMETRIA.label',
    summaryKey: 'concept.JOSEKI_SIMETRIA.summary',
    lessonId: 'n6-l5',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  // Nivel 7 (Fuseki): mismo patron que Nivel 4 y Nivel 5/6 -- sin detector ni
  // banco de ejercicios, la afirmacion vive en la leccion misma
  // (content/lessons/n7.ts).
  MOYO_NO_ES_TERRITORIO: {
    id: 'MOYO_NO_ES_TERRITORIO',
    level: 7,
    labelKey: 'concept.MOYO_NO_ES_TERRITORIO.label',
    summaryKey: 'concept.MOYO_NO_ES_TERRITORIO.summary',
    japaneseTerm: 'moyo',
    lessonId: 'n7-l1',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  JUICIO_LOCAL_VS_GLOBAL: {
    id: 'JUICIO_LOCAL_VS_GLOBAL',
    level: 7,
    labelKey: 'concept.JUICIO_LOCAL_VS_GLOBAL.label',
    summaryKey: 'concept.JUICIO_LOCAL_VS_GLOBAL.summary',
    lessonId: 'n7-l2',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  RELACION_CON_PIEDRAS_PROPIAS: {
    id: 'RELACION_CON_PIEDRAS_PROPIAS',
    level: 7,
    labelKey: 'concept.RELACION_CON_PIEDRAS_PROPIAS.label',
    summaryKey: 'concept.RELACION_CON_PIEDRAS_PROPIAS.summary',
    lessonId: 'n7-l3',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  PACIENCIA_Y_MARGEN: {
    id: 'PACIENCIA_Y_MARGEN',
    level: 7,
    labelKey: 'concept.PACIENCIA_Y_MARGEN.label',
    summaryKey: 'concept.PACIENCIA_Y_MARGEN.summary',
    lessonId: 'n7-l4',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  DIRECCION_NO_ES_TODO: {
    id: 'DIRECCION_NO_ES_TODO',
    level: 7,
    labelKey: 'concept.DIRECCION_NO_ES_TODO.label',
    summaryKey: 'concept.DIRECCION_NO_ES_TODO.summary',
    lessonId: 'n7-l5',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  // Nivel 8 (Medio juego: ataque y defensa): mismo patron.
  ATACAR_CONSTRUYENDO: {
    id: 'ATACAR_CONSTRUYENDO',
    level: 8,
    labelKey: 'concept.ATACAR_CONSTRUYENDO.label',
    summaryKey: 'concept.ATACAR_CONSTRUYENDO.summary',
    lessonId: 'n8-l1',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  USAR_PIEDRAS_PROPIAS_PARA_ATACAR: {
    id: 'USAR_PIEDRAS_PROPIAS_PARA_ATACAR',
    level: 8,
    labelKey: 'concept.USAR_PIEDRAS_PROPIAS_PARA_ATACAR.label',
    summaryKey: 'concept.USAR_PIEDRAS_PROPIAS_PARA_ATACAR.summary',
    lessonId: 'n8-l2',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  NO_PELEAR_CON_DEBILIDAD: {
    id: 'NO_PELEAR_CON_DEBILIDAD',
    level: 8,
    labelKey: 'concept.NO_PELEAR_CON_DEBILIDAD.label',
    summaryKey: 'concept.NO_PELEAR_CON_DEBILIDAD.summary',
    lessonId: 'n8-l3',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  SACRIFICAR_LO_NECESARIO: {
    id: 'SACRIFICAR_LO_NECESARIO',
    level: 8,
    labelKey: 'concept.SACRIFICAR_LO_NECESARIO.label',
    summaryKey: 'concept.SACRIFICAR_LO_NECESARIO.summary',
    lessonId: 'n8-l4',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  NO_PELEAR_SIN_NECESIDAD: {
    id: 'NO_PELEAR_SIN_NECESIDAD',
    level: 8,
    labelKey: 'concept.NO_PELEAR_SIN_NECESIDAD.label',
    summaryKey: 'concept.NO_PELEAR_SIN_NECESIDAD.summary',
    lessonId: 'n8-l5',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  // Nivel 9 (Yose): la mayoria sigue el mismo patron -- sin detector ni banco
  // de ejercicios, la afirmacion vive en la leccion (content/lessons/n9.ts),
  // pero ahi cada numero se calcula con el motor real en vez de citarse de un
  // libro. EL_FINAL_TAMBIEN_ES_GRANDE y COMPARAR_VALOR_REAL si tienen banco
  // (tools/generate-yose-value-problems.ts + solver/areaValue.ts, mismo
  // mecanismo que PASE_PREMATURO/RELLENO_TERRITORIO_PROPIO en nivel 1):
  // "cual es la mejor jugada aca" tiene una respuesta unica y verificable.
  // SENTE_Y_GOTE/SENTE_ANTES_QUE_GOTE y CONTAR_PARA_DECIDIR quedan afuera a
  // proposito -- sente/gote necesitaria comparar "valor si se ignora" contra
  // "valor si se responde" (una evaluacion a 2-3 jugadas, no un solo delta), y
  // CONTAR_PARA_DECIDIR ensena a leer el marcador agregado para elegir
  // estrategia, no a identificar una jugada -- forzarlo en el mismo mecanismo
  // de "elegir el mejor punto" etiquetaria mal el concepto (ver NOTAS.md).
  EL_FINAL_TAMBIEN_ES_GRANDE: {
    id: 'EL_FINAL_TAMBIEN_ES_GRANDE',
    level: 9,
    labelKey: 'concept.EL_FINAL_TAMBIEN_ES_GRANDE.label',
    summaryKey: 'concept.EL_FINAL_TAMBIEN_ES_GRANDE.summary',
    lessonId: 'n9-l1',
    hasDetector: false,
    generatesExercises: true,
    severity: 'low',
  },
  SENTE_Y_GOTE: {
    id: 'SENTE_Y_GOTE',
    level: 9,
    labelKey: 'concept.SENTE_Y_GOTE.label',
    summaryKey: 'concept.SENTE_Y_GOTE.summary',
    japaneseTerm: 'sente / gote',
    lessonId: 'n9-l2',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  SENTE_ANTES_QUE_GOTE: {
    id: 'SENTE_ANTES_QUE_GOTE',
    level: 9,
    labelKey: 'concept.SENTE_ANTES_QUE_GOTE.label',
    summaryKey: 'concept.SENTE_ANTES_QUE_GOTE.summary',
    lessonId: 'n9-l3',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  COMPARAR_VALOR_REAL: {
    id: 'COMPARAR_VALOR_REAL',
    level: 9,
    labelKey: 'concept.COMPARAR_VALOR_REAL.label',
    summaryKey: 'concept.COMPARAR_VALOR_REAL.summary',
    lessonId: 'n9-l4',
    hasDetector: false,
    generatesExercises: true,
    severity: 'low',
  },
  CONTAR_PARA_DECIDIR: {
    id: 'CONTAR_PARA_DECIDIR',
    level: 9,
    labelKey: 'concept.CONTAR_PARA_DECIDIR.label',
    summaryKey: 'concept.CONTAR_PARA_DECIDIR.summary',
    lessonId: 'n9-l5',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  // Nivel 10 (Semeai): la mayoria sigue sin banco de ejercicios, misma razon
  // que en nivel 9. CONTAR_LIBERTADES_ANTES_DE_JUGAR y
  // LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO si tienen banco
  // (tools/generate-semeai-liberty-problems.ts + solver/semeai.ts): contar
  // libertades y reconocer cuales son compartidas es 100% mecanico con
  // core/groups.ts, sin necesitar resolver quien gana la carrera. QUE_ES_SEMEAI
  // (definicion, no una habilidad para practicar), UN_OJO_GANA (necesitaria un
  // solucionador real de vida-muerte del espacio de ojo, no conteo de
  // libertades) y CONECTAR_EN_VEZ_DE_PELEAR (su leccion ni siquiera muestra una
  // carrera real) quedan afuera a proposito -- ver NOTAS.md.
  QUE_ES_SEMEAI: {
    id: 'QUE_ES_SEMEAI',
    level: 10,
    labelKey: 'concept.QUE_ES_SEMEAI.label',
    summaryKey: 'concept.QUE_ES_SEMEAI.summary',
    japaneseTerm: 'semeai',
    lessonId: 'n10-l1',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  CONTAR_LIBERTADES_ANTES_DE_JUGAR: {
    id: 'CONTAR_LIBERTADES_ANTES_DE_JUGAR',
    level: 10,
    labelKey: 'concept.CONTAR_LIBERTADES_ANTES_DE_JUGAR.label',
    summaryKey: 'concept.CONTAR_LIBERTADES_ANTES_DE_JUGAR.summary',
    lessonId: 'n10-l2',
    hasDetector: false,
    generatesExercises: true,
    severity: 'low',
  },
  LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO: {
    id: 'LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO',
    level: 10,
    labelKey: 'concept.LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO.label',
    summaryKey: 'concept.LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO.summary',
    japaneseTerm: 'dame',
    lessonId: 'n10-l3',
    hasDetector: false,
    generatesExercises: true,
    severity: 'low',
  },
  UN_OJO_GANA: {
    id: 'UN_OJO_GANA',
    level: 10,
    labelKey: 'concept.UN_OJO_GANA.label',
    summaryKey: 'concept.UN_OJO_GANA.summary',
    lessonId: 'n10-l4',
    hasDetector: false,
    generatesExercises: false,
    severity: 'low',
  },
  CONECTAR_EN_VEZ_DE_PELEAR: {
    id: 'CONECTAR_EN_VEZ_DE_PELEAR',
    level: 10,
    labelKey: 'concept.CONECTAR_EN_VEZ_DE_PELEAR.label',
    summaryKey: 'concept.CONECTAR_EN_VEZ_DE_PELEAR.summary',
    lessonId: 'n10-l5',
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
