import type { Color } from '../../core/types'
import type { TranslationKey } from '../../i18n'

export type LessonBlock =
  | { kind: 'paragraph'; textKey: TranslationKey }
  | {
      kind: 'diagram'
      width: number
      height: number
      stones: Int8Array
      captionKey: TranslationKey
      /** Parametros para interpolar en la traduccion, p.ej. un puntaje calculado con computeAreaScore en vez de escrito a mano. */
      captionParams?: Record<string, string | number>
      highlightPoint?: number
    }

export interface DemoStep {
  /** Que se le pide a la persona en este paso. */
  promptKey: TranslationKey
  /** Puntos aceptados para resolver el paso. Ignorado si `auto` es true. */
  expectedPoints: number[]
  /**
   * Si es true, el paso se da por resuelto cuando el motor de reglas
   * RECHAZA la jugada (para ensenar una regla prohibida, como el suicidio),
   * en vez de aplicarla. El tablero no cambia en ese caso.
   */
  expectIllegal?: boolean
  /**
   * Paso sin click: el motor juega automaticamente por quien le toque
   * jugar, sin pedirle nada a la persona. `true` pasa (para narrar "el
   * rival no responde"); un numero de punto juega esa jugada concreta (para
   * narrar la respuesta forzada del otro bando en una secuencia, como la
   * extension del que huye en una escalera).
   */
  auto?: boolean | number
  /** Que paso, mostrado despues de resolver el paso. */
  feedbackKey: TranslationKey
}

export interface DemoScript {
  width: number
  height: number
  initialStones: Int8Array
  /** De quien es el turno en la posicion inicial. */
  toMove: Color
  steps: DemoStep[]
  completionKey: TranslationKey
}

export interface Lesson {
  /** Coincide con Concept.lessonId, p.ej. 'n0-l1'. */
  id: string
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  order: number
  titleKey: TranslationKey
  blocks: LessonBlock[]
  /** "Ejemplo interactivo" de la leccion. Opcional: no todas las lecciones tienen algo demostrable en el tablero. */
  demo?: DemoScript
}
