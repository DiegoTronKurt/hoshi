import { toPoint } from '../core/board'
import { rectangularDeSeis } from './seeds'
import { applyMove, createGame } from '../core/rules'
import { WHITE } from '../core/types'
import { ALPHAGO_LEE_SEDOL_GAMES } from './historicGames'
import type { HistoricGame } from './historicGames'
import type { GameState } from '../core/types'
import type { TranslationKey } from '../i18n'
import type { DemoScript } from './lessons/types'

export type TutorialTheme = 'attack' | 'defense' | 'expansion'

export interface Tutorial {
  id: string
  titleKey: TranslationKey
  descriptionKey: TranslationKey
  theme: TutorialTheme
  demo: DemoScript
}

/** Reproduce las primeras `count` jugadas reales de una partida guardada.
 * Nunca falla con una partida de historicGames.ts (ya verificadas legales
 * de punta a punta en tests/content/historicGames.test.ts) -- el chequeo
 * existe solo para no devolver un estado a medio construir en silencio si
 * algo cambiara. */
function replayMoves(game: HistoricGame, count: number): GameState {
  let state: GameState = createGame(game.width, game.height, game.komi)
  for (let i = 0; i < count; i++) {
    const applied = applyMove(state, game.moves[i].point)
    if (!applied.legal || !applied.state) {
      throw new Error(`jugada ilegal reproduciendo ${game.id} en el indice ${i}`)
    }
    state = applied.state as GameState
  }
  return state
}

function expectPoint(game: HistoricGame, moveNumber: number): number {
  const point = game.moves[moveNumber - 1].point
  if (point === null) throw new Error(`se esperaba una jugada real (no pase) en el numero ${moveNumber} de ${game.id}`)
  return point
}

/**
 * Partida 4 del duelo AlphaGo vs. Lee Sedol (2016-03-13), la unica que gano
 * Lee Sedol -- jugando blanco. La jugada 78 es la "cuna" (wedge) que se
 * volvio una de las jugadas mas comentadas de la historia del Go: en vez de
 * responder en la zona de pelea de la izquierda (donde ambos jugaban unas
 * jugadas antes), blanco se mete de cuna junto a una piedra negra suelta en
 * el centro-derecha, partiendo la posicion negra en dos frentes de golpe.
 *
 * A diferencia de joseki.ts (donde se busca que la red SI concentre su
 * politica en la jugada real, como evidencia de que es una jugada
 * reconocida) o tesuji.ts (donde el solucionador exhaustivo prueba el
 * resultado con certeza), esta jugada pone a prueba lo contrario a
 * proposito: se le pidio a la misma red ya empaquetada (kata-b10c128, sin
 * busqueda) su distribucion de politica en la posicion real, un ply antes
 * de la jugada 78 (script descartable, no en el repo). Resultado: la cuna
 * ni siquiera entra en las primeras 25 candidatas de la red (puesto 26 de
 * las jugadas legales, con apenas 0.35% de probabilidad -- los 3 primeros
 * candidatos concentran mas de un 45% repartido en otras zonas del
 * tablero), y la evaluacion de valor le da a blanco (quien esta a punto de
 * jugarla) apenas 14.8% de probabilidad de ganar en ese momento. Esa
 * distancia entre "lo que ve un vistazo rapido sin busqueda profunda" y
 * "lo que encontro un jugador humano bajo presion real" es exactamente lo
 * que hace a esta jugada famosa -- por eso el paso 1 de este tutorial pide
 * encontrarla en vez de mostrarla directamente, dejando el resultado del
 * chequeo (no una opinion) en el texto de retroalimentacion.
 *
 * Los pasos 2 a 6 muestran la pelea real que sigue (jugadas 79 a 83, tal
 * cual el SGF), incluyendo la jugada 83 -- el mayor vaivien de evaluacion
 * de TODA la partida segun esta misma red (calculado con el mismo
 * pipeline que ya usa FullGameReviewPanel, ver ui/review/fullGameReview.ts:
 * la probabilidad de blanco de ganar salta de un extremo al otro varias
 * veces seguidas entre las jugadas 83 y 90). Mismo criterio de honestidad
 * que el disclaimer ya existente (review.aiDisclaimer): ese vaiven no se
 * presenta como "el error real", solo como lo que arroja una evaluacion sin
 * busqueda ante una pelea filosa -- una ilustracion util de por que ese
 * tipo de posiciones son dificiles de juzgar de un vistazo, no un veredicto.
 *
 * Se detiene en la jugada 83 (no sigue hasta el final de la partida) por la
 * misma razon que joseki.ts y tesuji.ts cortan donde cortan: de ahi en mas
 * la pelea se ramifica en variantes que este tutorial no esta en
 * condiciones de explicar con el mismo nivel de rigor -- quien quiera ver
 * el resto (Lee Sedol termino ganando esta partida, la unica del duelo)
 * puede abrirla completa en Partidas Historicas.
 */
