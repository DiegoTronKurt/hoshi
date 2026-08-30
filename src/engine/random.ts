export type RandomFn = () => number

/**
 * Generador determinista (mulberry32). Con la misma semilla produce siempre
 * la misma secuencia, lo que hace reproducibles tanto los tests como una
 * eventual depuracion de una partida especifica del bot.
 */
export function createRng(seed: number): RandomFn {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: readonly T[], random: RandomFn): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function shuffledIndices(count: number, random: RandomFn): number[] {
  const indices = new Array<number>(count)
  for (let i = 0; i < count; i++) indices[i] = i
  return shuffle(indices, random)
}
