import { neighbors } from './board'
import { EMPTY, opponent } from './types'
import type { BoardState, Color } from './types'

interface Region {
  points: number[]
  borderingChains: Set<number>
  touchesOpponent: boolean
}

export interface BensonResult {
  chains: number[][]
  territoryPoints: number[]
}

/**
 * Algoritmo de Benson: determina qué cadenas de `color` son incondicionalmente
 * vivas (pass-alive), es decir, sobreviven aunque el propio jugador solo pase
 * el resto de la partida. Una cadena es pass-alive si, junto con otras cadenas
 * del mismo estado, delimita al menos dos regiones "sanas": regiones vacías que
 * no tocan ninguna piedra rival y cuyas cadenas vecinas también son pass-alive.
 */
export function bensonPassAlive(board: BoardState, color: Color): BensonResult {
  const opp = opponent(color)
  const width = board.width
  const height = board.height
  const chainOf = new Int32Array(board.stones.length).fill(-1)
  const chains: number[][] = []

  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] === color && chainOf[p] === -1) {
      const id = chains.length
      const stones: number[] = []
      const stack = [p]
      chainOf[p] = id
      while (stack.length > 0) {
        const q = stack.pop() as number
        stones.push(q)
        for (const n of neighbors(width, height, q)) {
          if (board.stones[n] === color && chainOf[n] === -1) {
            chainOf[n] = id
            stack.push(n)
          }
        }
      }
      chains.push(stones)
    }
  }

  const regionOf = new Int32Array(board.stones.length).fill(-1)
  const regions: Region[] = []

  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] === EMPTY && regionOf[p] === -1) {
      const id = regions.length
      const points: number[] = []
      const borderingChains = new Set<number>()
      let touchesOpponent = false
      const stack = [p]
      regionOf[p] = id
      while (stack.length > 0) {
        const q = stack.pop() as number
        points.push(q)
        for (const n of neighbors(width, height, q)) {
          const value = board.stones[n]
          if (value === EMPTY) {
            if (regionOf[n] === -1) {
              regionOf[n] = id
              stack.push(n)
            }
          } else if (value === color) {
            borderingChains.add(chainOf[n])
          } else if (value === opp) {
            touchesOpponent = true
          }
        }
      }
      regions.push({ points, borderingChains, touchesOpponent })
    }
  }

  const activeChains = new Set(chains.map((_, i) => i))
  const activeRegions = new Set(regions.map((_, i) => i))

  let changed = true
  while (changed) {
    changed = false

    for (const ri of Array.from(activeRegions)) {
      const region = regions[ri]
      if (region.touchesOpponent) {
        activeRegions.delete(ri)
        changed = true
        continue
      }
      for (const ci of region.borderingChains) {
        if (!activeChains.has(ci)) {
          activeRegions.delete(ri)
          changed = true
          break
        }
      }
    }

    for (const ci of Array.from(activeChains)) {
      let healthyRegionCount = 0
      for (const ri of activeRegions) {
        if (regions[ri].borderingChains.has(ci)) healthyRegionCount++
      }
      if (healthyRegionCount < 2) {
        activeChains.delete(ci)
        changed = true
      }
    }
  }

  return {
    chains: Array.from(activeChains).map((ci) => chains[ci]),
    territoryPoints: Array.from(activeRegions).flatMap((ri) => regions[ri].points),
  }
}
