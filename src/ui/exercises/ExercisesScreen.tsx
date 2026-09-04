import { useEffect, useState } from 'react'
import type { ConceptId } from '../../analysis/concepts'
import { ExercisesConceptScreen } from './ExercisesConceptScreen'
import { ExercisePracticeScreen } from './ExercisePracticeScreen'

interface ExercisesScreenProps {
  /** Concepto preseleccionado al entrar (p.ej. desde el enlace "practicar mas" de una leccion, o "practicar este concepto" desde Revisar). */
  initialConcept?: ConceptId
  /** Igual que onGameActiveChange en PlayScreen: avisa a App si hay un
   * intento en curso, para que retocar otra pestana pida confirmacion en
   * vez de perderlo en silencio. Misma granularidad que Jugar (cualquier
   * problema cargado cuenta como "activo", sin distinguir recien abierto de
   * casi resuelto) en vez de intentar medir "progreso real". */
  onActiveChange: (active: boolean) => void
}

type View = { kind: 'concept' } | { kind: 'practice'; conceptFilter: ConceptId | 'all' }

/**
 * Router chico de la pestana Ejercicios, mismo patron que Aprender/Jugar/
 * Revisar: pantalla de seleccion de concepto y pantalla de practica (tablero
 * + validacion) son dos vistas separadas, nunca mezcladas.
 */
export function ExercisesScreen({ initialConcept, onActiveChange }: ExercisesScreenProps) {
  const [view, setView] = useState<View>(() =>
    initialConcept ? { kind: 'practice', conceptFilter: initialConcept } : { kind: 'concept' },
  )

  useEffect(() => {
    onActiveChange(view.kind === 'practice')
    return () => onActiveChange(false)
  }, [view.kind, onActiveChange])

  if (view.kind === 'concept') {
    return <ExercisesConceptScreen onPickConcept={(id) => setView({ kind: 'practice', conceptFilter: id })} />
  }

  return (
    <ExercisePracticeScreen conceptFilter={view.conceptFilter} onBackToConcepts={() => setView({ kind: 'concept' })} />
  )
}
