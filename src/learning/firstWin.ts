import { BLACK } from '../core/types'
import type { Color } from '../core/types'
import type { SavedGameRecord } from '../storage/db'

export interface FirstWinResult {
  /** Milisegundos entre la primera apertura y la primera partida ganada
   * contra el bot; null si todavia no gano ninguna, o si no hay fecha de
   * primera apertura registrada (ver learning/firstOpen.ts). */
  elapsedMs: number | null
}

function didHumanWin(game: SavedGameRecord & { humanColor: Color }): boolean {
  const humanColorLabel = game.humanColor === BLACK ? 'black' : 'white'
  return game.result.winner === humanColorLabel
}

/**
 * Tiempo hasta la primera victoria, autoreportado (documento de diseno
 * original, seccion 11.3: "si supera los 40 minutos, el nivel 0 esta mal
 * disenado", nunca antes instrumentado). Solo cuenta victorias contra el
 * bot, no partidas locales entre dos personas compartiendo el dispositivo:
 * ahi no hay forma de saber cual de los dos jugadores es "quien esta
 * aprendiendo con la app", asi que contarlas daria una medida sin sentido.
 * Sin telemetria: se calcula localmente a partir de partidas ya guardadas,
 * visible solo para quien juega (Perfil).
 */
export function computeFirstWin(games: SavedGameRecord[], firstOpenAt: string | null): FirstWinResult {
  if (firstOpenAt === null) return { elapsedMs: null }

  const wins = games
    .filter((g): g is SavedGameRecord & { humanColor: Color } => g.mode === 'bot' && g.humanColor !== undefined)
    .filter(didHumanWin)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  if (wins.length === 0) return { elapsedMs: null }

  const elapsedMs = new Date(wins[0].createdAt).getTime() - new Date(firstOpenAt).getTime()
  return { elapsedMs: Math.max(0, elapsedMs) }
}

export type FirstWinUnit = 'minutes' | 'hours' | 'days'

export interface FirstWinDisplay {
  unit: FirstWinUnit
  value: number
}

/** Redondea el tiempo transcurrido a la unidad mas legible (minutos si es
 * menos de una hora, horas si es menos de un dia, dias en cualquier otro
 * caso), para mostrar en Perfil sin decimales raros. */
export function bucketFirstWin(elapsedMs: number): FirstWinDisplay {
  const minutes = elapsedMs / 60_000
  if (minutes < 60) return { unit: 'minutes', value: Math.max(1, Math.round(minutes)) }
  const hours = minutes / 60
  if (hours < 24) return { unit: 'hours', value: Math.round(hours) }
  return { unit: 'days', value: Math.round(hours / 24) }
}
