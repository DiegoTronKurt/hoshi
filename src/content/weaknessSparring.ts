import type { ConceptId } from '../analysis/concepts'
import type { ConceptProfile } from '../learning/profile'
import { weakestConcepts } from '../learning/profile'
import { initialToMove } from '../ui/exercises/useSolvableExercise'
import type { PlaySeed } from '../ui/play/playConfig'
import { listBankEntries, loadEntry } from './problemBank'

export interface WeaknessSparringSeed {
  conceptId: ConceptId
  seed: PlaySeed
}

/**
 * Fase 3, D1 ("modos de bot deliberadamente instructivos"): en vez de
 * intentar sesgar el MCTS para que "cree" a proposito una situacion de un
 * concepto elegido (heuristica nueva y sin verificar por concepto, misma
 * clase de problema que ya evito rectangularDeSeis/joseki al preferir un
 * fragmento chico y probado), esto arranca una partida de verdad contra el
 * bot desde una posicion REAL del banco ya verificado (Principio 1 aplica
 * igual que en Ejercicios), elegida al azar entre las del concepto donde
 * `weakestConcepts` (ya usado en Perfil) muestra el peor puntaje. El humano
 * juega el lado que le toca resolver la posicion (`initialToMove`, la misma
 * funcion que ya usa useSolvableExercise.ts para Ejercicios); el bot
 * responde con normalidad y la partida sigue como cualquier otra, en vez de
 * terminar en cuanto se resuelve el problema puntual -- la idea es practicar
 * el concepto DENTRO de una partida que continua, no resolver un puzzle
 * aislado una vez mas.
 *
 * Null si `weakestConcepts` no tiene ningun concepto con evidencia todavia
 * (mismo caso que profile.selfRank.insufficientData en Perfil) -- no hay
 * nada que priorizar sin haber practicado o jugado nada antes.
 */
export function pickWeaknessSparringSeed(profiles: Record<ConceptId, ConceptProfile>): WeaknessSparringSeed | null {
  const [weakest] = weakestConcepts(profiles, 1)
  if (!weakest) return null

  const entries = listBankEntries(weakest.conceptId)
  if (entries.length === 0) return null
  const entry = entries[Math.floor(Math.random() * entries.length)]
  const loaded = loadEntry(entry)
  const { board } = loaded.problem
  const toMove = initialToMove(loaded)

  return {
    conceptId: weakest.conceptId,
    seed: { width: board.width, height: board.height, stones: board.stones, toMove, mode: 'bot' },
  }
}
