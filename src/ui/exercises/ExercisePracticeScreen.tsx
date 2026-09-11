import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ConceptId } from '../../analysis/concepts'
import { listBankEntries, loadEntry } from '../../content/problemBank'
import type { BankEntry, LoadedProblem } from '../../content/problemBank'
import { pickStratifiedByConcept, pickWithoutRepeat, recentWindowSize } from '../../content/pickWithoutRepeat'
import { useI18n } from '../../i18n'
import { SolverClient } from '../../solver/client'
import { useSettings } from '../settings'
import { ExerciseView } from './ExerciseView'
import { useSolvableExercise } from './useSolvableExercise'

const RECENT_WINDOW = 5
const RECENT_CONCEPT_WINDOW = 5

interface ExercisePracticeScreenProps {
  conceptFilter: ConceptId | 'all'
  onBackToConcepts: () => void
}

/** Pantalla B de Ejercicios: tablero + validacion de un problema real,
 * elegido al azar dentro del concepto ya decidido en la pantalla A (o desde
 * un deep-link de Aprender/Revisar, que llega directo aca con el concepto
 * ya filtrado -- ver ExercisesScreen). Toda la orquestacion de resolver un
 * problema (entry/loaded, ciclo de vida del SolverClient) vive aca, no en
 * el router. */
export function ExercisePracticeScreen({ conceptFilter, onBackToConcepts }: ExercisePracticeScreenProps) {
  const { t } = useI18n()
  const { theme } = useSettings()

  const entries = useMemo(
    () => listBankEntries(conceptFilter === 'all' ? undefined : conceptFilter),
    [conceptFilter],
  )

  // Solo en "todos los conceptos": agrupar por concepto para elegir en dos
  // pasos (concepto al azar, despues problema dentro de ese concepto) en vez
  // de un unico sorteo sobre el pool plano de abajo -- los conteos por
  // concepto van de 4 a 369 (ver ExercisesConceptScreen), asi que un sorteo
  // plano deja los conceptos chicos practicamente invisibles frente a los
  // grandes. En modo de un solo concepto esto es null y pickNext usa el pool
  // recibido tal cual, sin cambios.
  const conceptGroups = useMemo(() => {
    if (conceptFilter !== 'all') return null
    const groups = new Map<ConceptId, BankEntry[]>()
    for (const e of entries) {
      const group = groups.get(e.conceptId)
      if (group) group.push(e)
      else groups.set(e.conceptId, [e])
    }
    return groups
  }, [entries, conceptFilter])

  const recentIdsRef = useRef<string[]>([])
  const recentConceptIdsRef = useRef<string[]>([])

  const pickNext = useCallback(
    (pool: BankEntry[]): BankEntry | null => {
      if (conceptGroups) {
        const result = pickStratifiedByConcept(conceptGroups, recentIdsRef.current, recentConceptIdsRef.current)
        if (!result) return null
        const conceptWindow = recentWindowSize(conceptGroups.size, RECENT_CONCEPT_WINDOW)
        recentConceptIdsRef.current = [...recentConceptIdsRef.current, result.conceptId].slice(-conceptWindow)
        const conceptPool = conceptGroups.get(result.conceptId as ConceptId) ?? []
        const window = recentWindowSize(conceptPool.length, RECENT_WINDOW)
        recentIdsRef.current = [...recentIdsRef.current, result.item.id].slice(-window)
        return result.item
      }

      const picked = pickWithoutRepeat(pool, recentIdsRef.current)
      if (picked) {
        const window = recentWindowSize(pool.length, RECENT_WINDOW)
        recentIdsRef.current = [...recentIdsRef.current, picked.id].slice(-window)
      }
      return picked
    },
    [conceptGroups],
  )

  // Arranca en null: el primer pick lo hace el efecto de mas abajo (misma
  // dependencia [entries] que ya se ejecuta al montar), asi pickNext -- que
  // lee/escribe recentIdsRef -- nunca se llama durante el render.
  const [entry, setEntry] = useState<BankEntry | null>(null)
  const [loaded, setLoaded] = useState<LoadedProblem | null>(null)

  const [solverClient, setSolverClient] = useState<SolverClient | null>(null)
  useEffect(() => {
    const client = new SolverClient()
    setSolverClient(client)
    return () => client.terminate()
  }, [])

  useEffect(() => {
    recentIdsRef.current = []
    recentConceptIdsRef.current = []
    setEntry(pickNext(entries))
  }, [entries, pickNext])

  useEffect(() => {
    setLoaded(entry ? loadEntry(entry) : null)
  }, [entry])

  const {
    game,
    lastMove,
    status,
    thinking,
    solverError,
    solutionMoves,
    wrongReason,
    wrongFlash,
    hintPoint,
    hintLoading,
    hintAvailable,
    handleHint,
    handleIntersectionClick,
    handlePass,
    reset,
  } = useSolvableExercise(entry, loaded, solverClient)

  function handleNext() {
    setEntry(pickNext(entries))
  }

  return (
    <div className="exercises">
      <div className="exercises-controls">
        <button type="button" onClick={onBackToConcepts}>
          {t('exercises.backToConcepts')}
        </button>
        <button type="button" onClick={reset}>
          {t('exercises.reset')}
        </button>
        <button type="button" onClick={handleNext}>
          {t('exercises.next')}
        </button>
      </div>

      {entries.length === 0 || !loaded || !game ? (
        <div className="exercises-empty">
          <p>{t('exercises.noProblems')}</p>
        </div>
      ) : (
        <ExerciseView
          loaded={loaded}
          game={game}
          lastMove={lastMove}
          status={status}
          thinking={thinking}
          solverError={solverError}
          solutionMoves={solutionMoves}
          wrongReason={wrongReason}
          wrongFlash={wrongFlash}
          hintPoint={hintPoint}
          hintLoading={hintLoading}
          hintAvailable={hintAvailable}
          onHint={handleHint}
          theme={theme}
          onIntersectionClick={handleIntersectionClick}
          onPass={handlePass}
        />
      )}
    </div>
  )
}
