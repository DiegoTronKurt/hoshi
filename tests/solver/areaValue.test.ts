import { describe, expect, it } from 'vitest'
import { createBoard, toPoint } from '../../src/core/board'
import { computeAreaScore } from '../../src/core/scoring'
import { BLACK, WHITE } from '../../src/core/types'
import type { BoardState, Color } from '../../src/core/types'
import {
  areaDeltaForPoint,
  bestAreaMove,
  classifySenteGote,
  estimateMoveCost,
  isBestAreaMove,
  isOwnTerritory,
  PASS_VALUE_THRESHOLD,
  realizedAreaCost,
} from '../../src/solver/areaValue'

const SIZE = 9

function place(board: BoardState, color: Color, points: Array<[number, number]>): void {
  for (const [x, y] of points) board.stones[toPoint(board.width, x, y)] = color
}

/** Bolsillo de 3 puntos (fila y=0, columnas 0-2), usando el borde del
 * tablero como dos lados: (3,0) cierra la derecha, (0,1)+(1,1) cierran casi
 * todo el fondo, (2,1) es el hueco real que falta -- verificado con un
 * script de depuracion antes de aceptar los numeros de este archivo (ver
 * NOTAS.md): sin blanco disperso por el resto del tablero, cualquier otro
 * punto vale 1 (reclama su propia celda en un mar neutral), asi que el
 * hueco tiene que valer claramente mas que eso para que bestAreaMove no sea
 * ambiguo. */
function cornerWall(): BoardState {
  const board = createBoard(SIZE)
  place(board, BLACK, [[3, 0], [0, 1], [1, 1]])
  place(board, WHITE, [[8, 0], [8, 8], [0, 8], [4, 8], [8, 4]])
  return board
}
const GAP_POINT: [number, number] = [2, 1]

describe('areaDeltaForPoint', () => {
  it('sellar el hueco (los 3 puntos del bolsillo mas el hueco mismo) supera claramente el umbral', () => {
    const board = cornerWall()
    const delta = areaDeltaForPoint(board, toPoint(SIZE, ...GAP_POINT), BLACK)
    expect(delta).toBe(4)
    expect(delta as number).toBeGreaterThan(PASS_VALUE_THRESHOLD)
  })

  it('null si el punto no es una jugada legal (ya ocupado)', () => {
    const board = cornerWall()
    expect(areaDeltaForPoint(board, toPoint(SIZE, 3, 0), BLACK)).toBeNull()
  })

  it('jugar dentro del propio territorio ya sellado no mejora el area (delta <= 0)', () => {
    const board = cornerWall()
    place(board, BLACK, [GAP_POINT]) // bolsillo ya sellado del todo
    const delta = areaDeltaForPoint(board, toPoint(SIZE, 1, 0), BLACK)
    expect(delta).toBe(0)
  })
})

describe('bestAreaMove', () => {
  it('encuentra el punto que sella el bolsillo cuando es la unica jugada que vale la pena', () => {
    const board = cornerWall()
    const best = bestAreaMove(board, BLACK)
    expect(best?.point).toBe(toPoint(SIZE, ...GAP_POINT))
    expect(best?.delta).toBe(4)
  })

  it('null si no hay ninguna jugada que supere el umbral (bolsillo ya sellado)', () => {
    const board = cornerWall()
    place(board, BLACK, [GAP_POINT])
    expect(bestAreaMove(board, BLACK)).toBeNull()
  })
})

/** Dos bolsillos identicos por simetria de 180 grados (nada mas en el
 * tablero salvo dos piedras blancas, tambien simetricas, para que el mar
 * neutral toque ambos colores -- mismo motivo que el blanco disperso de
 * cornerWall): ambos huecos empatan en delta 4, verificado con un script
 * descartable antes de escribir este test (no a ciegas). Reproduce el bug
 * real encontrado en produccion -- bestAreaMove(...).point devuelve GAP_A
 * (el primero que encuentra recorriendo el tablero), asi que comparar un
 * clic contra ese punto exacto rechazaba GAP_B aunque fuera igual de
 * correcto; 8 de los 197 problemas de yose-value.json ya generados tenian
 * este mismo empate. */
function twinPocketBoard(): BoardState {
  const board = createBoard(SIZE)
  place(board, BLACK, [[3, 0], [0, 1], [1, 1]])
  place(board, BLACK, [[5, 8], [8, 7], [7, 7]])
  place(board, WHITE, [[8, 0], [0, 8]])
  return board
}
const GAP_A: [number, number] = [2, 1]
const GAP_B: [number, number] = [6, 7]

