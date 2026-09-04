import * as tf from '@tensorflow/tfjs'
import type { EncodedInput } from './features'
import { NN_LEN } from './features'
import { POLICY_PASS_INDEX } from './policy'

export { POLICY_PASS_INDEX, legalPolicyDistribution } from './policy'

const INPUT_BIN = 'swa_model/bin_inputs'
const INPUT_GLOBAL = 'swa_model/global_inputs'
const OUTPUT_POLICY = 'swa_model/policy_output'
const OUTPUT_VALUE = 'swa_model/value_output'
const OUTPUT_OWNERSHIP = 'swa_model/ownership_output'

export interface RawEvalOutput {
  /** Distribucion de probabilidad (softmax ya aplicado) sobre los 361
   * puntos de la grilla 19x19 (aplanado y*19+x) mas el pase en el indice
   * 361 (POLICY_PASS_INDEX) -- sin enmascarar por legalidad, esa es
   * responsabilidad de quien consume el resultado (ver
   * legalPolicyDistribution). */
  policy: Float32Array
  /** [P(gana quien pidio la evaluacion), P(pierde), P(sin resultado)],
   * softmax ya aplicado. Orden asumido de la cabeza de valor de KataGo
   * (win/loss/noResult); no hay forma de verificarlo de forma
   * independiente sin una instalacion real de KataGo para comparar, asi
   * que la sanidad se corrobora indirectamente en
   * tests/eval/model.test.ts con una posicion obviamente ganada. */
  value: [number, number, number]
  /** Ownership por punto de la grilla 19x19 (aplanado y*19+x), en [-1,1]
   * (tanh ya aplicado). Positivo = zona de quien pidio la evaluacion. */
  ownership: Float32Array
}

/**
 * Carga el modelo desde una URL (uso real en la app, vía fetch del
 * navegador -- ver eval/worker.ts). Cachea la promesa: cargar dos veces
 * devuelve el mismo modelo ya cargado, no dispara una segunda descarga.
 */
let cachedModel: Promise<tf.GraphModel> | null = null
export function loadModel(modelUrl: string): Promise<tf.GraphModel> {
  if (!cachedModel) cachedModel = tf.loadGraphModel(modelUrl)
  return cachedModel
}

/** Softmax manual: el grafo exportado no incluye la activacion final (los
 * outputs son logits crudos, confirmado corriendo el modelo real y viendo
 * magnitudes de miles sin acotar -- ver NOTAS.md). */
function softmax(logits: Float32Array): Float32Array {
  let max = -Infinity
  for (const v of logits) if (v > max) max = v
  let sum = 0
  const exp = new Float32Array(logits.length)
  for (let i = 0; i < logits.length; i++) {
    exp[i] = Math.exp(logits[i] - max)
    sum += exp[i]
  }
  for (let i = 0; i < exp.length; i++) exp[i] /= sum
  return exp
}

/**
 * Corre una pasada de inferencia. `model.execute` no sirve para este grafo
 * (tiene un `Merge` dinamico -- confirmado corriendo el modelo real, ver
 * NOTAS.md), hace falta `executeAsync`.
 */
export async function evaluatePosition(model: tf.GraphModel, input: EncodedInput): Promise<RawEvalOutput> {
  const binInputs = tf.tensor(input.spatial, [1, NN_LEN * NN_LEN, input.spatial.length / (NN_LEN * NN_LEN)])
  const globalInputs = tf.tensor(input.global, [1, input.global.length])

  try {
    const result = await model.executeAsync(
      { [INPUT_BIN]: binInputs, [INPUT_GLOBAL]: globalInputs },
      [OUTPUT_POLICY, OUTPUT_VALUE, OUTPUT_OWNERSHIP],
    )
    const [policyTensor, valueTensor, ownershipTensor] = result as tf.Tensor[]

    try {
      // policy_output: [1, 2, 362] -- la cabeza principal es el indice 0
      // del segundo eje; la cabeza [1] es auxiliar (no se usa aca).
      const policyData = await policyTensor.data() as Float32Array
      const policyLogits = policyData.slice(0, POLICY_PASS_INDEX + 1)

      const valueData = await valueTensor.data() as Float32Array
      const valueProbs = softmax(valueData)

      const ownershipData = await ownershipTensor.data() as Float32Array
      const ownership = new Float32Array(ownershipData.length)
      for (let i = 0; i < ownershipData.length; i++) ownership[i] = Math.tanh(ownershipData[i])

      return {
        policy: softmax(policyLogits),
        value: [valueProbs[0], valueProbs[1], valueProbs[2]],
        ownership,
      }
    } finally {
      policyTensor.dispose()
      valueTensor.dispose()
      ownershipTensor.dispose()
    }
  } finally {
    binInputs.dispose()
    globalInputs.dispose()
  }
}
