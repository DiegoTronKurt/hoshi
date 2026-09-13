import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as tf from '@tensorflow/tfjs'
import { createBoard, toPoint } from '../../../src/core/board'
import { gameStateFromBoard } from '../../../src/core/rules'
import { BLACK, EMPTY, WHITE } from '../../../src/core/types'
import type { RecordedMove } from '../../../src/core/sgf'
import { encodeInput, gamePointToNNIndex, NN_LEN } from '../../../src/eval/features'
import { evaluatePositionsBatch } from '../../../src/eval/model'
import { POLICY_PASS_INDEX } from '../../../src/eval/policy'
import { buildFullGameEvalPositions, explainSwing, formatSwingPercent, summarizeWinRates } from '../../../src/ui/review/fullGameReview'

const MODEL_DIR = path.resolve(__dirname, '../../../public/models/kata-b10c128')

/** Misma tecnica que tests/eval/model.test.ts: IOHandler propio leyendo los
 * archivos del modelo vendorizado del disco, para poder cargarlo bajo
 * Node/vitest sin un fetch de navegador real. */
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

const W = 9

function move(color: typeof BLACK | typeof WHITE, x: number, y: number): RecordedMove {
  return { color, point: toPoint(W, x, y) }
}

describe('buildFullGameEvalPositions', () => {
  it('produce N+1 posiciones para N jugadas legales, la primera sin piedras', () => {
    const moves: RecordedMove[] = [move(BLACK, 2, 2), move(WHITE, 6, 6), move(BLACK, 3, 3)]
    const positions = buildFullGameEvalPositions(W, W, 6.5, moves)

    expect(positions).toHaveLength(4)
    expect(positions[0].state.board.stones.every((s) => s === EMPTY)).toBe(true)
    expect(positions[3].state.board.stones[toPoint(W, 3, 3)]).toBe(BLACK)
  })

  it('recentMoves de cada posicion son como maximo las 5 jugadas previas, sin incluir la propia', () => {
    const moves: RecordedMove[] = Array.from({ length: 8 }, (_, i) =>
      move(i % 2 === 0 ? BLACK : WHITE, i, 0),
    )
    const positions = buildFullGameEvalPositions(W, W, 6.5, moves)

    // positions[7]: 7 jugadas ya aplicadas (moves[0..6]) -- las ultimas 5 son moves[2..6].
    expect(positions[7].recentMoves).toEqual(moves.slice(2, 7))
    // positions[2]: solo 2 jugadas jugadas todavia -- no hay 5 para tomar.
    expect(positions[2].recentMoves).toEqual(moves.slice(0, 2))
    // positions[0]: posicion inicial, sin historial.
    expect(positions[0].recentMoves).toEqual([])
  })

  it('priorBoards se satura contra el estado inicial al principio de la partida, no se deja vacio', () => {
    const moves: RecordedMove[] = [move(BLACK, 2, 2), move(WHITE, 6, 6)]
    const positions = buildFullGameEvalPositions(W, W, 6.5, moves)

    // positions[0] y positions[1] no tienen 2 jugadas reales de historial:
    // ambos elementos de priorBoards deben caer en el mismo tablero (el
    // mas antiguo disponible), en vez de quedar undefined.
    expect(positions[0].priorBoards?.[0]).toBe(positions[0].priorBoards?.[1])
    expect(positions[1].priorBoards?.[0]).toBe(positions[0].state.board)
  })

  it('una jugada ilegal corta la reproduccion ahi, sin lanzar', () => {
    const moves: RecordedMove[] = [move(BLACK, 2, 2), move(WHITE, 2, 2), move(BLACK, 3, 3)]
    const positions = buildFullGameEvalPositions(W, W, 6.5, moves)

    expect(positions).toHaveLength(2) // inicial + solo moves[0]
  })
})

