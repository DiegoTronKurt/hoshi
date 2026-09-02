import { neighbors, toXY } from '../core/board'
import { EMPTY, opponent } from '../core/types'
import type { BoardState, Color } from '../core/types'

export type BotStyleId = 'standard' | 'territorial' | 'influence' | 'combative'

export const BOT_STYLES: BotStyleId[] = ['standard', 'territorial', 'influence', 'combative']

function distanceToEdge(size: number, point: number): number {
  const [x, y] = toXY(size, point)
  return Math.min(x, y, size - 1 - x, size - 1 - y)
}

/**
 * Distancia (en pasos ortogonales) de cada punto del tablero al punto
 * ocupado mas cercano que cumple `matches`, calculada de una sola pasada por
 * BFS multi-fuente. -1 si no hay ningun punto que cumpla `matches`. Se usa
 * en vez de comparar cada candidato contra todas las piedras (cuadratico)
 * porque esto corre una vez por jugada de playout, y un MCTS fuerte corre
 * miles de esas por movimiento real.
 */
function bfsDistanceField(board: BoardState, matches: (stoneValue: number) => boolean): Int32Array {
  const n = board.stones.length
  const dist = new Int32Array(n).fill(-1)
  const queue: number[] = []
  for (let p = 0; p < n; p++) {
    if (matches(board.stones[p])) {
      dist[p] = 0
      queue.push(p)
    }
  }
  let head = 0
  while (head < queue.length) {
    const p = queue[head]
    head++
    for (const n2 of neighbors(board.size, p)) {
      if (dist[n2] === -1) {
        dist[n2] = dist[p] + 1
        queue.push(n2)
      }
    }
  }
  return dist
}

export interface StyleContext {
  style: BotStyleId
  anyStoneDistance?: Int32Array
  enemyStoneDistance?: Int32Array
}

/** Prepara, si el estilo lo necesita, la informacion de distancia sobre el
 * tablero actual (una sola vez por jugada de playout, no por candidato). */
export function prepareStyleContext(style: BotStyleId, board: BoardState, color: Color): StyleContext {
  if (style === 'influence') {
    return { style, anyStoneDistance: bfsDistanceField(board, (v) => v !== EMPTY) }
  }
  if (style === 'combative') {
    const opp = opponent(color)
    return { style, enemyStoneDistance: bfsDistanceField(board, (v) => v === opp) }
  }
  return { style }
}

/**
 * Peso relativo de un punto para la politica de playout, segun el estilo
 * elegido a mano para el bot (nunca derivado de las debilidades de quien
 * juega, ver roadmap maestro seccion 2.2). No es evaluacion posicional real
 * -- el bot sigue siendo MCTS con playouts al azar -- es un sesgo simple
 * sobre que tan seguido se prueba cada punto durante las simulaciones,
 * suficiente para que el estilo se note jugando sin fingir que el bot
 * "entiende" territorio o influencia.
 */
export function styleWeight(ctx: StyleContext, board: BoardState, point: number): number {
  switch (ctx.style) {
    case 'standard':
      return 1

    case 'territorial': {
      // Prefiere segunda y tercera linea (borde solido); evita la primera
      // linea (demasiado bajo) y el centro profundo (demasiado ambicioso).
      const edge = distanceToEdge(board.size, point)
      if (edge === 0) return 1
      if (edge <= 2) return 4
      return 1
    }

    case 'influence': {
      // Prefiere puntos centrales y alejados de piedras existentes: marcos
      // amplios en vez de peleas locales inmediatas.
      const edge = distanceToEdge(board.size, point)
      const stoneDistance = ctx.anyStoneDistance ? ctx.anyStoneDistance[point] : -1
      const openBonus = stoneDistance === -1 || stoneDistance >= 3 ? 2 : 1
      return (1 + edge) * openBonus
    }

    case 'combative': {
      // Prefiere contacto directo: apegos y cruces junto a piedras rivales.
      const enemyDistance = ctx.enemyStoneDistance ? ctx.enemyStoneDistance[point] : -1
      if (enemyDistance === 1) return 6
      if (enemyDistance === 2) return 2
      return 1
    }
  }
}
