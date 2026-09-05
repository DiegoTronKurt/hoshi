import { NN_LEN, gamePointToNNIndex } from './features'

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
 *
 * `width` es el ancho del tablero REAL (no necesariamente 19): `policy`
 * viene indexada en la grilla fija de la red (`y*19+x`, ver features.ts),
 * mientras que `legalPoints` viene en la convencion del tablero real
 * (`y*width+x`) -- ambas coinciden solo si width===19 o en la fila 0, asi
 * que hace falta convertir antes de indexar. Bug real encontrado y
 * corregido en esta misma sesion: el unico llamador (ReviewMistakeBoard)
 * indexaba `policy[p]` directo, dando el punto sugerido equivocado para
 * cualquier partida no-19x19.
 */
export function legalPolicyDistribution(
  policy: Float32Array,
  legalPoints: number[],
  legalPass: boolean,
  width: number,
): Map<number | null, number> {
  let sum = 0
  for (const p of legalPoints) sum += policy[gamePointToNNIndex(width, p)]
  if (legalPass) sum += policy[POLICY_PASS_INDEX]

  const result = new Map<number | null, number>()
  if (sum <= 0) {
    const uniform = 1 / (legalPoints.length + (legalPass ? 1 : 0))
    for (const p of legalPoints) result.set(p, uniform)
    if (legalPass) result.set(null, uniform)
    return result
  }

  for (const p of legalPoints) result.set(p, policy[gamePointToNNIndex(width, p)] / sum)
  if (legalPass) result.set(null, policy[POLICY_PASS_INDEX] / sum)
  return result
}

/**
 * Mezcla una distribucion (p.ej. la de legalPolicyDistribution) con una
 * uniforme sobre las mismas jugadas, segun `influence` (0 = ignorar la
 * distribucion por completo, 1 = usarla tal cual). Usado para que cada
 * nivel de fuerza del bot le de mas o menos peso a la red (ver
 * StrengthLevel.netInfluence en ui/play/strengthLevels.ts) sin tener que
 * volver a pedir la evaluacion con distinta intensidad.
 */
export function blendWithUniform(distribution: Map<number | null, number>, influence: number): Map<number | null, number> {
  if (influence >= 1) return distribution
  const uniform = 1 / distribution.size
  const blended = new Map<number | null, number>()
  for (const [move, weight] of distribution) {
    blended.set(move, influence * weight + (1 - influence) * uniform)
  }
  return blended
}