describe('summarizeWinRates', () => {
  const moves: RecordedMove[] = [move(BLACK, 0, 0), move(WHITE, 1, 1), move(BLACK, 2, 2)]

  it('la curva alterna de perspectiva segun a quien le tocaba en cada posicion', () => {
    // value[0] es siempre "P(gana quien tiene el turno)" -- en indice par
    // le toca a negro (se usa tal cual), en indice impar le toca a blanco
    // (se invierte para expresar todo en perspectiva de negro).
    const values = [0.5, 0.9, 0.5, 0.9]
    const { curve } = summarizeWinRates(moves, values)

    const probs = curve.map((p) => p.blackWinProbability)
    expect(probs[0]).toBeCloseTo(0.5, 9)
    expect(probs[1]).toBeCloseTo(0.1, 9)
    expect(probs[2]).toBeCloseTo(0.5, 9)
    expect(probs[3]).toBeCloseTo(0.1, 9)
    expect(curve.map((p) => p.moveNumber)).toEqual([0, 1, 2, 3])
  })

  it('calcula la caida de cada jugada desde la perspectiva de quien la jugo', () => {
    // Jugada 1 (negro): 70% antes -> tras jugar, blanco queda con 80% ->
    // negro queda con 20% -> cayo 50 puntos porcentuales.
    const values = [0.7, 0.8, 0.5]
    const { swings } = summarizeWinRates(moves.slice(0, 2), values)

    expect(swings).toHaveLength(2)
    const first = swings.find((s) => s.moveNumber === 1)
    expect(first?.color).toBe(BLACK)
    expect(first?.swing).toBeCloseTo(0.5, 9)
  })

  it('ordena las caidas de mayor a menor', () => {
    const values = [0.5, 0.55, 0.9, 0.85]
    const { swings } = summarizeWinRates(moves, values)

    for (let i = 1; i < swings.length; i++) {
      expect(swings[i - 1].swing).toBeGreaterThanOrEqual(swings[i].swing)
    }
  })
})

describe('explainSwing', () => {
  // Tablero 3x3 vacio: los 9 puntos mas el pase son legales para negro. La
  // politica es sintetica (no viene de la red real, a diferencia del resto
  // de esta suite) -- legalPolicyDistribution renormaliza sobre las
  // candidatas legales, asi que solo importa la magnitud RELATIVA entre
  // ellas, no que ya sea una distribucion de probabilidad valida.
  const width = 3
  const state = gameStateFromBoard(createBoard(width, width), BLACK)

  function syntheticPolicy(entries: Array<[point: number, weight: number]>): Float32Array {
    const policy = new Float32Array(NN_LEN * NN_LEN + 1)
    for (const [point, weight] of entries) policy[gamePointToNNIndex(width, point)] = weight
    return policy
  }

  it('jugada de bajo rango: puesto y probabilidades reflejan que otra jugada era muy favorita', () => {
    const played = toPoint(width, 0, 0)
    const favorite = toPoint(width, 2, 2)
    const policy = syntheticPolicy([
      [played, 1],
      [favorite, 10],
    ])

    const result = explainSwing(policy, state, played)

    expect(result.rank).toBe(2)
    expect(result.candidateCount).toBe(10) // 9 puntos + pase
    expect(result.playedProbability).toBeCloseTo(1 / 11, 9)
    expect(result.topProbability).toBeCloseTo(10 / 11, 9)
  })

  it('jugada ya favorita: rank 1 y topProbability === playedProbability', () => {
    const played = toPoint(width, 1, 1)
    const policy = syntheticPolicy([[played, 5]])

    const result = explainSwing(policy, state, played)

    expect(result.rank).toBe(1)
    expect(result.playedProbability).toBeCloseTo(result.topProbability, 9)
  })

  it('el pase cuenta como candidata legal cuando corresponde', () => {
    const played = toPoint(width, 1, 1)
    const policy = syntheticPolicy([[played, 1]])
    policy[POLICY_PASS_INDEX] = 3 // el pase es la jugada favorita de la red aca

    const result = explainSwing(policy, state, played)

    expect(result.rank).toBe(2)
    expect(result.topProbability).toBeCloseTo(3 / 4, 9)
  })
})

