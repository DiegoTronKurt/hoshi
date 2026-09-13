import { toPoint } from '../core/board'
import { getaSeed2 } from './seeds'
import { BLACK } from '../core/types'
import type { TranslationKey } from '../i18n'
import type { DemoScript } from './lessons/types'

export interface TesujiEntry {
  id: string
  titleKey: TranslationKey
  descriptionKey: TranslationKey
  demo: DemoScript
}

/**
 * Red (geta): a diferencia de joseki.ts (donde "correcto" es una convencion
 * sin verificacion matematica posible, corroborada solo consultando la
 * politica de la red), una tactica de captura como esta SI tiene un
 * resultado verificable con certeza por el solucionador exhaustivo, igual
 * que las formas de vida y muerte de Aprender/Avanzado -- Principio 1
 * aplica sin excepcion.
 *
 * Reutiliza getaSeed2 (content/seeds.ts, 9x9), la misma posicion que ya usa
 * el banco de problemas para la leccion n3-l4 y que buildSeedProblems()
 * revalida en cada corrida (tests/content/seeds.test.ts). Blanco en (1,1)
 * tiene dos piedras negras pegadas en (1,2) y (2,1) y solo dos libertades
 * (1,0) y (0,1); a simple vista parece que blanco puede escapar por
 * cualquiera de las dos. La red (geta) es precisamente la jugada que
 * demuestra que no: negro en (0,0) no le saca ninguna libertad de forma
 * directa (es una diagonal, no un vecino ortogonal), pero cierra las dos
 * salidas de antemano.
 *
 * Secuencia y alternativas confirmadas con el solucionador exhaustivo
 * (`solve()`, objective:'kill', maxDepth:4 -- mismo valor que ya usa
 * buildSeedProblems para esta posicion) sobre un script descartable, no en
 * el repo:
 * - Tras negro (0,0), CUALQUIERA de las dos libertades que blanco intente
 *   extender -- (1,0) o (0,1) -- ya pierde con juego optimo
 *   (liveForDefender:false en ambas ramas). El demo solo tiene que mostrar
 *   una para probar el punto; la otra es simetrica.
 * - Rama mostrada: blanco extiende a (1,0). Eso le da dos libertades
 *   nuevas, (0,1) y (2,0) (nunca una sola: extender siempre suma al menos
 *   una libertad nueva por el lado abierto). Negro en (2,0) cierra una de
 *   las dos, dejando al grupo blanco {(1,1),(1,0)} con una sola libertad
 *   real, (0,1) -- atari, y el solucionador ya confirmo que de aca en
 *   mas esta perdido sin importar que intente blanco despues (children
 *   restantes, todos con liveForDefender:false).
 *
 * Se detiene en el atari en vez de jugar la captura final: a partir de una
 * sola libertad confirmada sin escape por el solucionador, seguir jugando
 * la persecucion mecanica (que en este caso se reduce a una escalera corta
 * hacia el borde) no agrega nada al punto pedagogico de la Red, que es la
 * jugada de (0,0) en si -- misma decision de "parar temprano" que
 * joseki.ts ante una ramificacion que no suma claridad.
 */
function buildRedGetaDemo(): DemoScript {
  const { board } = getaSeed2
  const width = board.width
  const height = board.height

  return {
    width,
    height,
    initialStones: board.stones,
    toMove: BLACK,
    steps: [
      {
        promptKey: 'tesuji.redGeta.step1.prompt',
        expectedPoints: [toPoint(width, 0, 0)],
        feedbackKey: 'tesuji.redGeta.step1.feedback',
      },
      {
        promptKey: 'tesuji.redGeta.step2.prompt',
        expectedPoints: [],
        auto: toPoint(width, 1, 0),
        feedbackKey: 'tesuji.redGeta.step2.feedback',
      },
      {
        promptKey: 'tesuji.redGeta.step3.prompt',
        expectedPoints: [toPoint(width, 2, 0)],
        feedbackKey: 'tesuji.redGeta.step3.feedback',
      },
    ],
    completionKey: 'tesuji.redGeta.completion',
  }
}

export const TESUJI_ENTRIES: TesujiEntry[] = [
  { id: 'red-geta', titleKey: 'tesuji.redGeta.title', descriptionKey: 'tesuji.redGeta.description', demo: buildRedGetaDemo() },
]
