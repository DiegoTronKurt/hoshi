import { Rating, createEmptyCard, fsrs } from 'ts-fsrs'
import type { Card, Grade } from 'ts-fsrs'

export type { Card, Grade }
export { Rating }

const scheduler = fsrs()

export function createCard(now: Date = new Date()): Card {
  return createEmptyCard(now)
}

export function reviewCard(card: Card, grade: Grade, now: Date = new Date()): Card {
  return scheduler.next(card, now, grade).card
}

export function isDue(card: Card, now: Date = new Date()): boolean {
  return card.due.getTime() <= now.getTime()
}

/**
 * Traduce el resultado (binario, sin autoevaluacion) de un intento de
 * ejercicio a una nota FSRS de 4 niveles. La pantalla de Ejercicios/Hoy no
 * le pide a la persona que se autoevalue (Otra vez/Dificil/Bien/Facil): el
 * propio solucionador ya valida cada jugada, asi que la nota se deriva de lo
 * que ya sabemos. "Facil" no se usa nunca por esta via: sin una senal de
 * "lo resolvi mas rapido de lo esperado", asumirlo seria inventar
 * informacion que no tenemos.
 */
export function gradeFromAttempt(solved: boolean, wrongAttempts: number): Grade {
  if (!solved) return Rating.Again
  if (wrongAttempts > 0) return Rating.Hard
  return Rating.Good
}
