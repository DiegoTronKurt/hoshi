import { NN_LEN } from './features'

/**
 * Separado de model.ts a proposito: este archivo no importa tfjs (solo
 * features.ts, que tampoco lo hace), asi que el hilo principal puede
 * importar legalPolicyDistribution (p.ej. ReviewMistakeBoard, para elegir
 * la jugada favorita de la red) sin arrastrar tfjs entero al bundle
 * principal -- eval/model.ts (que si importa tfjs) queda reservado al
 * Worker, que es donde corre de verdad la inferencia.
 */
export const POLICY_PASS_INDEX = NN_LEN * NN_LEN

/**
 * Redistribuye la politica cruda sobre solo las jugadas legales (mismo
 * criterio que aplica cualquier UI real: mostrar "esta jugada es
 * candidata" solo entre lo que de verdad se puede jugar). Si ninguna
 * jugada legal tiene probabilidad (caso degenerado, no deberia pasar en la
 * practica), reparte parejo entre las legales para no devolver NaN.
 */
export function legalPolicyDistribution(policy: Float32Array, legalPoints: number[], legalPass: boolean): Map<number | null, number> {
  let sum = 0
  for (const p of legalPoints) sum += policy[p]
  if (legalPass) sum += policy[POLICY_PASS_INDEX]

  const result = new Map<number | null, number>()
  if (sum <= 0) {
    const uniform = 1 / (legalPoints.length + (legalPass ? 1 : 0))
    for (const p of legalPoints) result.set(p, uniform)
    if (legalPass) result.set(null, uniform)
    return result
  }

  for (const p of legalPoints) result.set(p, policy[p] / sum)
  if (legalPass) result.set(null, policy[POLICY_PASS_INDEX] / sum)
  return result
}
