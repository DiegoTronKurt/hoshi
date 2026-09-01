import type { ConceptId } from './concepts'
import type { ConceptProfile } from '../learning/profile'

/**
 * Agrupacion de los ConceptId en 6 ejes tematicos, para el radar de la
 * pantalla Perfil (especificacion de pantallas, seccion 7). Un eje por
 * concepto crudo seria ilegible con ~26 conceptos; esta agrupacion es la
 * "agregacion" que la especificacion siempre asumio, no un reemplazo de la
 * lista de barras por concepto que ya existe (roadmap maestro, seccion 2.3).
 */
export type AxisId = 'RULES_COUNTING' | 'CAPTURING' | 'LIFE_AND_DEATH' | 'READING' | 'SHAPE' | 'JUDGMENT'

export const ALL_AXIS_IDS: AxisId[] = ['RULES_COUNTING', 'CAPTURING', 'LIFE_AND_DEATH', 'READING', 'SHAPE', 'JUDGMENT']

export const AXIS_CONCEPTS: Record<AxisId, ConceptId[]> = {
  RULES_COUNTING: ['LIBERTADES', 'KO', 'CONTEO_AREA', 'RELLENO_TERRITORIO_PROPIO', 'PASE_PREMATURO'],
  CAPTURING: ['CAPTURA_SIMPLE', 'ATARI_IGNORADO', 'AUTOATARI', 'CAPTURA_PERDIDA', 'DOBLE_ATARI'],
  LIFE_AND_DEATH: [
    'DOS_OJOS',
    'OJO_FALSO',
    'RELLENO_OJO_PROPIO',
    'PUNTO_VITAL',
    'NAKADE',
    'GRUPO_MURIO_SIN_OJOS',
    'PIEDRA_MUERTA_ATACADA_EN_VANO',
  ],
  READING: ['ESCALERA', 'ESCALERA_FALLIDA', 'RED_GETA', 'SNAPBACK'],
  SHAPE: ['CORTE_NO_DEFENDIDO', 'CONEXION_INNECESARIA', 'TRIANGULO_VACIO'],
  JUDGMENT: ['PRIMERA_LINEA_TEMPRANA', 'JUGADA_LEJOS_DEL_COMBATE'],
}

export const AXIS_LABEL_KEY: Record<AxisId, string> = {
  RULES_COUNTING: 'axis.RULES_COUNTING.label',
  CAPTURING: 'axis.CAPTURING.label',
  LIFE_AND_DEATH: 'axis.LIFE_AND_DEATH.label',
  READING: 'axis.READING.label',
  SHAPE: 'axis.SHAPE.label',
  JUDGMENT: 'axis.JUDGMENT.label',
}

export interface AxisScore {
  axisId: AxisId
  /** Promedio de los conceptos del eje que ya tienen evidencia; null si
   * ninguno la tiene todavia. */
  score: number | null
  conceptsWithData: number
  conceptsTotal: number
}

export function computeAxisScores(profiles: Record<ConceptId, ConceptProfile>): AxisScore[] {
  return ALL_AXIS_IDS.map((axisId) => {
    const conceptIds = AXIS_CONCEPTS[axisId]
    const scores = conceptIds.map((id) => profiles[id]?.score).filter((s): s is number => s !== null && s !== undefined)
    return {
      axisId,
      score: scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : null,
      conceptsWithData: scores.length,
      conceptsTotal: conceptIds.length,
    }
  })
}
