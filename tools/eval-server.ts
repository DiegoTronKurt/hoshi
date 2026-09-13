/**
 * Servidor de referencia para E3 del roadmap (inferencia remota opcional).
 * Envuelve el MISMO modelo vendorizado (public/models/kata-b10c128/) y el
 * mismo pipeline evaluatePosition/evaluatePositionsBatch que ya corre en el
 * Worker del navegador (eval/worker.ts) -- no es un modelo distinto ni una
 * aproximacion, solo el mismo calculo movido a un proceso Node que alguien
 * puede correr en una maquina con mas capacidad que su telefono.
 *
 * Esta app NUNCA despliega, aloja ni paga un servidor por su cuenta: correr
 * esto (y donde exponerlo -- una VPS propia, un servicio de hosting, etc.,
 * con HTTPS si se expone fuera de una red local) es decision de quien lo
 * use. Ver src/eval/remoteClient.ts (el cliente que le habla a esto) y
 * settings.remoteEval.* en Ajustes para configurar la URL en la app.
 *
 * Uso: `npx vite-node tools/eval-server.ts [puerto]` (por defecto 8787).
 */
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as tf from '@tensorflow/tfjs'
import { encodeInput } from '../src/eval/features'
import { evaluatePosition, evaluatePositionsBatch } from '../src/eval/model'
import { decodeEvalPosition, encodeRawEvalOutput } from '../src/eval/wireFormat'
import type { WireEvalPosition } from '../src/eval/wireFormat'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MODEL_DIR = path.resolve(__dirname, '../public/models/kata-b10c128')
const PORT = Number(process.argv[2]) || 8787

/** Mismo IOHandler de disco que tests/eval/model.test.ts y
 * tests/ui/review/fullGameReview.test.ts (leer el modelo vendorizado sin
 * pasar por un fetch de navegador) -- cacheado una sola vez por proceso, no
 * por request. */
let cachedModel: Promise<tf.GraphModel> | null = null
function loadVendoredModel(): Promise<tf.GraphModel> {
  if (cachedModel) return cachedModel
  cachedModel = (async () => {
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
  })()
  return cachedModel
}

async function readJsonBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const server = createServer(async (req, res) => {
  // CORS abierto a proposito: este servidor no tiene autenticacion propia
  // (nada que proteger salvo ciclos de CPU/GPU) y la app puede correr desde
  // cualquier origen (localhost en desarrollo, el dominio real en produccion,
  // o un WebView de Android sin origen HTTP tradicional).
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  try {
    const model = await loadVendoredModel()

    if (req.method === 'POST' && req.url === '/evaluate') {
      const wire = (await readJsonBody(req)) as WireEvalPosition
      const position = decodeEvalPosition(wire)
      const result = await evaluatePosition(model, encodeInput(position))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(encodeRawEvalOutput(result)))
      return
    }

    if (req.method === 'POST' && req.url === '/evaluateBatch') {
      const wire = (await readJsonBody(req)) as WireEvalPosition[]
      const positions = wire.map(decodeEvalPosition)
      const results = await evaluatePositionsBatch(model, positions.map(encodeInput))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(results.map(encodeRawEvalOutput)))
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
  }
})

server.listen(PORT, () => {
  console.log(`eval-server escuchando en http://localhost:${PORT} (/evaluate, /evaluateBatch)`)
})
