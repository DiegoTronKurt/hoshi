import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as tf from '@tensorflow/tfjs'
import { encodeInput } from '../../src/eval/features'
import { evaluatePosition } from '../../src/eval/model'
import { createBoard, toPoint } from '../../src/core/board'
import { gameStateFromBoard } from '../../src/core/rules'
import { BLACK, WHITE } from '../../src/core/types'

const MODEL_DIR = path.resolve(__dirname, '../../public/models/kata-b10c128')

/**
 * En el navegador, eval/model.ts carga el modelo con `tf.loadGraphModel(url)`
 * (fetch normal). Bajo vitest/Node no hay fetch de archivo local, asi que
 * el test arma su propio IOHandler leyendo los mismos archivos del disco
 * -- mismo modelo, mismos pesos, solo un mecanismo de carga distinto para
 * poder probarlo sin un navegador real.
 */
async function loadVendoredModel(): Promise<tf.GraphModel> {
  const modelJson = JSON.parse(readFileSync(path.join(MODEL_DIR, 'model.json'), 'utf8'))
  const shardNames = modelJson.weightsManifest[0].paths as string[]
  const shards = shardNames.map((name) => readFileSync(path.join(MODEL_DIR, name)))
  const weightData = Buffer.concat(shards).buffer as ArrayBuffer

  const handler: tf.io.IOHandler = {
    load: async () => ({
      modelTopology: modelJson.modelTopology,
      weightSpecs: modelJson.weightsManifest[0].weights,
      weightData,
      format: modelJson.format,
      generatedBy: modelJson.generatedBy,
      convertedBy: modelJson.convertedBy,
    }),
  }
  return tf.loadGraphModel(handler)
}

/** Tablero 9x9 donde negro domina claramente: pared solida mas territorio
 * grande, blanco casi sin nada. No es una posicion real jugada, es
 * deliberadamente unilateral para poder verificar que el valor devuelto
 * por la red distingue "voy ganando" de "voy perdiendo" -- el unico tipo
 * de verificacion de sentido comun posible sobre un modelo de caja negra,
 * ya que no hay forma de confirmar independientemente que un juicio
 * posicional puntual de la red es "correcto" segun teoria de Go. */
function buildLopsidedBoard() {
  const board = createBoard(9)
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 7; x++) board.stones[toPoint(9, x, y)] = BLACK
  }
  board.stones[toPoint(9, 8, 8)] = WHITE
  return board
}

describe('evaluatePosition (integracion real contra el modelo vendorizado)', () => {
  it('carga el modelo vendorizado y corre una pasada sin tirar error', async () => {
    const model = await loadVendoredModel()
    const state = gameStateFromBoard(createBoard(9), BLACK, 6.5)
    const input = encodeInput({ state })

    const result = await evaluatePosition(model, input)

    expect(result.policy.length).toBe(362)
    expect(result.ownership.length).toBe(361)
    expect(result.value.length).toBe(3)
  }, 30000)

  it('la politica es una distribucion de probabilidad valida (suma 1, todo en [0,1])', async () => {
    const model = await loadVendoredModel()
    const state = gameStateFromBoard(createBoard(9), BLACK, 6.5)
    const input = encodeInput({ state })

    const result = await evaluatePosition(model, input)

    let sum = 0
    for (const p of result.policy) {
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
      sum += p
    }
    expect(sum).toBeCloseTo(1, 3)
  }, 30000)

  it('el valor es una distribucion de probabilidad valida (suma 1, todo en [0,1])', async () => {
    const model = await loadVendoredModel()
    const state = gameStateFromBoard(createBoard(9), BLACK, 6.5)
    const input = encodeInput({ state })

    const result = await evaluatePosition(model, input)

    const [win, loss, noResult] = result.value
    expect(win).toBeGreaterThanOrEqual(0)
    expect(loss).toBeGreaterThanOrEqual(0)
    expect(noResult).toBeGreaterThanOrEqual(0)
    expect(win + loss + noResult).toBeCloseTo(1, 3)
  }, 30000)

  it('el ownership queda acotado en [-1,1]', async () => {
    const model = await loadVendoredModel()
    const state = gameStateFromBoard(createBoard(9), BLACK, 6.5)
    const input = encodeInput({ state })

    const result = await evaluatePosition(model, input)
    for (const o of result.ownership) {
      expect(o).toBeGreaterThanOrEqual(-1)
      expect(o).toBeLessThanOrEqual(1)
    }
  }, 30000)

  it('distingue una posicion claramente ganada de la misma posicion claramente perdida', async () => {
    const model = await loadVendoredModel()
    const board = buildLopsidedBoard()

    const asWinner = await evaluatePosition(model, encodeInput({ state: gameStateFromBoard(board, BLACK, 6.5) }))
    const asLoser = await evaluatePosition(model, encodeInput({ state: gameStateFromBoard(board, WHITE, 6.5) }))

    // No se afirma un umbral exacto (séría inventar una expectativa de
    // fuerza de juego sin poder verificarla) -- solo que el modelo
    // realmente distingue direccion: gana mucho mas seguido para quien
    // domina el tablero que para quien no.
    expect(asWinner.value[0]).toBeGreaterThan(asLoser.value[0])
  }, 30000)
})
