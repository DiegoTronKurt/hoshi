import type { Color } from '../../core/types'
import type { BotStyleId } from '../../engine/botStyles'
import type { StrengthLevel } from './strengthLevels'

export type GameMode = 'local' | 'bot'
export type DifficultyMode = 'manual' | 'adaptive'

/**
 * Config ya congelada para una partida en curso: se arma una sola vez en la
 * pantalla de configuracion (incluido el modo "adaptativo", que ahi mismo se
 * resuelve a un strengthId concreto) y viaja de solo lectura a la pantalla de
 * partida -- nunca se vuelve a editar mientras se juega.
 */
export interface PlayConfig {
  width: number
  height: number
  mode: GameMode
  strengthId: StrengthLevel['id']
  botStyle: BotStyleId
  humanColor: Color
  /** Regla de conteo para esta partida: China (area, piedras + territorio) o
   * Japonesa (solo territorio + capturas). Ver core/scoring.ts. */
  scoringRule: ScoringRule
  /** Posicion inicial distinta de un tablero vacio (p.ej. la partida de
   * comprobacion de una leccion, que arranca con las fichas del ejemplo ya
   * puestas en vez de un tablero en blanco). Ausente en una partida normal. */
  initialStones?: Int8Array
  initialToMove?: Color
}

export type ScoringRule = 'chinese' | 'japanese'

/** Posicion con la que arrancar una partida en vez de un tablero vacio --
 * mismo shape que DemoScript (content/lessons/types.ts), la usa el boton
 * "Partida de comprobacion" de una leccion para llevar a esa posicion en vez
 * de a un tablero en blanco desconectado del ejemplo. Sin scoringRule: una
 * leccion no tiene nocion de regla de conteo, seededConfig la fija en
 * 'chinese' como cualquier partida nueva por defecto. */
export interface PlaySeed {
  width: number
  height: number
  stones: Int8Array
  toMove: Color
}

const STORAGE_KEY = 'hoshi-last-play-config'

/** Ultima configuracion elegida en la pantalla de "Configurar partida",
 * incluido el modo de dificultad (manual/adaptativo) tal como se eligio, no
 * ya resuelto -- a diferencia de PlayConfig, esto es solo para precargar el
 * formulario la proxima vez, nunca viaja a la pantalla de partida. */
export interface LastPlayConfig {
  width: number
  height: number
  mode: GameMode
  difficultyMode: DifficultyMode
  strengthId: StrengthLevel['id']
  botStyle: BotStyleId
  humanColor: Color
  scoringRule: ScoringRule
}

// Un LastPlayConfig guardado antes del soporte de tablero rectangular o de
// conteo japones solo tiene `size` (no width/height) y no tiene scoringRule.
// isValidLastConfig los rechaza (devuelve null) en vez de intentar
// migrarlos: loadLastPlayConfig ya esta preparado para eso (vuelve a los
// valores por defecto del formulario), asi que un blob viejo simplemente se
// descarta una vez en vez de necesitar codigo de migracion.
function isValidLastConfig(value: unknown): value is LastPlayConfig {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.width === 'number' &&
    typeof v.height === 'number' &&
    (v.mode === 'local' || v.mode === 'bot') &&
    (v.difficultyMode === 'manual' || v.difficultyMode === 'adaptive') &&
    typeof v.strengthId === 'string' &&
    typeof v.botStyle === 'string' &&
    (v.humanColor === 1 || v.humanColor === 2) &&
    (v.scoringRule === 'chinese' || v.scoringRule === 'japanese')
  )
}

export function loadLastPlayConfig(): LastPlayConfig | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isValidLastConfig(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveLastPlayConfig(config: LastPlayConfig): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // sin persistencia disponible (modo privado, cuota llena): el formulario
    // simplemente vuelve a sus valores por defecto la proxima vez
  }
}