function buildLeeSedolWedgeTutorial(): DemoScript {
  const game = ALPHAGO_LEE_SEDOL_GAMES.find((g) => g.id === 'alphago-leesedol-4')!
  const state = replayMoves(game, 77)

  return {
    width: game.width,
    height: game.height,
    initialStones: state.board.stones,
    toMove: state.toMove,
    steps: [
      {
        promptKey: 'tutorials.leeSedolWedge.step1.prompt',
        expectedPoints: [expectPoint(game, 78)],
        feedbackKey: 'tutorials.leeSedolWedge.step1.feedback',
      },
      {
        promptKey: 'tutorials.leeSedolWedge.step2.prompt',
        expectedPoints: [],
        auto: expectPoint(game, 79),
        feedbackKey: 'tutorials.leeSedolWedge.step2.feedback',
      },
      {
        promptKey: 'tutorials.leeSedolWedge.step3.prompt',
        expectedPoints: [],
        auto: expectPoint(game, 80),
        feedbackKey: 'tutorials.leeSedolWedge.step3.feedback',
      },
      {
        promptKey: 'tutorials.leeSedolWedge.step4.prompt',
        expectedPoints: [],
        auto: expectPoint(game, 81),
        feedbackKey: 'tutorials.leeSedolWedge.step4.feedback',
      },
      {
        promptKey: 'tutorials.leeSedolWedge.step5.prompt',
        expectedPoints: [],
        auto: expectPoint(game, 82),
        feedbackKey: 'tutorials.leeSedolWedge.step5.feedback',
      },
      {
        promptKey: 'tutorials.leeSedolWedge.step6.prompt',
        expectedPoints: [],
        auto: expectPoint(game, 83),
        feedbackKey: 'tutorials.leeSedolWedge.step6.feedback',
      },
    ],
    completionKey: 'tutorials.leeSedolWedge.completion',
  }
}

/**
 * Tutorial sintetico (a diferencia del anterior, no viene de ninguna
 * partida real): reutiliza `rectangularDeSeis` (content/seeds.ts, ya
 * verificada por el solucionador en tests/content/advanced.test.ts -- negro
 * vive jugando primero en cualquiera de sus dos puntos centrales, que son
 * miai entre si). La idea de este tutorial es distinta a la de Avanzado:
 * ahi el ataque es directo (blanco juega el nakade central de una), aca
 * blanco prueba primero una jugada que NO es el punto vital (una esquina
 * del espacio de ojos) antes de intentar matar de verdad -- exactamente el
 * tipo de decision de defensa de varios pasos que pidio el usuario.
 *
 * Verificado con el mismo solucionador exhaustivo, no adivinado (script
 * descartable, no en el repo): tras el amague de blanco en la esquina
 * (3,4), se volvio a correr `solve()` con objective:'live' sobre la
 * posicion resultante. Hallazgo real y no obvio -- el amague NO es
 * inofensivo: partiendo del rectangulo de 6 puntos con sus DOS centros
 * miai, ocupar una esquina primero rompe esa simetria. De los 5 puntos que
 * quedan, SOLO (4,4) sigue salvando al grupo (`liveForDefender:true`); el
 * otro centro, (4,5) -- el que hubiera funcionado igual de bien si blanco
 * no hubiera jugado la esquina -- ya NO alcanza, y ningun otro punto sirve
 * tampoco. Ese es el punto pedagogico central: la jugada de blanco cambio
 * de verdad cual es el punto vital, así que repetir de memoria "cualquiera
 * de los dos centros sirve" (cierto en Avanzado, donde el espacio arranca
 * intacto) lleva a la muerte del grupo aca. Confirmado ademas que, una vez
 * que negro juega (4,4), el solucionador no encuentra NINGUNA jugada
 * ganadora para blanco en el resto del espacio (`winning replies for
 * ATTACKER: []`) -- el grupo queda vivo sin condiciones desde ese momento,
 * lo que justifica mostrar los intentos posteriores de blanco (incluido el
 * propio (4,5)) como intentos ya inutiles en vez de omitirlos.
 */
function buildRectangleDefenseTutorial(): DemoScript {
  const { board } = rectangularDeSeis
  const width = board.width
  const height = board.height

  const feint = toPoint(width, 3, 4)
  const decisive = toPoint(width, 4, 4)
  const futile1 = toPoint(width, 5, 4)
  const futile2 = toPoint(width, 3, 5)
  const futile3 = toPoint(width, 4, 5)

  return {
    width,
    height,
    initialStones: board.stones,
    toMove: WHITE,
    steps: [
      {
        promptKey: 'tutorials.rectangleDefense.step1.prompt',
        expectedPoints: [],
        auto: feint,
        feedbackKey: 'tutorials.rectangleDefense.step1.feedback',
      },
      {
        promptKey: 'tutorials.rectangleDefense.step2.prompt',
        expectedPoints: [decisive],
        feedbackKey: 'tutorials.rectangleDefense.step2.feedback',
      },
      {
        promptKey: 'tutorials.rectangleDefense.step3.prompt',
        expectedPoints: [],
        auto: futile1,
        feedbackKey: 'tutorials.rectangleDefense.step3.feedback',
      },
      {
        promptKey: 'tutorials.rectangleDefense.step4.prompt',
        expectedPoints: [],
        auto: futile2,
        feedbackKey: 'tutorials.rectangleDefense.step4.feedback',
      },
      {
        promptKey: 'tutorials.rectangleDefense.step5.prompt',
        expectedPoints: [],
        auto: futile3,
        feedbackKey: 'tutorials.rectangleDefense.step5.feedback',
      },
    ],
    completionKey: 'tutorials.rectangleDefense.completion',
  }
}

export const TUTORIALS: Tutorial[] = [
  {
    id: 'lee-sedol-wedge',
    titleKey: 'tutorials.leeSedolWedge.title',
    descriptionKey: 'tutorials.leeSedolWedge.description',
    theme: 'attack',
    demo: buildLeeSedolWedgeTutorial(),
  },
  {
    id: 'rectangle-defense',
    titleKey: 'tutorials.rectangleDefense.title',
    descriptionKey: 'tutorials.rectangleDefense.description',
    theme: 'defense',
    demo: buildRectangleDefenseTutorial(),
  },
]
