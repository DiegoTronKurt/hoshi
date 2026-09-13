import { toPoint } from '../core/board'
import { WHITE } from '../core/types'
import type { TranslationKey } from '../i18n'
import { cruzDeCinco } from './seeds'
import type { DemoScript } from './lessons/types'

export interface AdvancedEntry {
  id: string
  titleKey: TranslationKey
  descriptionKey: TranslationKey
  demo: DemoScript
}

/**
 * Seccion "Avanzado": contenido mas dificil que la escalera graduada de
 * Aprender (niveles 0-10), pero estructuralmente APARTE de ella a proposito
 * -- no es "Nivel 11". Concept.level y varios otros lugares del codigo
 * (LearnScreen.tsx, content/lessons/index.ts, ui/profile/ProfileScreen.tsx,
 * content/lessons/types.ts, ui/play/strengthLevels.ts, content/lessons/
 * n10.ts) tratan 0-10 como un rango cerrado; agregar un nivel mas tocaria
 * ese limite en 7 archivos ademas de todo el contenido nuevo en si. Una
 * seccion separada evita eso por completo, ver NOTAS.md.
 *
 * A diferencia de Joseki (content/joseki.ts, corroborado contra la red
 * porque un joseki no tiene un resultado verificable con certeza
 * matematica), esto SI la tiene: es vida y muerte, exactamente el mismo
 * tipo de afirmacion que ya verifica el solucionador exhaustivo en toda la
 * app. Principio 1 sin ninguna excepcion aca -- ver tests/content/
 * advanced.test.ts.
 */
function buildCruzDeCincoDemo(): DemoScript {
  const { board } = cruzDeCinco

  return {
    width: board.width,
    height: board.height,
    initialStones: board.stones,
    toMove: WHITE,
    steps: [
      {
        promptKey: 'advanced.cruzDeCinco.step1.prompt',
        expectedPoints: [toPoint(board.width, 4, 4)],
        feedbackKey: 'advanced.cruzDeCinco.step1.feedback',
      },
    ],
    completionKey: 'advanced.cruzDeCinco.completion',
  }
}

export const ADVANCED_ENTRIES: AdvancedEntry[] = [
  {
    id: 'cruz-de-cinco',
    titleKey: 'advanced.cruzDeCinco.title',
    descriptionKey: 'advanced.cruzDeCinco.description',
    demo: buildCruzDeCincoDemo(),
  },
]
