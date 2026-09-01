import type { TranslationKey } from '../../i18n'

export interface StrengthLevel {
  id: 'weak' | 'normal' | 'strong' | 'veryStrong'
  playouts: number
  /** Techo de tiempo por jugada del bot, ademas del limite de playouts: el
   * MCTS (src/engine/mcts.ts) corta la busqueda al primero de los dos que se
   * cumpla. Sin esto, un dispositivo lento podria tardar mucho en una
   * jugada de veryStrong; con esto, en el peor caso el bot simplemente
   * corre con menos playouts de los pedidos en vez de demorar sin limite. */
  maxTimeMs: number
  /** Kyu aproximado, ESTIMADO a partir de la cantidad de playouts de un MCTS
   * con politica de rollout simple (no calibrado jugando partidas reales
   * contra cada nivel todavia -- roadmap maestro, seccion 2.2, lo marca
   * explicitamente como pendiente). Las etiquetas de traduccion incluyen
   * "estimado" a proposito, para no mostrar una precision que no existe. */
  approxKyu: number
  labelKey: TranslationKey
}

export const STRENGTH_LEVELS: StrengthLevel[] = [
  { id: 'weak', playouts: 100, maxTimeMs: 3000, approxKyu: 25, labelKey: 'play.strength.weak' },
  { id: 'normal', playouts: 500, maxTimeMs: 6000, approxKyu: 20, labelKey: 'play.strength.normal' },
  { id: 'strong', playouts: 2000, maxTimeMs: 10000, approxKyu: 15, labelKey: 'play.strength.strong' },
  { id: 'veryStrong', playouts: 8000, maxTimeMs: 15000, approxKyu: 10, labelKey: 'play.strength.veryStrong' },
]
