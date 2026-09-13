import { useEffect, useState } from 'react'
import { estimateKyuFromResults, pickLevelTestBattery } from '../../content/levelTest'
import type { LevelTestItemResult } from '../../content/levelTest'
import { loadEntry } from '../../content/problemBank'
import type { BankEntry, LoadedProblem } from '../../content/problemBank'
import { useI18n } from '../../i18n'
import { SolverClient } from '../../solver/client'
import { ExerciseView } from '../exercises/ExerciseView'
import { useSolvableExercise } from '../exercises/useSolvableExercise'
import { useSettings } from '../settings'

interface LevelTestScreenProps {
  onBack: () => void
}

/**
 * Test de nivel (C5 del roadmap): a diferencia de la estimacion pasiva de
 * Perfil (selfRank.ts, combina dominio ya observado con tasa de victoria
 * contra el bot), esto es una bateria fija de 6 problemas -- 2 faciles, 2
 * medios, 2 dificiles (ver content/levelTest.ts) -- resuelta ahora mismo,
 * ponderada por dificultad ya verificada por el solucionador exhaustivo.
 * Reutiliza integramente useSolvableExercise/ExerciseView (misma mecanica de
 * resolver que Ejercicios, incluida la pista y el registro real en el SRS de
 * cada intento -- un test tambien es un intento real, no un modo aparte que
 * no cuenta), asi que esta pantalla solo agrega la secuencia fija y el
 * resultado final.
 */
export function LevelTestScreen({ onBack }: LevelTestScreenProps) {
  const { t } = useI18n()
  const { theme } = useSettings()
  const [battery] = useState<BankEntry[]>(() => pickLevelTestBattery())
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<LevelTestItemResult[]>([])
  const [loaded, setLoaded] = useState<LoadedProblem | null>(null)

  const [solverClient, setSolverClient] = useState<SolverClient | null>(null)
  useEffect(() => {
    const client = new SolverClient()
    setSolverClient(client)
    return () => client.terminate()
  }, [])

  const entry = battery[index] ?? null
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
    giveUp,
  } = useSolvableExercise(entry, loaded, solverClient)

  function recordAndAdvance(solved: boolean) {
    if (!entry) return
    setResults((r) => [...r, { difficulty: entry.difficulty, solved }])
    setIndex((i) => i + 1)
  }

  function handleGiveUp() {
    giveUp()
    recordAndAdvance(false)
  }

  if (index >= battery.length) {
    const correct = results.filter((r) => r.solved).length
    const kyu = estimateKyuFromResults(results)
    return (
      <div className="profile level-test">
        <div className="lesson-header">
          <button type="button" onClick={onBack}>
            {t('learn.back')}
          </button>
          <h2>{t('levelTest.title')}</h2>
        </div>
        <p className="lesson-paragraph">{t('levelTest.result.score', { correct, total: results.length })}</p>
        {kyu !== null && (
          <>
            <p className="profile-selfrank-value">{t('levelTest.result.kyu', { kyu: Math.round(kyu) })}</p>
            <p className="settings-description">{t('levelTest.result.disclaimer')}</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="profile level-test">
      <div className="lesson-header">
        <button type="button" onClick={onBack}>
          {t('learn.back')}
        </button>
        <h2>{t('levelTest.title')}</h2>
      </div>
      <p className="exercises-meta">{t('levelTest.progress', { n: index + 1, total: battery.length })}</p>
      {!loaded || !game ? null : (
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
      <div className="exercises-controls">
        {status === 'solved' ? (
          <button type="button" className="primary" onClick={() => recordAndAdvance(true)}>
            {t('levelTest.next')}
          </button>
        ) : (
          <button type="button" onClick={handleGiveUp}>
            {t('levelTest.giveUp')}
          </button>
        )}
      </div>
    </div>
  )
}
