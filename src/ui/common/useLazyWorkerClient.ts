import { useEffect, useState } from 'react'

/**
 * Patron repetido, antes de este hook, en 6 pantallas (TodayScreen,
 * ExercisePracticeScreen, LessonPractice y LevelTestScreen con SolverClient;
 * ReviewScreen y HistoricGamesScreen con EvalClient): un cliente de Worker
 * que vive toda la vida de la pantalla, construido en un efecto (nunca
 * durante el render, para no cargar el modelo/wasm de forma sincronica) y
 * terminado al desmontar. Estado (no solo ref) a proposito: varias de esas
 * pantallas pasan el cliente a un hijo (ReviewMistakeBoard,
 * useSolvableExercise) que necesita re-renderizar cuando pasa de null al
 * cliente real, no solo leerlo de forma imperativa.
 *
 * `factory` se llama una sola vez, en el mount -- deliberadamente fuera del
 * arreglo de dependencias del efecto. Los llamadores siempre pasan una
 * funcion inline sin variables reactivas capturadas (`() => new EvalClient(EVAL_MODEL_URL)`,
 * `() => new SolverClient()`): listarla como dependencia reconstruiria el
 * cliente -- recargando el modelo -- en cada render, exactamente lo que este
 * hook existe para evitar.
 */
export function useLazyWorkerClient<T extends { terminate(): void }>(factory: () => T): T | null {
  const [client, setClient] = useState<T | null>(null)
  useEffect(() => {
    const created = factory()
    setClient(created)
    return () => created.terminate()
  }, [])

  return client
}
