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

/** Igual que shuffle(range(count)), pero sin la copia extra de shuffle(): el
 * array recien creado aca no tiene otro dueño, así que se puede barajar en
 * el lugar en vez de clonarlo primero (mismo algoritmo, mismo consumo de
 * random(), sin la asignacion de mas). */
export function shuffledIndices(count: number, random: RandomFn): number[] {
  const indices = new Array<number>(count)
  for (let i = 0; i < count; i++) indices[i] = i
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices
}
