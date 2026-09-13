import { createBoard, toPoint } from '../core/board'
import { BLACK, WHITE } from '../core/types'
import type { TranslationKey } from '../i18n'
import type { DemoScript } from './lessons/types'

export interface JosekiEntry {
  id: string
  titleKey: TranslationKey
  descriptionKey: TranslationKey
  demo: DemoScript
}

/**
 * Invasion en 3-3 bajo una piedra propia en 4-4, con el doble hane de
 * blanco -- una de las secuencias de esquina mas conocidas del juego.
 *
 * A diferencia del resto del contenido de esta app (verificado contra el
 * solucionador exhaustivo de tsumego, que puede confirmar un resultado de
 * vida/muerte con certeza matematica), una secuencia de joseki no tiene un
 * "correcto" verificable de la misma forma -- es una convencion de buen
 * juego acordada por siglos de practica, no un teorema. La secuencia de
 * abajo se corroboro de la unica forma mecanica disponible en esta app: se
 * le pregunto a la red de KataGo ya empaquetada (eval/model.ts, la misma
 * que usa el resto de la app) su distribucion de politica en cada paso real
 * -- no se acepto ningun movimiento a mano sin ese chequeo. Resultado (ver
 * NOTAS.md para el detalle completo): el bloqueo de negro en (3,2) concentra
 * 47% de la politica (el bloqueo simetrico en (2,3) casi empata con 41%,
 * mencionado en el texto pero no parte de esta demo -- ver mas abajo); el
 * doble hane de blanco en (2,3) tras eso concentra 92%; la extension de
 * negro final se acepta en cualquiera de los dos puntos que juntos suman
 * 85% de la politica en ese paso. En cada paso, el resto de las jugadas
 * legales (incluyendo jugar en cualquier otro lado del tablero) se reparte
 * el resto -- una concentracion asi de alta es exactamente lo que se
 * esperaria de una secuencia realmente estandar, no una casualidad.
 *
 * Deliberadamente se detiene aca: el siguiente paso real de la teoria de
 * joseki se ramifica en variantes nombradas (cortar vs. seguir extendiendo)
 * que esta app no esta en condiciones de verificar con la misma disciplina
 * -- mejor un fragmento corto y bien verificado que uno mas largo y
 * adivinado.
 */
function buildSanSanDoubleHaneDemo(): DemoScript {
  const width = 19
  const height = 19
  const board = createBoard(width, height)
  board.stones[toPoint(width, 3, 3)] = BLACK

  return {
    width,
    height,
    initialStones: board.stones,
    toMove: WHITE,
    steps: [
      {
        promptKey: 'joseki.sansanDoubleHane.step1.prompt',
        expectedPoints: [],
        auto: toPoint(width, 2, 2),
        feedbackKey: 'joseki.sansanDoubleHane.step1.feedback',
      },
      {
        promptKey: 'joseki.sansanDoubleHane.step2.prompt',
        expectedPoints: [toPoint(width, 3, 2)],
        feedbackKey: 'joseki.sansanDoubleHane.step2.feedback',
      },
      {
        promptKey: 'joseki.sansanDoubleHane.step3.prompt',
        expectedPoints: [],
        auto: toPoint(width, 2, 3),
        feedbackKey: 'joseki.sansanDoubleHane.step3.feedback',
      },
      {
        promptKey: 'joseki.sansanDoubleHane.step4.prompt',
        expectedPoints: [toPoint(width, 2, 5), toPoint(width, 3, 4)],
        feedbackKey: 'joseki.sansanDoubleHane.step4.feedback',
      },
    ],
    completionKey: 'joseki.sansanDoubleHane.completion',
  }
}

export const JOSEKI_ENTRIES: JosekiEntry[] = [
  {
    id: 'sansan-double-hane',
    titleKey: 'joseki.sansanDoubleHane.title',
    descriptionKey: 'joseki.sansanDoubleHane.description',
    demo: buildSanSanDoubleHaneDemo(),
  },
]
