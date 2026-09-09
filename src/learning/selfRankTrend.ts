import type { AttemptRecord, SavedGameRecord } from '../storage/db'
import { computeProfiles } from './profile'
import { computeSelfRankKyu } from './selfRank'
import type { SelfRankResult } from './selfRank'

const DEFAULT_TREND_WINDOW_DAYS = 30

export interface SelfRankTrend {
  past: SelfRankResult
  current: SelfRankResult
}

/**
 * Compara el rango estimado actual con el que hubiera dado la misma formula
 * usando solo la evidencia anterior a `windowDays` atras -- "calcular, no
 * guardar", igual que computeProfiles()/computeSelfRankKyu(): no se persiste
 * ningun snapshot historico, se recalcula la formula completa sobre un
 * subconjunto mas viejo de los mismos datos crudos (createdAt ya existe en
 * AttemptRecord y SavedGameRecord). Si no hay evidencia suficiente antes del
 * corte (cuenta nueva, o pocos intentos antes de esa fecha), `past.kyu` sale
 * null en vez de inventar una tendencia.
 */
export function computeSelfRankTrend(
  attempts: AttemptRecord[],
  games: SavedGameRecord[],
  windowDays: number = DEFAULT_TREND_WINDOW_DAYS,
): SelfRankTrend {
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
  const pastAttempts = attempts.filter((a) => a.createdAt < cutoff)
  const pastGames = games.filter((g) => g.createdAt < cutoff)

  const currentProfiles = computeProfiles(attempts, games)
  const pastProfiles = computeProfiles(pastAttempts, pastGames)

  return {
    past: computeSelfRankKyu(pastProfiles, pastGames),
    current: computeSelfRankKyu(currentProfiles, games),
  }
}
