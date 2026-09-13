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

/**
 * Ataque directo (tsuke) sobre una piedra propia en 4-4, con hane y
 * extension -- familia de joseki distinta a la invasion en 3-3 de arriba
 * (contacto directo sobre la piedra en vez de un salto a la esquina), igual
 * de fundamental y con un proverbio propio ("al tsuke, hane").
 *
 * Misma metodologia y mismo estandar de honestidad que sansan-double-hane:
 * se le pregunto a la red de KataGo ya empaquetada su distribucion de
 * politica en cada paso real, sin aceptar ningun movimiento a mano sin ese
 * chequeo (script descartable, no en el repo). Resultado: el hane de negro
 * en (2,2) tras el tsuke concentra 69.7% de la politica; la extension de
 * blanco en (4,2) que sigue concentra 84.6%; la respuesta final de negro se
 * acepta en cualquiera de los dos puntos que juntos suman 90.9% de la
 * politica en ese paso (62.2% + 28.7%). Misma señal que en la otra
 * secuencia: una concentracion tan alta y repetida es lo que distingue un
 * joseki real de una jugada cualquiera, no un resultado de vida o muerte con
 * certeza matematica (eso no existe para joseki, ver comentario de arriba).
 *
 * Se detiene aca por la misma razon que la otra secuencia: el siguiente
 * paso real se ramifica en variantes nombradas que esta app no esta en
 * condiciones de verificar con la misma disciplina.
 */
function buildTsukeHaneDemo(): DemoScript {
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
        promptKey: 'joseki.tsukeHane.step1.prompt',
        expectedPoints: [],
        auto: toPoint(width, 3, 2),
        feedbackKey: 'joseki.tsukeHane.step1.feedback',
      },
      {
        promptKey: 'joseki.tsukeHane.step2.prompt',
        expectedPoints: [toPoint(width, 2, 2)],
        feedbackKey: 'joseki.tsukeHane.step2.feedback',
      },
      {
        promptKey: 'joseki.tsukeHane.step3.prompt',
        expectedPoints: [],
        auto: toPoint(width, 4, 2),
        feedbackKey: 'joseki.tsukeHane.step3.feedback',
      },
      {
        promptKey: 'joseki.tsukeHane.step4.prompt',
        expectedPoints: [toPoint(width, 4, 3), toPoint(width, 2, 3)],
        feedbackKey: 'joseki.tsukeHane.step4.feedback',
      },
    ],
    completionKey: 'joseki.tsukeHane.completion',
  }
}

export const JOSEKI_ENTRIES: JosekiEntry[] = [
  {
    id: 'sansan-double-hane',
    titleKey: 'joseki.sansanDoubleHane.title',
    descriptionKey: 'joseki.sansanDoubleHane.description',
    demo: buildSanSanDoubleHaneDemo(),
  },
  {
    id: 'tsuke-hane',
    titleKey: 'joseki.tsukeHane.title',
    descriptionKey: 'joseki.tsukeHane.description',
    demo: buildTsukeHaneDemo(),
  },
]
