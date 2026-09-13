import { createEvalClient } from './client'
import type { EvalPosition } from './features'
import type { RawEvalOutput } from './model'
import { RemoteEvalClient } from './remoteClient'

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