describe('isBestAreaMove', () => {
  it('acepta el punto que bestAreaMove elige', () => {
    const board = twinPocketBoard()
    expect(isBestAreaMove(board, toPoint(SIZE, ...GAP_A), BLACK)).toBe(true)
  })

  it('tambien acepta un punto separado que empata en el mismo delta maximo', () => {
    const board = twinPocketBoard()
    const best = bestAreaMove(board, BLACK)
    // Confirma que este es realmente el caso de empate (bestAreaMove ignora
    // GAP_B): si esto cambiara, el test ya no probaria lo que dice probar.
    expect(best?.point).toBe(toPoint(SIZE, ...GAP_A))
    expect(isBestAreaMove(board, toPoint(SIZE, ...GAP_B), BLACK)).toBe(true)
  })

  it('rechaza un punto legal que no llega al delta maximo', () => {
    const board = cornerWall()
    // delta 1 en (5,5), muy por debajo del hueco real (delta 4) -- mismo
    // punto que ya usa el test de estimateMoveCost mas abajo.
    expect(isBestAreaMove(board, toPoint(SIZE, 5, 5), BLACK)).toBe(false)
  })

  it('rechaza una jugada ilegal (punto ya ocupado)', () => {
    const board = cornerWall()
    expect(isBestAreaMove(board, toPoint(SIZE, 3, 0), BLACK)).toBe(false)
  })
})

describe('estimateMoveCost', () => {
  it('costo 0 si la jugada realmente jugada ya era la mejor disponible', () => {
    const board = cornerWall()
    expect(estimateMoveCost(board, toPoint(SIZE, ...GAP_POINT), BLACK)).toBe(0)
  })

  it('costo positivo (mejor jugada menos la jugada real) si se jugo en otro lado', () => {
    const board = cornerWall()
    // Sin blanco disperso alrededor, cualquier punto neutral reclama solo su
    // propia celda (delta 1, ver el comentario de cornerWall mas arriba) --
    // bien por debajo del hueco (delta 4), que sigue siendo la mejor jugada.
    const elsewhere = toPoint(SIZE, 5, 5)
    expect(estimateMoveCost(board, elsewhere, BLACK)).toBe(3)
  })
})

describe('realizedAreaCost', () => {
  it('mide la diferencia real de area entre dos posiciones reales de la partida (una captura real)', () => {
    const before = createBoard(SIZE)
    place(before, BLACK, [[4, 4], [4, 5], [5, 4], [5, 5]])
    place(before, WHITE, [[0, 0], [0, 8], [8, 0]])

    // Mismo tablero, pero el grupo negro ya fue capturado (puntos vacios de
    // nuevo) -- dos posiciones reales, no una hipotesis.
    const after = createBoard(SIZE)
    place(after, WHITE, [[0, 0], [0, 8], [8, 0]])

    const expected = computeAreaScore(before, 0).black - computeAreaScore(after, 0).black
    expect(expected).toBeGreaterThan(0)
    expect(realizedAreaCost(before, after, 0, BLACK)).toBe(expected)
  })

  it('nunca es negativo, aunque el area para ese color haya aumentado entre los dos estados', () => {
    const before = createBoard(SIZE)
    const after = createBoard(SIZE)
    place(after, BLACK, [[4, 4]])
    expect(realizedAreaCost(before, after, 0, BLACK)).toBe(0)
  })
})

/** Forma de dos ojos reales, reusada tal cual de src/content/seeds.ts
 * (dosOjosSeparados, ya verificada y usada en la leccion n2-l3): una sola
 * region cerrada no alcanza para Benson (bensonPassAlive exige al menos dos
 * regiones sanas, ver core/benson.ts), asi que isOwnTerritory necesita esta
 * forma -- ni cornerWall() de arriba (un solo bolsillo) ni una posicion sin
 * ningun cierre le sirven. */
