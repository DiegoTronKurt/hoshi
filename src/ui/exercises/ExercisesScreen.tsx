import { useState } from 'react'
import type { ConceptId } from '../../analysis/concepts'
import { ExercisesConceptScreen } from './ExercisesConceptScreen'
import { ExercisePracticeScreen } from './ExercisePracticeScreen'

interface ExercisesScreenProps {
  /** Concepto preseleccionado al entrar (p.ej. desde el enlace "practicar mas" de una leccion, o "practicar este concepto" desde Revisar). */
  initialConcept?: ConceptId
}

type View = { kind: 'concept' } | { kind: 'practice'; conceptFilter: ConceptId | 'all' }

/**
 * Router chico de la pestana Ejercicios, mismo patron que Aprender/Jugar/
 * Revisar: pantalla de seleccion de concepto y pantalla de practica (tablero
 * + validacion) son dos vistas separadas, nunca mezcladas.
 */
export function ExercisesScreen({ initialConcept }: ExercisesScreenProps = {}) {
  const [view, setView] = useState<View>(() =>
    initialConcept ? { kind: 'practice', conceptFilter: initialConcept } : { kind: 'concept' },
  )

  if (view.kind === 'concept') {
    return <ExercisesConceptScreen onPickConcept={(id) => setView({ kind: 'practice', conceptFilter: id })} />
  }

  return (
    <ExercisePracticeScreen conceptFilter={view.conceptFilter} onBackToConcepts={() => setView({ kind: 'concept' })} />
  )
}
