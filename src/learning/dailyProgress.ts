import type { AttemptRecord } from '../storage/db'
import { toLocalDateKey } from './streak'

/**
 * Cuantos ejercicios se resolvieron hoy (dia calendario local), para mostrar
 * el progreso real contra la meta diaria en vez de solo la meta en si.
 * "Derivar, no persistir": mismo patron que computeStreak, sobre los mismos
 * intentos ya guardados. Solo cuenta intentos resueltos -- un intento
 * abandonado no cuenta para la meta, igual que un ejercicio sin terminar no
 * suma en ninguna otra parte de la app.
 */
export function countCompletedToday(attempts: AttemptRecord[], now: Date = new Date()): number {
  const todayKey = toLocalDateKey(now.toISOString())
  let count = 0
  for (const attempt of attempts) {
    if (attempt.solved && toLocalDateKey(attempt.createdAt) === todayKey) count++
  }
  return count
}
