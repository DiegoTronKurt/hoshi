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
   * explicitamente como pendiente). PlayConfigScreen.tsx muestra el aviso
   * "play.strength.disclaimer" junto al selector para no mostrar una
   * precision que no existe. */
  approxKyu: number
  labelKey: TranslationKey
  /** Cuanto pesa la prioridad de raiz de la red de KataGo (ver
   * engine/mcts.ts::MctsOptions.rootPriors) frente a una distribucion
   * uniforme, de 0 (ignorarla del todo, ni siquiera se pide la evaluacion)
   * a 1 (usarla tal cual). Valores de partida razonados, no calibrados
   * jugando partidas reales -- se ajustan con feedback real, mismo
   * disclaimer que ya aplica a approxKyu. `weak` en 0 a proposito: con solo
   * ~100 playouts (de los cuales, medido, apenas ~50 llegan a correr dentro
   * de maxTimeMs en un tablero real) el orden de expansion de la raiz decide
   * casi toda la partida sin tiempo para que UCT lo corrija -- justo el
   * nivel cuyo proposito es ser vencible por un principiante, es el mas
   * sensible a un sesgo de apertura, asi que se lo deja sin guia de red. */
  netInfluence: number
}

export const STRENGTH_LEVELS: StrengthLevel[] = [
  { id: 'weak', playouts: 100, maxTimeMs: 3000, approxKyu: 25, labelKey: 'play.strength.weak', netInfluence: 0 },
  { id: 'normal', playouts: 500, maxTimeMs: 6000, approxKyu: 20, labelKey: 'play.strength.normal', netInfluence: 0.4 },
  { id: 'strong', playouts: 2000, maxTimeMs: 10000, approxKyu: 15, labelKey: 'play.strength.strong', netInfluence: 0.7 },
  { id: 'veryStrong', playouts: 8000, maxTimeMs: 15000, approxKyu: 10, labelKey: 'play.strength.veryStrong', netInfluence: 1 },
]

/** Kyu aproximado de una partida guardada contra el bot, a partir del
 * `botStrengthId` guardado en su momento (ver PlayGameScreen.tsx). Null si
 * la partida es de antes de que ese campo existiera. */
export function approxKyuForStrengthId(strengthId: string | undefined): number | null {
  return STRENGTH_LEVELS.find((level) => level.id === strengthId)?.approxKyu ?? null
}