describe('formatSwingPercent', () => {
  it('redondea a entero cuando no hay riesgo de confundir con cero', () => {
    expect(formatSwingPercent(0.67)).toBe('67')
    expect(formatSwingPercent(0)).toBe('0')
    expect(formatSwingPercent(1)).toBe('100')
  })

  it('usa un decimal para una probabilidad chica pero real, para no mostrar "0%"', () => {
    expect(formatSwingPercent(0.004)).toBe('0.4')
    expect(formatSwingPercent(0.0035)).toBe('0.4')
  })
})

describe('pipeline completo contra el modelo vendorizado (integracion real)', () => {
  // Nota importante descubierta escribiendo este test (ver NOTAS.md para el
  // detalle completo): la red cruda, SIN busqueda (una sola pasada por
  // posicion, igual que ReviewMistakeBoard::askAi -- no hay MCTS de por
  // medio en este pipeline), puede juzgar mal una captura local chica en un
  // tablero por lo demas casi vacio -- en una corrida real de esta
  // secuencia, la probabilidad de negro paso de ~93% a ~4% justo al
  // capturar, un juicio evidentemente erroneo. Esto no es un bug del
  // pipeline: es la misma limitacion ya documentada de la evaluacion cruda
  // (`review.aiDisclaimer`, "opinion de la IA, no un hecho verificado") --
  // por eso este test no afirma que la red juzgue bien esta jugada
  // especifica, solo que el pipeline (replay real, captura real reflejada
  // en el tablero, forma y rango de la salida) funciona de punta a punta.
  it('reproduce una partida real con una captura y arma una curva/lista de caidas bien formada', async () => {
    const model = await loadVendoredModel()
    const moves: RecordedMove[] = [
      move(BLACK, 2, 3),
      move(WHITE, 2, 2), // sera capturada
      move(BLACK, 2, 1),
      move(WHITE, 0, 4), // relleno, no defiende
      move(BLACK, 1, 2),
      move(WHITE, 0, 5), // relleno, ignora el atari
      move(BLACK, 3, 2), // captura a (2,2)
    ]
    const captureMoveNumber = 7

    const positions = buildFullGameEvalPositions(W, W, 6.5, moves)
    expect(positions).toHaveLength(moves.length + 1)
    // La piedra capturada realmente desaparece del tablero en la posicion
    // resultante -- confirma que la secuencia hace lo que dice, no solo que
    // las 8 posiciones existen.
    expect(positions[captureMoveNumber].state.board.stones[toPoint(W, 2, 2)]).toBe(EMPTY)

    // Mismo paso intermedio que hace eval/worker.ts en la app real: cada
    // EvalPosition se codifica a EncodedInput antes de pasarlo a la red.
    const results = await evaluatePositionsBatch(model, positions.map(encodeInput))
    const values = results.map((r) => r.value[0])
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }

    const { curve, swings } = summarizeWinRates(moves, values)

    expect(curve).toHaveLength(moves.length + 1)
    expect(swings).toHaveLength(moves.length)
    for (const point of curve) {
      expect(point.blackWinProbability).toBeGreaterThanOrEqual(0)
      expect(point.blackWinProbability).toBeLessThanOrEqual(1)
    }
    for (const swing of swings) {
      expect(swing.swing).toBeGreaterThanOrEqual(-1)
      expect(swing.swing).toBeLessThanOrEqual(1)
    }

    const captureSwing = swings.find((s) => s.moveNumber === captureMoveNumber)
    expect(captureSwing).toBeDefined()
    expect(captureSwing?.color).toBe(BLACK)
    expect(captureSwing?.point).toBe(toPoint(W, 3, 2))
  }, 30000)
})
