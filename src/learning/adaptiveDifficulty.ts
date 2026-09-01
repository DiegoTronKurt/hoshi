import { BLACK } from '../core/types'
import type { Color } from '../core/types'
import type { SavedGameRecord } from '../storage/db'
import { STRENGTH_LEVELS } from '../ui/play/strengthLevels'
import type { StrengthLevel } from '../ui/play/strengthLevels'

/** Cuantas partidas recientes contra el bot entran en la ventana de ajuste. */
export const ADAPTIVE_WINDOW = 10
/** Minimo de partidas en la ventana antes de mover el nivel: con menos,
 * cualquier racha corta (buena o mala) empujaria el nivel sin evidencia
 * real. */
export const ADAPTIVE_MIN_GAMES = 3
/** Umbrales de tasa de victoria que disparan un ajuste, apuntando a que la
 * persona gane alrededor de la mitad de sus partidas: por encima del techo,
 * sube un nivel; por debajo del piso, baja uno. Entre medio, se queda. */
export const ADAPTIVE_STEP_UP_WIN_RATE = 0.65
export const ADAPTIVE_STEP_DOWN_WIN_RATE = 0.35

const DEFAULT_LEVEL_ID: StrengthLevel['id'] = 'normal'
const LEVEL_ORDER = STRENGTH_LEVELS.map((level) => level.id)

export interface AdaptiveDifficultyResult {
  strengthId: StrengthLevel['id']
  /** Cuantas partidas de la ventana realmente se usaron para el calculo. */
  sampleSize: number
  /** null si sampleSize < ADAPTIVE_MIN_GAMES (todavia sin evidencia suficiente). */
  winRate: number | null
}

function isUsableAdaptiveGame(
  game: SavedGameRecord,
): game is SavedGameRecord & { humanColor: Color; botStrengthId: StrengthLevel['id'] } {
  return (
    game.mode === 'bot' &&
    game.humanColor !== undefined &&
    game.botStrengthId !== undefined &&
    (LEVEL_ORDER as string[]).includes(game.botStrengthId)
  )
}

function didHumanWin(game: SavedGameRecord & { humanColor: Color }): boolean {
  const humanColorLabel = game.humanColor === BLACK ? 'black' : 'white'
  return game.result.winner === humanColorLabel
}

/**
 * Deriva el proximo nivel de fuerza del bot a partir de las ultimas
 * ADAPTIVE_WINDOW partidas jugadas contra el, sin ningun estado persistido
 * propio: el mismo patron de "calcular, no guardar" que computeProfiles()
 * y planSession() ya usan sobre attempts/games. Partidas guardadas antes de
 * que existiera este campo (sin humanColor/botStrengthId) se ignoran en vez
 * de asumirles un valor.
 */
export function computeAdaptiveStrength(games: SavedGameRecord[]): AdaptiveDifficultyResult {
  const usable = games
    .filter(isUsableAdaptiveGame)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, ADAPTIVE_WINDOW)

  if (usable.length === 0) {
    return { strengthId: DEFAULT_LEVEL_ID, sampleSize: 0, winRate: null }
  }

  const currentLevelId = usable[0].botStrengthId
  const currentIndex = LEVEL_ORDER.indexOf(currentLevelId)

  if (usable.length < ADAPTIVE_MIN_GAMES) {
    return { strengthId: currentLevelId, sampleSize: usable.length, winRate: null }
  }

  const wins = usable.filter(didHumanWin).length
  const winRate = wins / usable.length

  let nextIndex = currentIndex
  if (winRate >= ADAPTIVE_STEP_UP_WIN_RATE) {
    nextIndex = Math.min(currentIndex + 1, LEVEL_ORDER.length - 1)
  } else if (winRate <= ADAPTIVE_STEP_DOWN_WIN_RATE) {
    nextIndex = Math.max(currentIndex - 1, 0)
  }

  return { strengthId: LEVEL_ORDER[nextIndex], sampleSize: usable.length, winRate }
}
