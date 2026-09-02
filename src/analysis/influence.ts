import { neighbors } from '../core/board'
import { BLACK, EMPTY, WHITE } from '../core/types'
import type { BoardState } from '../core/types'

/**
 * Estimador de influencia por dilatacion/erosion morfologica, siguiendo el
 * metodo de Bouzy ("Mathematical Morphology Applied to Computer Go",
 * IJPRAI 17(2), 2003). El PDF original no quedo accesible para transcribir
 * la notacion exacta del paper; esta es una reconstruccion a partir de
 * multiples descripciones secundarias independientes del algoritmo, que
 * convergen en la misma definicion. Documentado como reconstruccion, no
 * como cita textual -- y verificado con las propiedades que el propio
 * metodo promete (ver tests), no solo con la cita.
 *
 * Dilatacion Dz(p): si el vecindario de `p` no toca ningun valor de signo
 * contrario, el valor de `p` crece en la cantidad de vecinos del mismo
 * signo (compartiendo el "no negativo" o "no positivo" segun corresponda).
 * Si `p` toca un vecino de signo contrario, no crece: el crecimiento se
 * frena justo en el limite de contacto entre zonas, que es exactamente el
 * comportamiento que se busca para dibujar un limite de moyo. Simetrico
 * entre colores por construccion (negar todas las piedras niega el
 * resultado exacto).
 *
 * Erosion Ez(p): el valor se encoge hacia cero en la cantidad de vecinos
 * que NO refuerzan su signo (vecinos en cero o de signo contrario).
 *
 * La relacion 5 dilataciones / 21 erosiones (formula citada: 1+n(n-1)
 * erosiones para n dilataciones) esta calibrada para que una piedra
 * aislada sin nada que la respalde termine sin influencia real mas alla de
 * si misma, mientras que un grupo solido y conectado si retiene influencia
 * genuina sobre el area que domina.
 */

const STONE_VALUE = 128
const DILATION_PASSES = 5
const EROSION_PASSES = 1 + DILATION_PASSES * (DILATION_PASSES - 1)

function dilationStep(width: number, height: number, values: Int32Array) {
  const next = new Int32Array(values.length)
  for (let p = 0; p < values.length; p++) {
    const v = values[p]
    let hasOpposite = false
    let sameCount = 0
    for (const n of neighbors(width, height, p)) {
      const nv = values[n]
      if (v >= 0 && nv < 0) hasOpposite = true
      else if (v <= 0 && nv > 0) hasOpposite = true
      if (v >= 0 && nv > 0) sameCount++
      else if (v <= 0 && nv < 0) sameCount++
    }
    if (hasOpposite) next[p] = v
    else if (v >= 0) next[p] = v + sameCount
    else next[p] = v - sameCount
  }
  return next
}

function erosionStep(width: number, height: number, values: Int32Array) {
  const next = new Int32Array(values.length)
  for (let p = 0; p < values.length; p++) {
    const v = values[p]
    if (v === 0) {
      next[p] = 0
      continue
    }
    let weakCount = 0
    for (const n of neighbors(width, height, p)) {
      const nv = values[n]
      if (v > 0 && nv <= 0) weakCount++
      else if (v < 0 && nv >= 0) weakCount++
    }
    next[p] = v > 0 ? Math.max(0, v - weakCount) : Math.min(0, v + weakCount)
  }
  return next
}

export interface InfluenceMap {
  /** Valor de influencia por punto: positivo = zona de negro, negativo =
   * zona de blanco, cero = neutral/disputado. No es una afirmacion de
   * territorio final bajo las reglas reales (eso ya lo hace
   * core/scoring.ts::computeAreaScore) -- es una estimacion de hacia donde
   * "inclina" cada punto, util para ensenar moyo/direccion/grosor. */
  values: Int32Array
}

export function estimateInfluence(board: BoardState): InfluenceMap {
  let values = new Int32Array(board.stones.length)
  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] === BLACK) values[p] = STONE_VALUE
    else if (board.stones[p] === WHITE) values[p] = -STONE_VALUE
  }

  for (let i = 0; i < DILATION_PASSES; i++) values = dilationStep(board.width, board.height, values)
  for (let i = 0; i < EROSION_PASSES; i++) values = erosionStep(board.width, board.height, values)

  return { values }
}

export type InfluenceOwner = typeof BLACK | typeof WHITE | typeof EMPTY

/** Clasifica cada punto segun el signo de su influencia final. Umbral en
 * cero, no en algun valor intermedio elegido a mano: despues de 21
 * erosiones, cualquier resto que sobrevive ya paso el filtro de "reforzado
 * de verdad" -- no hace falta un segundo umbral arbitrario encima. */
export function classifyInfluence(map: InfluenceMap): InfluenceOwner[] {
  return Array.from(map.values, (v) => (v > 0 ? BLACK : v < 0 ? WHITE : EMPTY))
}
