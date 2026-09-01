import type { TranslationKey } from '../../i18n'

export interface StrengthLevel {
  id: 'weak' | 'normal' | 'strong' | 'veryStrong'
  playouts: number
  /** Kyu aproximado, ESTIMADO a partir de la cantidad de playouts de un MCTS
   * con politica de rollout simple (no calibrado jugando partidas reales
   * contra cada nivel todavia -- roadmap maestro, seccion 2.2, lo marca
   * explicitamente como pendiente). Las etiquetas de traduccion incluyen
   * "estimado" a proposito, para no mostrar una precision que no existe. */
  approxKyu: number
  labelKey: TranslationKey
}

export const STRENGTH_LEVELS: StrengthLevel[] = [
  { id: 'weak', playouts: 100, approxKyu: 25, labelKey: 'play.strength.weak' },
  { id: 'normal', playouts: 500, approxKyu: 20, labelKey: 'play.strength.normal' },
  { id: 'strong', playouts: 2000, approxKyu: 15, labelKey: 'play.strength.strong' },
  { id: 'veryStrong', playouts: 8000, approxKyu: 10, labelKey: 'play.strength.veryStrong' },
]
