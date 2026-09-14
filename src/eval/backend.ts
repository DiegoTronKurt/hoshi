import { createEvalClient } from './client'
import type { EvalPosition } from './features'
import type { RawEvalOutput } from './model'
import { RemoteEvalClient } from './remoteClient'
import type { MctsResult } from '../engine/mcts'

/**
 * Forma comun entre EvalClient (Worker local, siempre disponible) y
 * RemoteEvalClient (HTTP a un servidor externo, E3 del roadmap --
 * inferencia remota opcional). Quien consume un cliente de evaluacion
 * (FullGameReviewPanel, ReviewMistakeBoard, DojoScreen) programa contra esto,
 * no contra EvalClient directo, para no tener que saber cual de los dos
 * backends esta activo.
 */
export interface EvalBackend {
  evaluate(position: EvalPosition, timeoutMs?: number): Promise<RawEvalOutput>
  evaluateBatch(positions: EvalPosition[], timeoutMs?: number): Promise<RawEvalOutput[]>
  /** true solo para el backend local: el Worker ahi mismo ya tiene el modelo
   * cargado y puede correr engine/mctsNet.ts sobre el (ver analyzeDeeply).
   * RemoteEvalClient es deliberadamente solo-evaluacion (ver su propio
   * comentario), asi que siempre es false -- Fase 4 del plan de contenido:
   * quien consuma esto debe ocultar el boton de "analizar mas profundo" en
   * vez de mostrarlo deshabilitado o dejar que analyzeDeeply tire. */
  readonly supportsDeepAnalysis: boolean
  /** Busqueda PUCT real (engine/mctsNet.ts, el mismo motor que ya elige la
   * jugada del bot en Jugar) sobre esta posicion puntual, a diferencia de
   * evaluate()/evaluateBatch() (una sola pasada hacia adelante, sin mirar
   * jugadas futuras) -- "Analizar mas profundo" en Revisar. `winRate` en la
   * misma perspectiva que evaluate()'s value[0]: quien mueve en `position`.
   * Solo llamar cuando supportsDeepAnalysis es true. */
  analyzeDeeply(position: EvalPosition, playouts: number, timeoutMs?: number): Promise<MctsResult>
  terminate(): void
}

/**
 * Backend segun la preferencia de Ajustes (SettingsContext.remoteEvalUrl):
 * remoto si hay una URL configurada, local (el Worker de siempre) si no.
 * Solo para las pantallas de analisis (Revisar, Partidas historicas, Dojo)
 * -- deliberadamente NO se uso para el bot en Jugar ni para las pistas de
 * Ejercicios, donde una red externa lenta o caida degradaria una mecanica
 * central de la app en vez de una herramienta de analisis opcional.
 */
export function createEvalBackend(remoteEvalUrl: string | null): EvalBackend {
  return remoteEvalUrl ? new RemoteEvalClient(remoteEvalUrl) : createEvalClient()
}
