import { getGroup } from '../core/groups'
import type { BoardState, Color } from '../core/types'

/**
 * Color del grupo que va perdiendo la carrera de captura entre los grupos
 * que tocan `groupAPoint` y `groupBPoint`: el que tiene menos libertades
 * totales (de afuera + compartidas). null si estan empatados (ahi el
 * resultado depende de quien juega primero, no es mecanico) o si alguno de
 * los dos puntos no tiene una piedra. Usada tanto por el generador
 * (tools/generate-semeai-liberty-problems.ts) como por la validacion en vivo
 * (useSolvableExercise.ts) -- nunca una respuesta precalculada y guardada.
 */
export function raceBehindColor(board: BoardState, groupAPoint: number, groupBPoint: number): Color | null {
  const groupA = getGroup(board, groupAPoint)
  const groupB = getGroup(board, groupBPoint)
  if (!groupA || !groupB) return null
  if (groupA.liberties.size === groupB.liberties.size) return null
  return groupA.liberties.size < groupB.liberties.size ? groupA.color : groupB.color
}

/**
 * Interseccion de las libertades de los dos grupos: los puntos que cuentan
 * para la carrera de ambos a la vez. null si alguno de los dos puntos no
 * tiene una piedra.
 */
export function sharedLibertiesOf(board: BoardState, groupAPoint: number, groupBPoint: number): Set<number> | null {
  const groupA = getGroup(board, groupAPoint)
  const groupB = getGroup(board, groupBPoint)
  if (!groupA || !groupB) return null

  const shared = new Set<number>()
  for (const liberty of groupA.liberties) {
    if (groupB.liberties.has(liberty)) shared.add(liberty)
  }
  return shared
}
