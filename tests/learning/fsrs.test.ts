import { describe, expect, it } from 'vitest'
import { Rating, createCard, gradeFromAttempt, isDue, reviewCard } from '../../src/learning/fsrs'

describe('envoltorio de FSRS', () => {
  it('una tarjeta recien creada esta vencida de inmediato', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const card = createCard(now)
    expect(isDue(card, now)).toBe(true)
  })

  it('calificar Bien programa la proxima revision en el futuro', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const card = createCard(now)
    const reviewed = reviewCard(card, Rating.Good, now)
    expect(reviewed.due.getTime()).toBeGreaterThan(now.getTime())
    expect(isDue(reviewed, now)).toBe(false)
  })

  it('calificar Otra vez programa una revision mas cercana que Bien', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const afterGood = reviewCard(createCard(now), Rating.Good, now)
    const afterAgain = reviewCard(createCard(now), Rating.Again, now)
    expect(afterAgain.due.getTime()).toBeLessThanOrEqual(afterGood.due.getTime())
  })

  it('gradeFromAttempt: no resuelto es Otra vez', () => {
    expect(gradeFromAttempt(false, 0)).toBe(Rating.Again)
  })

  it('gradeFromAttempt: resuelto sin errores es Bien', () => {
    expect(gradeFromAttempt(true, 0)).toBe(Rating.Good)
  })

  it('gradeFromAttempt: resuelto con errores previos es Dificil', () => {
    expect(gradeFromAttempt(true, 2)).toBe(Rating.Hard)
  })
})
