import { neighbors } from './board'
import { BLACK, EMPTY, WHITE } from './types'
import type { BoardState } from './types'

export interface AreaScore {
  black: number
  white: number
}

/**
 * Conteo de área (reglas chinas): piedras propias en el tablero más puntos
 * vacíos rodeados exclusivamente por un color. Un punto vacío bordeado por
 * ambos colores (dame) no cuenta para nadie.
 */
export function computeAreaScore(board: BoardState, komi: number, deadStones: ReadonlySet<number> = new Set()): AreaScore {
  const size = board.size
  const effective = board.stones.slice()
  for (const p of deadStones) effective[p] = EMPTY

  let black = 0
  let white = 0
  for (let p = 0; p < effective.length; p++) {
    if (effective[p] === BLACK) black++
    else if (effective[p] === WHITE) white++
  }

  const visited = new Uint8Array(effective.length)
  for (let p = 0; p < effective.length; p++) {
    if (effective[p] !== EMPTY || visited[p]) continue

    const region: number[] = []
    const borderColors = new Set<number>()
    const stack = [p]
    visited[p] = 1
    while (stack.length > 0) {
      const q = stack.pop() as number
      region.push(q)
      for (const n of neighbors(size, q)) {
        const value = effective[n]
        if (value === EMPTY) {
          if (!visited[n]) {
            visited[n] = 1
            stack.push(n)
          }
        } else {
          borderColors.add(value)
        }
      }
    }

    if (borderColors.size === 1) {
      const [color] = borderColors
      if (color === BLACK) black += region.length
      else white += region.length
    }
  }

  return { black, white: white + komi }
}
