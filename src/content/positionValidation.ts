import { getGroup } from '../core/groups'
import type { BoardState, Color } from '../core/types'
import { EMPTY } from '../core/types'

/**
 * true si todas las piedras de `color` en el tablero forman un solo grupo
 * conectado (no dos o mas fragmentos separados). Aplicable tanto a la forma
 * que se esta construyendo a mano (color del jugador objetivo) como al fondo
 * que la rodea (color rival): son el mismo chequeo, solo cambia el color.
 *
 * Recomendado por el roadmap (seccion 3 y 11.1) como el primer paso antes de
 * razonar geometria de posiciones semilla a mano: corre esto sobre cada
 * intento antes de pasarlo al solucionador, para descartar en segundos una
 * posicion con una piedra o un bolsillo aislado, en vez de despues de
 * construir la forma completa.
 */
export function isSingleGroup(board: BoardState, color: Color): boolean {
  const stones: number[] = []
  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] === color) stones.push(p)
  }
  if (stones.length === 0) return true

  const group = getGroup(board, stones[0])
  return group !== null && group.stones.length === stones.length
}

/**
 * true si ningun grupo de ningun color esta en 0 libertades en la posicion
 * dada, es decir, es un estado de tablero legal en si mismo (no llego ahi por
 * una jugada ilegal, no tiene una piedra "ya capturada" parada de fondo).
 * Un chequeo de sanidad general, complementario a isSingleGroup, sobre
 * cualquier posicion armada a mano antes de pasarla al solucionador.
 */
export function hasNoZeroLibertyGroups(board: BoardState): boolean {
  const visited = new Set<number>()
  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] === EMPTY || visited.has(p)) continue
    const group = getGroup(board, p)
    if (!group) continue
    for (const stone of group.stones) visited.add(stone)
    if (group.liberties.size === 0) return false
  }
  return true
}
