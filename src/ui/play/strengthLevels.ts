import type { TranslationKey } from '../../i18n'

export interface StrengthLevel {
  id: 'weak' | 'normal' | 'strong' | 'veryStrong' | 'expert' | 'maxima'
  playouts: number
  /** Techo de tiempo por jugada del bot, ademas del limite de playouts: el
   * motor (classic: src/engine/mcts.ts, net: src/engine/mctsNet.ts) corta la
   * busqueda al primero de los dos que se cumpla. Sin esto, un dispositivo
   * lento podria tardar mucho en una jugada fuerte; con esto, en el peor
   * caso el bot simplemente corre con menos playouts de los pedidos en vez
   * de demorar sin limite. */
  maxTimeMs: number
  /** Kyu aproximado, ESTIMADO a partir de la cantidad de playouts de un MCTS
   * con politica de rollout simple (no calibrado jugando partidas reales
   * contra cada nivel todavia -- roadmap maestro, seccion 2.2, lo marca
   * explicitamente como pendiente). PlayConfigScreen.tsx muestra el aviso
   * "play.strength.disclaimer" junto al selector para no mostrar una
   * precision que no existe. null para 'maxima': ni siquiera hay una forma
   * razonada de estimar un kyu a partir de "cantidad de playouts" para ese
   * nivel (el motor es cualitativamente distinto, no un MCTS clasico con mas
   * playouts, ver mas abajo) -- mejor no mostrar ningun numero que inventar
   * uno sin ninguna base. */
  approxKyu: number | null
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
   * sensible a un sesgo de apertura, asi que se lo deja sin guia de red. Sin
   * efecto para 'net' (no usa rootPriors, ver `engine` abajo) -- queda en 0
   * ahi solo para no dejar el campo sin definir. */
  netInfluence: number
  /** 'classic': engine/mcts.ts, rollout aleatorio hasta el final de la
   * partida, la red solo aporta rootPriors (ver netInfluence). 'net':
   * engine/mctsNet.ts, busqueda PUCT que consulta la red en cada nodo que
   * expande (politica Y valor, no solo un sesgo de orden en la raiz) --
   * cualitativamente mas fuerte por jugada de red consultada, no solo "mas
   * playouts del mismo tipo", pero bastante mas lento por jugada. Unico
   * nivel verificado por comparacion real de auto-juego contra 'veryStrong'
   * en vez de solo por el numero de playouts -- ver NOTAS.md. */
  engine: 'classic' | 'net'
}

export const STRENGTH_LEVELS: StrengthLevel[] = [
  { id: 'weak', playouts: 100, maxTimeMs: 3000, approxKyu: 25, labelKey: 'play.strength.weak', netInfluence: 0, engine: 'classic' },
  { id: 'normal', playouts: 500, maxTimeMs: 6000, approxKyu: 20, labelKey: 'play.strength.normal', netInfluence: 0.4, engine: 'classic' },
  { id: 'strong', playouts: 2000, maxTimeMs: 10000, approxKyu: 15, labelKey: 'play.strength.strong', netInfluence: 0.7, engine: 'classic' },
  { id: 'veryStrong', playouts: 8000, maxTimeMs: 15000, approxKyu: 10, labelKey: 'play.strength.veryStrong', netInfluence: 1, engine: 'classic' },
  // Fase 3 (A4, escalon intermedio real entre veryStrong y maxima): mismo
  // motor 'net' que maxima (consulta politica+valor en cada nodo, no solo
  // rootPriors), con un presupuesto bastante menor -- 300 playouts es
  // exactamente la configuracion ya puesta a prueba en auto-juego real
  // contra veryStrong (ver NOTAS.md, cont. 29: 4 partidas 7x7 con GPU real,
  // 2-2, motor nuevo corriendo A PROPOSITO con menos presupuesto que
  // 'maxima' para no sesgar la comparacion a su favor) -- no es un numero
  // elegido sin evidencia. maxTimeMs generoso (15s) frente al tiempo tipico
  // esperado en movil real (~1/4 del tiempo medido para 1200 playouts en
  // cont. 35: 29-34s -> ~7-8s para 300, con margen de sobra). approxKyu
  // null por el mismo motivo que 'maxima': no hay forma honesta de estimar
  // uno para un motor cualitativamente distinto sin partidas de referencia
  // reales (inventar uno repetiria el problema que ese mismo principio ya
  // evito una vez).
  { id: 'expert', playouts: 300, maxTimeMs: 15000, approxKyu: null, labelKey: 'play.strength.expert', netInfluence: 0, engine: 'net' },
  { id: 'maxima', playouts: 1200, maxTimeMs: 45000, approxKyu: null, labelKey: 'play.strength.maxima', netInfluence: 0, engine: 'net' },
]

/** Kyu aproximado de una partida guardada contra el bot, a partir del
 * `botStrengthId` guardado en su momento (ver PlayGameScreen.tsx). Null si
 * la partida es de antes de que ese campo existiera, o si el nivel jugado
 * no tiene un kyu estimado en absoluto (ver StrengthLevel.approxKyu). */
export function approxKyuForStrengthId(strengthId: string | undefined): number | null {
  return STRENGTH_LEVELS.find((level) => level.id === strengthId)?.approxKyu ?? null
}