function twoEyeBoard(): BoardState {
  const board = createBoard(SIZE)
  place(board, BLACK, [
    [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
    [2, 4], [4, 4], [6, 4],
    [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
  ])
  return board
}
const EYE_1: [number, number] = [3, 4]
const EYE_2: [number, number] = [5, 4]

describe('isOwnTerritory', () => {
  it('true en cualquiera de los dos ojos reales de una cadena pass-alive', () => {
    const board = twoEyeBoard()
    expect(isOwnTerritory(board, toPoint(SIZE, ...EYE_1), BLACK)).toBe(true)
    expect(isOwnTerritory(board, toPoint(SIZE, ...EYE_2), BLACK)).toBe(true)
  })

  it('false para el color rival, aunque el punto sea territorio real del otro', () => {
    const board = twoEyeBoard()
    expect(isOwnTerritory(board, toPoint(SIZE, ...EYE_1), WHITE)).toBe(false)
  })

  it('false con un solo bolsillo cerrado (no alcanza para Benson, hacen falta dos regiones sanas)', () => {
    const board = cornerWall()
    place(board, BLACK, [GAP_POINT])
    expect(isOwnTerritory(board, toPoint(SIZE, 1, 0), BLACK)).toBe(false)
  })

  it('false si todavia no hay ninguna cadena pass-alive (bolsillo sin sellar)', () => {
    const board = cornerWall()
    expect(isOwnTerritory(board, toPoint(SIZE, 1, 0), BLACK)).toBe(false)
  })
})

/** Bloque blanco de 6 piedras en la esquina (0,0)-(2,1) con exactamente 2
 * libertades -- (1,2) y (3,1) -- antes de que negro juegue. Si blanco
 * ignora el atari de negro en (1,2) y negro despues juega (3,1), captura
 * las 6 piedras: el territorio resultante (6 puntos vacios + la piedra
 * jugada) vale claramente mas que el "gran punto" real que blanco tenia
 * disponible en la esquina opuesta (delta 4, mismo bolsillo validado que
 * cornerWall, reflejado y con el color invertido) -- por eso el atari es
 * sente, no gote. Numeros verificados con un script de depuracion antes de
 * aceptarlos (ver NOTAS.md): capturar da delta 7, el punto lejano da 4. */
function senteBoard(): BoardState {
  const board = createBoard(SIZE)
  place(board, WHITE, [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ])
  place(board, BLACK, [
    [3, 0],
    [0, 2],
    [2, 2],
  ])
  // Espejo de cornerWall (pocket (0,0)-(2,0)/pared (3,0),(0,1),(1,1)/hueco
  // (2,1)) via x'=8-x, y'=8-y, con blanco en vez de negro -- delta 4.
  place(board, WHITE, [
    [5, 8],
    [8, 7],
    [7, 7],
  ])
  return board
}
const SENTE_CANDIDATE: [number, number] = [1, 2]
const FAR_BIG_POINT: [number, number] = [6, 7]

/** Una sola piedra blanca en la esquina: si negro le pone atari y blanco lo
 * ignora, capturarla vale muy poco (delta 2: 1 punto de territorio + la
 * piedra jugada) -- claramente menos que el mismo punto lejano de 4 puntos
 * que blanco tenia disponible. El mismo atari que era sente con un grupo
 * grande es gote con un grupo chico: la diferencia esta en cuanto hay en
 * juego si se ignora, no en la forma del atari en si. */
function goteBoard(): BoardState {
  const board = createBoard(SIZE)
  place(board, WHITE, [[0, 0]])
  place(board, WHITE, [
    [5, 8],
    [8, 7],
    [7, 7],
  ])
  return board
}
const GOTE_CANDIDATE: [number, number] = [1, 0]

describe('classifySenteGote', () => {
  it('atari sobre un grupo grande es sente cuando capturarlo vale claramente mas que la mejor alternativa del rival', () => {
    const board = senteBoard()
    expect(classifySenteGote(board, toPoint(SIZE, ...SENTE_CANDIDATE), BLACK)).toBe('sente')
  })

  it('el mismo tipo de atari es gote cuando el grupo amenazado es chico (poco en juego si se ignora)', () => {
    const board = goteBoard()
    expect(classifySenteGote(board, toPoint(SIZE, ...GOTE_CANDIDATE), BLACK)).toBe('gote')
  })

  it('null si la jugada no crea ninguna amenaza local que el rival deba responder', () => {
    const board = senteBoard()
    // La propia jugada de blanco en su "gran punto" lejano no amenaza nada
    // cerca de si misma -- no hay atari ni grupo en juego ahi.
    expect(classifySenteGote(board, toPoint(SIZE, ...FAR_BIG_POINT), WHITE)).toBeNull()
  })

  it('null si la jugada no es legal (punto ya ocupado)', () => {
    const board = senteBoard()
    expect(classifySenteGote(board, toPoint(SIZE, 0, 0), BLACK)).toBeNull()
  })

  it('null si el rival no tiene ninguna alternativa real de tenuki (todo el resto del tablero vale igual o menos)', () => {
    // Mismo atari que el caso sente, pero sin el bolsillo lejano: sin una
    // alternativa que supere PASS_VALUE_THRESHOLD en ningun otro lugar del
    // tablero, "ignorar" no es una opcion real que comparar.
    const board = createBoard(SIZE)
    place(board, WHITE, [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ])
    place(board, BLACK, [
      [3, 0],
      [0, 2],
      [2, 2],
    ])
    expect(classifySenteGote(board, toPoint(SIZE, ...SENTE_CANDIDATE), BLACK)).toBeNull()
  })
})
