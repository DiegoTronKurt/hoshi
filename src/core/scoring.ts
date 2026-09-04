import { neighbors } from './board'
import { BLACK, EMPTY, WHITE } from './types'
import type { BoardState } from './types'

export interface AreaScore {
  black: number
  white: number
}

/**
 * Dueño de cada punto bajo conteo de área (reglas chinas): piedras propias
 * quedan como su color; un punto vacío rodeado exclusivamente por un color
 * pasa a ser de ese color; un punto vacío bordeado por ambos colores (dame)
 * queda neutral (EMPTY). Compartido por computeAreaScore (agregado) y por
 * el estimador de evaluación posicional (src/eval/features.ts), que
 * necesita el dueño punto por punto, no solo el total.
 */
export function computeAreaOwnership(board: BoardState, deadStones: ReadonlySet<number> = new Set()): Int8Array {
  const width = board.width
  const height = board.height
  const owner = board.stones.slice()
  for (const p of deadStones) owner[p] = EMPTY

  const visited = new Uint8Array(owner.length)
  for (let p = 0; p < owner.length; p++) {
    if (owner[p] !== EMPTY || visited[p]) continue

    const region: number[] = []
    const borderColors = new Set<number>()
    const stack = [p]
    visited[p] = 1
    while (stack.length > 0) {
      const q = stack.pop() as number
      region.push(q)
      for (const n of neighbors(width, height, q)) {
        const value = owner[n]
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
      for (const q of region) owner[q] = color
    }
  }

  return owner
}

/**
 * Conteo de área (reglas chinas): piedras propias en el tablero más puntos
 * vacíos rodeados exclusivamente por un color. Un punto vacío bordeado por
 * ambos colores (dame) no cuenta para nadie.
 */
export function computeAreaScore(board: BoardState, komi: number, deadStones: ReadonlySet<number> = new Set()): AreaScore {
  const owner = computeAreaOwnership(board, deadStones)

  let black = 0
  let white = 0
  for (let p = 0; p < owner.length; p++) {
    if (owner[p] === BLACK) black++
    else if (owner[p] === WHITE) white++
  }

  return { black, white: white + komi }
}

/**
 * Conteo por territorio (reglas japonesas): a diferencia del conteo de área,
 * las piedras propias en el tablero no suman punto por si solas -- solo los
 * puntos originalmente vacios que quedan rodeados exclusivamente por un
 * color (mismo flood-fill de computeAreaOwnership), mas las capturas ya
 * hechas durante la partida (`captures`, ver GameState en core/types.ts).
 * Sin parametro deadStones a proposito: una piedra marcada como muerta le
 * daria territorio al capturador via el flood-fill, pero le faltaria sumar
 * la piedra en si como prisionera (eso solo se registra durante la partida
 * real, en applyMove) -- nada en la app marca piedras muertas todavia (no
 * existe esa pantalla), asi que agregar el parametro ahora solo abriria la
 * puerta a un resultado incorrecto sin necesidad real.
 */
export function computeTerritoryScore(board: BoardState, komi: number, captures: { black: number; white: number }): AreaScore {
  const owner = computeAreaOwnership(board)

  let blackTerritory = 0
  let whiteTerritory = 0
  for (let p = 0; p < owner.length; p++) {
    if (board.stones[p] !== EMPTY) continue
    if (owner[p] === BLACK) blackTerritory++
    else if (owner[p] === WHITE) whiteTerritory++
  }

  return {
    black: blackTerritory + captures.black,
    white: whiteTerritory + captures.white + komi,
  }
}
