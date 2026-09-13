import { describe, expect, it } from 'vitest'
import { estimateKyuFromResults, pickLevelTestBattery } from '../../src/content/levelTest'
import type { LevelTestItemResult } from '../../src/content/levelTest'
import { listBankEntries } from '../../src/content/problemBank'

describe('pickLevelTestBattery', () => {
  it('devuelve 6 problemas (2 de cada dificultad) sin repetir ids', () => {
    const battery = pickLevelTestBattery()
    expect(battery.length).toBe(6)
    const byDifficulty = { easy: 0, medium: 0, hard: 0 }
    for (const entry of battery) byDifficulty[entry.difficulty]++
    expect(byDifficulty).toEqual({ easy: 2, medium: 2, hard: 2 })
    expect(new Set(battery.map((e) => e.id)).size).toBe(6)
  })

  it('cada problema elegido existe de verdad en el banco con esa dificultad', () => {
    const battery = pickLevelTestBattery()
    for (const entry of battery) {
      const real = listBankEntries().find((e) => e.id === entry.id)
      expect(real).toBeDefined()
      expect(real?.difficulty).toBe(entry.difficulty)
    }
  })
})

describe('estimateKyuFromResults', () => {
  it('devuelve null para una bateria vacia', () => {
    expect(estimateKyuFromResults([])).toBeNull()
  })

  it('resolver todo (incluidos los dificiles) da la estimacion mas fuerte de la escala', () => {
    const allSolved: LevelTestItemResult[] = [
      { difficulty: 'easy', solved: true },
      { difficulty: 'easy', solved: true },
      { difficulty: 'medium', solved: true },
      { difficulty: 'medium', solved: true },
      { difficulty: 'hard', solved: true },
      { difficulty: 'hard', solved: true },
    ]
    expect(estimateKyuFromResults(allSolved)).toBe(10)
  })

  it('no resolver nada da la estimacion mas debil de la escala', () => {
    const noneSolved: LevelTestItemResult[] = [
      { difficulty: 'easy', solved: false },
      { difficulty: 'easy', solved: false },
      { difficulty: 'medium', solved: false },
      { difficulty: 'medium', solved: false },
      { difficulty: 'hard', solved: false },
      { difficulty: 'hard', solved: false },
    ]
    expect(estimateKyuFromResults(noneSolved)).toBe(25)
  })

  it('resolver un problema dificil pesa mas que resolver uno facil', () => {
    const solvedHardOnly = estimateKyuFromResults([
      { difficulty: 'easy', solved: false },
      { difficulty: 'hard', solved: true },
    ])!
    const solvedEasyOnly = estimateKyuFromResults([
      { difficulty: 'easy', solved: true },
      { difficulty: 'hard', solved: false },
    ])!
    // Mas fuerte = numero de kyu mas chico.
    expect(solvedHardOnly).toBeLessThan(solvedEasyOnly)
  })
})
