import { applyMove, createGame } from '../core/rules'
import { parseSgf, sgfToGameRecord } from '../core/sgf'
import type { SavedGameRecord } from '../storage/db'

export type SgfImportError = 'parse' | 'handicap-unsupported' | 'no-result'

export type SgfImportResult =
  | { ok: true; record: Omit<SavedGameRecord, 'id'> }
  | { ok: false; error: SgfImportError }

/**
 * Valida y convierte el texto de un archivo SGF externo (exportado de otro
 * cliente, no jugado en esta app) en un registro listo para storage/db.ts.
 * A diferencia de analysis/mistakes.ts::analyzeGame, que ante una jugada
 * ilegal simplemente corta el analisis ahi (una partida real interrumpida
 * por datos malos), un import corrupto que terminara truncado en Revisar
 * sin explicacion seria mas confuso que rechazarlo de entrada -- por eso
 * esta funcion reproduce la partida entera contra el motor de reglas real
 * antes de aceptarla.
 */
export function buildImportedGameRecord(text: string): SgfImportResult {
  let root
  try {
    root = parseSgf(text).root
  } catch {
    return { ok: false, error: 'parse' }
  }

  // AB/AW (piedras iniciales) no las lee sgfToGameRecord -- una partida de
  // hándicap importada sin ellas arrancaria replay() desde tablero vacio y
  // asignaria mal los colores apenas la primera jugada real no fuera negra
  // (ver el chequeo move.color mas abajo). Se rechaza aca con un mensaje
  // propio en vez de dejar que ese chequeo la rebote como "parse" generico.
  if ((root.properties.AB?.length ?? 0) > 0 || (root.properties.AW?.length ?? 0) > 0) {
    return { ok: false, error: 'handicap-unsupported' }
  }

  const { width, height, komi, moves, result } = sgfToGameRecord(text)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || moves.length === 0) {
    return { ok: false, error: 'parse' }
  }

  let state = createGame(width, height, komi)
  for (const move of moves) {
    if (move.color !== state.toMove) return { ok: false, error: 'parse' }
    const applied = applyMove(state, move.point)
    if (!applied.legal || !applied.state) return { ok: false, error: 'parse' }
    state = applied.state
  }

  if (!result) return { ok: false, error: 'no-result' }

  return {
    ok: true,
    record: { createdAt: new Date().toISOString(), width, height, komi, mode: 'local', result, sgf: text },
  }
}
