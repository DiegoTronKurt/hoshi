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
   * softmax ya aplicado. Orden de la cabeza de valor de KataGo
   * (win/loss/noResult) confirmado dos veces: (1) por el propio paper de
   * KataGo (Wu 2020, apendice A.5, ver NOTAS-libro-katago-accelerating-selfplay.md)
   * y (2) empiricamente -- todo el pipeline de encodeInput+evaluatePosition
   * comparado contra una instalacion real de KataGo (mismos pesos exactos,
   * `katago.exe kata-raw-nn`, sin busqueda) en 3 posiciones (tablero vacio,
   * una apertura con historial real, una escalera real), acuerdo a 4-6
   * cifras significativas en value/policy/ownership -- ver NOTAS.md, sesion
   * 2026-09-05. La sanidad tambien se corrobora indirectamente en
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
 * Corre una pasada de inferencia sobre un lote de N posiciones a la vez
 * (una sola llamada a `executeAsync` para todo el lote, no N llamadas) --
 * el grafo exportado soporta batch arbitrario sin reconversion (es una red
 * convolucional comun, el batch es el eje 0 de siempre). `model.execute` no
 * sirve para este grafo (tiene un `Merge` dinamico -- confirmado corriendo
 * el modelo real, ver NOTAS.md), hace falta `executeAsync`.
 *
 * Medido en esta sesion con Chromium/WebGL real sobre el modelo
 * vendorizado: ~8ms/llamada practicamente constante entre batch 1 y 32 (el
 * costo esta dominado por el overhead fijo de la llamada, no por el
 * computo) -- por eso vale la pena juntar varias posiciones en una sola
 * llamada en vez de evaluarlas una por una (ver engine/mctsNet.ts, que es
 * quien de verdad se beneficia de esto).
 */
export async function evaluatePositionsBatch(model: tf.GraphModel, inputs: EncodedInput[]): Promise<RawEvalOutput[]> {
  const batch = inputs.length
  const spatialChannels = inputs[0].spatial.length / (NN_LEN * NN_LEN)
  const globalLen = inputs[0].global.length

  const spatial = new Float32Array(batch * inputs[0].spatial.length)
  const global = new Float32Array(batch * globalLen)
  for (let i = 0; i < batch; i++) {
    spatial.set(inputs[i].spatial, i * inputs[0].spatial.length)
    global.set(inputs[i].global, i * globalLen)
  }

  const binInputs = tf.tensor(spatial, [batch, NN_LEN * NN_LEN, spatialChannels])
  const globalInputs = tf.tensor(global, [batch, globalLen])

  try {
    const result = await model.executeAsync(
      { [INPUT_BIN]: binInputs, [INPUT_GLOBAL]: globalInputs },
      [OUTPUT_POLICY, OUTPUT_VALUE, OUTPUT_OWNERSHIP],
    )
    const [policyTensor, valueTensor, ownershipTensor] = result as tf.Tensor[]

    try {
      // policy_output: [batch, 2, 362] -- la cabeza principal es el indice 0
      // del segundo eje; la cabeza [1] es auxiliar (no se usa aca).
      const policyData = (await policyTensor.data()) as Float32Array
      const valueData = (await valueTensor.data()) as Float32Array
      const ownershipData = (await ownershipTensor.data()) as Float32Array

      const policyHeadLen = POLICY_PASS_INDEX + 1
      const policyStride = policyData.length / batch
      const ownershipStride = ownershipData.length / batch

      const outputs: RawEvalOutput[] = []
      for (let i = 0; i < batch; i++) {
        const policyLogits = policyData.slice(i * policyStride, i * policyStride + policyHeadLen)
        const valueProbs = softmax(valueData.slice(i * 3, i * 3 + 3))
        const ownershipRaw = ownershipData.slice(i * ownershipStride, (i + 1) * ownershipStride)
        const ownership = new Float32Array(ownershipRaw.length)
        for (let k = 0; k < ownershipRaw.length; k++) ownership[k] = Math.tanh(ownershipRaw[k])

        outputs.push({
          policy: softmax(policyLogits),
          value: [valueProbs[0], valueProbs[1], valueProbs[2]],
          ownership,
        })
      }
      return outputs
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

export async function evaluatePosition(model: tf.GraphModel, input: EncodedInput): Promise<RawEvalOutput> {
  const [result] = await evaluatePositionsBatch(model, [input])
  return result
}
