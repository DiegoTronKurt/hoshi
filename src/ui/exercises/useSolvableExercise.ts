import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CONCEPTS } from '../../analysis/concepts'
import type { BankEntry, LoadedProblem } from '../../content/problemBank'
import { getLesson } from '../../content/lessons'
import { getGroup } from '../../core/groups'
import { gameStateFromBoard, applyMove, listLegalMoves } from '../../core/rules'
import { opponent } from '../../core/types'
import type { Color, GameState } from '../../core/types'
import { EvalClient } from '../../eval/client'
import { EVAL_MODEL_URL } from '../../eval/modelUrl'
import { legalPolicyDistribution } from '../../eval/policy'
import type { TranslationKey } from '../../i18n'
import { createCard, gradeFromAttempt, reviewCard } from '../../learning/fsrs'
import { computeRegion } from '../../solver/region'
import type { SolverClient } from '../../solver/client'
import { isGroupPassAlive } from '../../solver/tsumego'
import { simulateLadder, solveLadder } from '../../solver/ladder'
import { isDoubleAtariMove } from '../../solver/doubleAtari'
import { PASS_VALUE_THRESHOLD, areaDeltaForPoint, bestAreaMove, isBestAreaMove, isOwnTerritory } from '../../solver/areaValue'
import { raceBehindColor, sharedLibertiesOf } from '../../solver/semeai'
import { getSrsCard, listAttempts, recordAttempt, saveSrsCard } from '../../storage/db'
import { findConceptsToReopenFromExercises } from '../../training-policy/session'
import { reopenLesson } from '../lessons/readProgress'
import { useSettings } from '../settings'

export type ProblemStatus = 'playing' | 'incorrect' | 'solved'

/** Cuantos intentos incorrectos "reales" (no los clics fuera de lugar que ni
 * siquiera cuentan para wrongAttemptsRef) hacen falta antes de ofrecer una
 * pista. Se pisa la KataGo policy-net, misma mecanica que el hint de Play. */
const HINT_AVAILABLE_AFTER_WRONG = 2

export interface WrongFlash {
  point: number
  /** Se incrementa en cada clic incorrecto, incluso si el punto es el mismo
   * que la vez anterior -- BoardCanvas dispara el destello por identidad de
   * este objeto, no por igualdad del punto, para que clickear el mismo punto
   * invalido dos veces seguidas siga mostrando el destello las dos veces. */
  id: number
}

const SOLVE_MAX_DEPTH = 8

export interface SolvableProblemState {
  game: GameState | null
  lastMove: number | null
  status: ProblemStatus
  thinking: boolean
  /** True si el ultimo intento de consultar al solucionador fallo (Worker
   * caido o colgado) -- no es un intento incorrecto, es que no se pudo
   * verificar la jugada. */
  solverError: boolean
  solutionMoves: number | null
  isUserTurn: boolean
  /** Por que el ultimo clic no funciono, para un mensaje especifico en vez
   * del generico "intenta de nuevo" -- null cuando no aplica (todavia no
   * hubo ningun intento incorrecto, o no se pudo identificar una razon mas
   * puntual que la generica). */
  wrongReason: TranslationKey | null
  /** Punto del ultimo clic incorrecto, para el destello del tablero. Ver
   * WrongFlash: la identidad del objeto, no el punto en si, es lo que
   * dispara la animacion. */
  wrongFlash: WrongFlash | null
  /** Punto sugerido por la red de politicas, solo despues de suficientes
   * intentos incorrectos reales -- ver HINT_AVAILABLE_AFTER_WRONG. */
  hintPoint: number | null
  hintLoading: boolean
  /** Si corresponde ofrecer el boton de pista ahora mismo (ya se gastaron
   * suficientes intentos, el problema no es de reconocimiento puro, y
   * todavia no esta resuelto). */
  hintAvailable: boolean
  handleHint: () => void
  handleIntersectionClick: (point: number) => void
  /** Solo tiene efecto para loaded.kind === 'areaValue': las otras dos
   * respuestas (RELLENO_TERRITORIO_PROPIO/PASE_PREMATURO) son "un punto
   * concreto" o "pasar", nunca ambas a la vez. */
  handlePass: () => void
  reset: () => void
  /** Reporta el problema como no resuelto (para un boton "no lo se" / saltar). */
  giveUp: () => void
}

/** A quien le toca jugar al empezar cada tipo de ejercicio. */
function initialToMove(loaded: LoadedProblem): Color {
  if (loaded.kind === 'tsumego') return loaded.problem.toMove
  if (loaded.kind === 'ladder') return loaded.problem.chaserColor
  if (loaded.kind === 'areaValue') return loaded.problem.toMove
  if (loaded.kind === 'semeaiLiberty') return loaded.problem.toMove
  return loaded.problem.color
}

/**
 * Toda la mecanica de resolver un ejercicio en vivo: validar la jugada,
 * jugar la respuesta del rival si corresponde, y llevar la cuenta de
 * intentos. La usan tanto Ejercicios (practica libre) como Hoy (sesion
 * dirigida por FSRS), asi que el registro de aprendizaje vive aca, no en
 * cada pantalla: cualquier problema resuelto, sin importar por donde se
 * llegue a el, actualiza el intento guardado y la tarjeta SRS de ese
 * problema.
 *
 * Cuatro tipos de problema conviven aca porque ninguno de los otros tres
 * encaja en Problem/solve() (ver content/ladderProblem.ts,
 * content/doubleAtariProblem.ts y content/areaValueProblem.ts): tsumego
 * valida contra el Worker del solucionador de vida-muerte y deja que el
 * rival responda con la mejor defensa/ataque; escalera valida con
 * solveLadder en el hilo principal (es barata) y hace jugar al que huye su
 * mejor escape; doble atari es reconocimiento de una sola jugada, se
 * resuelve al toque sin respuesta del rival; valor de area (RELLENO_
 * TERRITORIO_PROPIO/PASE_PREMATURO) valida con solver/areaValue.ts y no
 * tiene respuesta del rival tampoco, pero a diferencia de doble atari admite
 * dos formas de responder -- un punto o pasar (handlePass) -- porque la
 * jugada correcta puede ser cualquiera de las dos segun la posicion.
 */
export function useSolvableExercise(
  entry: BankEntry | null,
  loaded: LoadedProblem | null,
  solverClient: SolverClient | null,
): SolvableProblemState {
  const { playStoneSoundIfEnabled } = useSettings()
  const [game, setGame] = useState<GameState | null>(null)
  const [lastMove, setLastMove] = useState<number | null>(null)
  const [status, setStatus] = useState<ProblemStatus>('playing')
  const [thinking, setThinking] = useState(false)
  const [solverError, setSolverError] = useState(false)
  const [solutionMoves, setSolutionMoves] = useState<number | null>(null)
  const [wrongReason, setWrongReason] = useState<TranslationKey | null>(null)
  const [wrongFlash, setWrongFlash] = useState<WrongFlash | null>(null)
  const [wrongAttemptCount, setWrongAttemptCount] = useState(0)
  const [hintPoint, setHintPoint] = useState<number | null>(null)
  const [hintLoading, setHintLoading] = useState(false)

  const wrongAttemptsRef = useRef(0)
  const recordedRef = useRef(false)
  const startTimeRef = useRef<number | null>(null)
  const flashIdRef = useRef(0)
  const hintEvalRef = useRef<EvalClient | null>(null)

  useEffect(() => () => hintEvalRef.current?.terminate(), [])
  // Un anillo de pista de la posicion anterior ya no tiene sentido en una
  // nueva posicion (tsumego/escalera pueden avanzar varias jugadas dentro
  // del mismo problema) -- mismo disparador que usa PlayGameScreen.tsx.
  useEffect(() => {
    setHintPoint(null)
  }, [game])

  const region = useMemo(() => {
    if (!loaded || loaded.kind !== 'tsumego') return []
    return computeRegion(loaded.problem.board, loaded.problem.targetPoints, 1)
  }, [loaded])

  const isResolved = useCallback(
    (g: GameState): boolean => {
      if (!loaded || loaded.kind !== 'tsumego') return false
      const problem = loaded.problem
      if (problem.objective === 'live') {
        return isGroupPassAlive(g.board, problem.targetPoints, problem.targetColor)
      }
      return !problem.targetPoints.some((p) => g.board.stones[p] === problem.targetColor)
    },
    [loaded],
  )

  useEffect(() => {
    wrongAttemptsRef.current = 0
    recordedRef.current = false
    startTimeRef.current = null
    setSolverError(false)
    setWrongReason(null)
    setWrongFlash(null)
    setWrongAttemptCount(0)
    if (!loaded) {
      setGame(null)
      setLastMove(null)
      setStatus('playing')
      return
    }
    setGame(gameStateFromBoard(loaded.problem.board, initialToMove(loaded)))
    setLastMove(null)
    setStatus('playing')
    startTimeRef.current = Date.now()
  }, [loaded])

  // Cuenta cuantas jugadas propias hacen falta para resolver el problema, una
  // sola vez al cargarlo. Para escalera y doble atari es sincrono y barato;
  // para tsumego simula la linea optima completa via el Worker.
  useEffect(() => {
    setSolutionMoves(null)
    if (!loaded) return

    if (loaded.kind === 'doubleAtari' || loaded.kind === 'areaValue' || loaded.kind === 'semeaiLiberty') {
      setSolutionMoves(1)
      return
    }

    if (loaded.kind === 'ladder') {
      const p = loaded.problem
      const step = simulateLadder({ board: p.board, runnerPoint: p.runnerPoint, chaserColor: p.chaserColor })
      setSolutionMoves(step.captured ? step.chaserMoves.length : null)
      return
    }

    const client = solverClient
    if (!client) return
    const p = loaded.problem
    const r = region
    const c = client
    let cancelled = false

    async function countSolutionMoves() {
      let state = gameStateFromBoard(p.board, p.toMove)
      let studentMoves = 0
      try {
        for (let ply = 0; ply < SOLVE_MAX_DEPTH; ply++) {
          if (isResolved(state)) {
            if (!cancelled) setSolutionMoves(studentMoves)
            return
          }
          const result = await c.solve({
            board: state.board,
            region: r,
            targetPoints: p.targetPoints,
            targetColor: p.targetColor,
            toMove: state.toMove,
            objective: p.objective,
            maxDepth: SOLVE_MAX_DEPTH,
            pruneAfterDecisive: true,
          })
          if (cancelled || !result.solved || result.root.move === null) return
          if (state.toMove === p.toMove) studentMoves++
          const applied = applyMove(state, result.root.move, { regionPoints: new Set(r) })
          if (!applied.legal || !applied.state) return
          state = applied.state
        }
      } catch {
        // Es solo una pista opcional (cuantas jugadas faltan); si el Worker
        // falla no hay nada que mostrarle al usuario, solutionMoves
        // simplemente se queda sin dato en vez de propagar el error.
      }
    }

    countSolutionMoves()
    return () => {
      cancelled = true
    }
  }, [loaded, region, isResolved, solverClient])

  const recordOutcome = useCallback(
    async (solved: boolean) => {
      if (!entry) return
      const wrongAttempts = wrongAttemptsRef.current
      const responseTimeMs = startTimeRef.current !== null ? Date.now() - startTimeRef.current : undefined
      try {
        await recordAttempt({
          problemId: entry.id,
          conceptId: entry.conceptId,
          createdAt: new Date().toISOString(),
          solved,
          wrongAttempts,
          responseTimeMs,
        })
        const grade = gradeFromAttempt(solved, wrongAttempts)
        const existing = await getSrsCard(entry.id)
        const baseCard = existing?.card ?? createCard()
        const updatedCard = reviewCard(baseCard, grade)
        await saveSrsCard({ problemId: entry.id, conceptId: entry.conceptId, card: updatedCard })

        // Chequeo de reapertura (mismo patron que PlayGameScreen.tsx tras
        // guardar una partida): un intento nuevo es un evento real, asi que
        // se evalua aca, una vez por intento, no cada vez que se abre Hoy.
        // listAttempts() para incluir este intento recien guardado.
        const allAttempts = await listAttempts()
        for (const conceptId of findConceptsToReopenFromExercises(allAttempts)) {
          const lesson = getLesson(CONCEPTS[conceptId].lessonId)
          if (lesson) reopenLesson(lesson.id, conceptId)
        }
      } catch {
        // Sin IndexedDB disponible (o algun otro fallo de almacenamiento), el
        // ejercicio en si ya funciono para la persona; solo se pierde el
        // registro de aprendizaje de este intento.
      }
    },
    [entry],
  )

  useEffect(() => {
    if (status === 'solved' && !recordedRef.current) {
      recordedRef.current = true
      void recordOutcome(true)
    }
  }, [status, recordOutcome])

  const userColor = loaded ? initialToMove(loaded) : null
  const isUserTurn =
    (status === 'playing' || status === 'incorrect') && !!game && !!loaded && game.toMove === userColor

  /**
   * Centraliza lo que pasa en CUALQUIER clic incorrecto: mensaje especifico
   * (o generico si reason es null -- ver el fallback en ExerciseView), el
   * destello del punto, y si corresponde ademas contar como intento real
   * (wrongAttemptsRef/wrongAttemptCount, lo que a su vez alimenta la nota
   * SRS del intento y el umbral de la pista). Los clics que hoy no daban
   * ninguna senal (fuera de la region, ilegales) pasan por aca tambien pero
   * con countsAsAttempt=false, para no cambiar esas dos cosas.
   */
  function markWrong(point: number, reason: TranslationKey | null, countsAsAttempt: boolean) {
    if (countsAsAttempt) {
      wrongAttemptsRef.current += 1
      setWrongAttemptCount((n) => n + 1)
    }
    flashIdRef.current += 1
    setWrongFlash({ point, id: flashIdRef.current })
    setWrongReason(reason)
    setStatus('incorrect')
  }

  async function handleIntersectionClick(point: number) {
    if (!isUserTurn || thinking || !loaded || !game) return
    setWrongReason(null)

    if (loaded.kind === 'tsumego') {
      const problem = loaded.problem
      if (!region.includes(point)) {
        markWrong(point, 'exercises.wrongReason.offTarget', false)
        return
      }

      const result = applyMove(game, point, { regionPoints: new Set(region) })
      if (!result.legal || !result.state) {
        markWrong(point, result.reason === 'suicide' ? 'exercises.wrongReason.suicide' : 'exercises.wrongReason.illegal', false)
        return
      }
      playStoneSoundIfEnabled()

      const client = solverClient
      if (!client) return

      setThinking(true)
      setSolverError(false)
      let check
      try {
        check = await client.solve({
          board: result.state.board,
          region,
          targetPoints: problem.targetPoints,
          targetColor: problem.targetColor,
          toMove: result.state.toMove,
          objective: problem.objective,
          maxDepth: SOLVE_MAX_DEPTH,
          pruneAfterDecisive: true,
        })
      } catch {
        setSolverError(true)
        return
      } finally {
        setThinking(false)
      }

      if (!check.solved) {
        const selfAtari = getGroup(result.state.board, point)?.liberties.size === 1
        markWrong(point, selfAtari ? 'exercises.wrongReason.selfAtari' : null, true)
        return
      }

      if (isResolved(result.state)) {
        setGame(result.state)
        setLastMove(point)
        setStatus('solved')
        return
      }

      const applied = applyMove(result.state, check.root.move, { regionPoints: new Set(region) })
      const nextGame = applied.legal && applied.state ? applied.state : result.state
      const nextLastMove = applied.legal && applied.state ? (check.root.move ?? point) : point
      if (applied.legal && applied.state) playStoneSoundIfEnabled()
      setGame(nextGame)
      setLastMove(nextLastMove)
      setStatus('playing')
      return
    }

    if (loaded.kind === 'ladder') {
      const problem = loaded.problem
      const runnerLibertiesBefore = getGroup(game.board, problem.runnerPoint)?.liberties.size ?? 0
      const result = applyMove(game, point)
      if (!result.legal || !result.state) {
        markWrong(point, result.reason === 'suicide' ? 'exercises.wrongReason.suicide' : 'exercises.wrongReason.illegal', false)
        return
      }
      playStoneSoundIfEnabled()

      const afterChaser = result.state
      const runnerGroup = getGroup(afterChaser.board, problem.runnerPoint)
      if (!runnerGroup || runnerGroup.liberties.size === 0) {
        setGame(afterChaser)
        setLastMove(point)
        setStatus('solved')
        return
      }

      const outcome = solveLadder({
        board: afterChaser.board,
        runnerPoint: problem.runnerPoint,
        chaserColor: problem.chaserColor,
        toMove: opponent(problem.chaserColor),
      })

      if (!outcome.captured) {
        const offTrack = runnerGroup.liberties.size >= runnerLibertiesBefore
        markWrong(point, offTrack ? 'exercises.wrongReason.offTarget' : null, true)
        return
      }

      const runnerMove = outcome.moves[0] ?? null
      if (runnerMove !== null) {
        // El que huye tiene una extension legal: la juega y sigue vivo (si
        // no lo estuviera, esa jugada habria sido suicidio e ilegal).
        const afterRunner = applyMove(afterChaser, runnerMove)
        playStoneSoundIfEnabled()
        setGame(afterRunner.legal && afterRunner.state ? afterRunner.state : afterChaser)
        setLastMove(runnerMove)
        setStatus('playing')
      } else {
        // El que huye no tiene ninguna jugada legal entre sus libertades
        // (todas serian suicidio): esta muerto, pero las piedras siguen en
        // el tablero hasta que el perseguidor efectivamente juegue ahi. Pasa
        // el turno para que el estudiante haga esa jugada final.
        const passed = applyMove(afterChaser, null)
        setGame(passed.legal && passed.state ? passed.state : afterChaser)
        setLastMove(point)
        setStatus('playing')
      }
      return
    }

    if (loaded.kind === 'areaValue') {
      const problem = loaded.problem
      // Jugar dentro del propio territorio ya asegurado es incorrecto sin
      // importar nada mas (RELLENO_TERRITORIO_PROPIO): ni siquiera hace
      // falta mirar el delta de area para esta parte.
      if (isOwnTerritory(game.board, point, problem.toMove)) {
        markWrong(point, 'exercises.wrongReason.ownTerritory', true)
        return
      }

      // Cualquier punto que mejore el area por encima del mismo umbral que
      // usa detectPasePrematuro cuenta como correcto, no solo el mejor: el
      // ejercicio ensena "hay una jugada real aca", no "encuentra LA mejor".
      const delta = areaDeltaForPoint(game.board, point, problem.toMove)
      if (delta === null || delta <= PASS_VALUE_THRESHOLD) {
        // areaDeltaForPoint devuelve null exactamente cuando la jugada es
        // ilegal (ocupado): en ese caso "no gana nada" seria enganoso.
        markWrong(point, delta === null ? 'exercises.wrongReason.illegal' : 'exercises.wrongReason.noGain', true)
        return
      }

      // EL_FINAL_TAMBIEN_ES_GRANDE/COMPARAR_VALOR_REAL (nivel 9, yose) y
      // JUICIO_LOCAL_VS_GLOBAL (nivel 7, zonas separadas del tablero -- ver
      // tools/generate-whole-board-judgment-problems.ts) son mas estrictos
      // que RELLENO_TERRITORIO_PROPIO/PASE_PREMATURO: ahi alcanza con
      // cualquier punto que supere el umbral, aca la gracia es encontrar EL
      // mejor, no cualquiera que sirva -- se recalcula en vivo, igual que el
      // resto de este bloque, nunca contra una etiqueta guardada.
      // isBestAreaMove (no comparar contra bestAreaMove(...).point) acepta
      // cualquier punto empatado en el delta maximo, no solo el primero que
      // bestAreaMove encuentra recorriendo el tablero.
      if (
        (problem.conceptId === 'EL_FINAL_TAMBIEN_ES_GRANDE' ||
          problem.conceptId === 'COMPARAR_VALOR_REAL' ||
          problem.conceptId === 'JUICIO_LOCAL_VS_GLOBAL') &&
        !isBestAreaMove(game.board, point, problem.toMove)
      ) {
        markWrong(point, 'exercises.wrongReason.notBiggest', true)
        return
      }

      const result = applyMove(game, point)
      if (!result.legal || !result.state) return
      playStoneSoundIfEnabled()
      setGame(result.state)
      setLastMove(point)
      setStatus('solved')
      return
    }

    if (loaded.kind === 'semeaiLiberty') {
      // Clic de reconocimiento, no una jugada: nunca se llama a applyMove
      // aca, solo se compara contra las mismas funciones que usa el
      // generador (solver/semeai.ts), recalculadas en vivo sobre el tablero
      // actual -- primero y unico tipo de ejercicio en este archivo que no
      // coloca una piedra.
      const problem = loaded.problem
      const isSharedLibertyConcept = problem.conceptId === 'LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO'
      const correct = isSharedLibertyConcept
        ? (sharedLibertiesOf(game.board, problem.groupAPoint, problem.groupBPoint)?.has(point) ?? false)
        : getGroup(game.board, point)?.color === raceBehindColor(game.board, problem.groupAPoint, problem.groupBPoint)

      if (!correct) {
        markWrong(
          point,
          isSharedLibertyConcept ? 'exercises.wrongReason.notSharedLiberty' : 'exercises.wrongReason.wrongGroup',
          true,
        )
        return
      }

      setLastMove(point)
      setStatus('solved')
      return
    }

    // doubleAtari: reconocimiento de una sola jugada, sin respuesta del rival.
    const problem = loaded.problem
    if (!isDoubleAtariMove(game.board, point, problem.color)) {
      markWrong(point, 'exercises.wrongReason.notDoubleAtari', true)
      return
    }

    const result = applyMove(game, point)
    if (!result.legal || !result.state) return
    playStoneSoundIfEnabled()
    setGame(result.state)
    setLastMove(point)
    setStatus('solved')
  }

  function handlePass() {
    if (!isUserTurn || thinking || !loaded || !game || loaded.kind !== 'areaValue') return
    setWrongReason(null)
    const problem = loaded.problem
    const best = bestAreaMove(game.board, problem.toMove)
    if (best !== null) {
      // Habia una jugada real (PASE_PREMATURO): pasar fue prematuro. No hay
      // un punto que destellar (no fue un clic en el tablero), asi que esto
      // no pasa por markWrong.
      wrongAttemptsRef.current += 1
      setWrongAttemptCount((n) => n + 1)
      setWrongReason('exercises.wrongReason.passedTooEarly')
      setStatus('incorrect')
      return
    }
    setLastMove(null)
    setStatus('solved')
  }

  const hintAvailable =
    !!loaded &&
    loaded.kind !== 'semeaiLiberty' &&
    status !== 'solved' &&
    wrongAttemptCount >= HINT_AVAILABLE_AFTER_WRONG

  async function handleHint() {
    if (!game || hintLoading || hintPoint !== null || !hintAvailable) return
    setHintLoading(true)
    try {
      if (!hintEvalRef.current) hintEvalRef.current = new EvalClient(EVAL_MODEL_URL)
      const output = await hintEvalRef.current.evaluate({ state: game })
      const legal = listLegalMoves(game)
      const legalPoints = legal.filter((p): p is number => p !== null)
      const legalPass = legal.includes(null)
      const distribution = legalPolicyDistribution(output.policy, legalPoints, legalPass, game.board.width)
      let topPoint: number | null = null
      let topProbability = -1
      for (const [point, probability] of distribution) {
        if (probability > topProbability) {
          topProbability = probability
          topPoint = point
        }
      }
      setHintPoint(topPoint)
    } catch {
      // silencioso, misma decision que la pista de PlayGameScreen.tsx.
    } finally {
      setHintLoading(false)
    }
  }

  function reset() {
    if (!loaded) return
    wrongAttemptsRef.current = 0
    recordedRef.current = false
    setSolverError(false)
    setWrongReason(null)
    setWrongFlash(null)
    setWrongAttemptCount(0)
    setGame(gameStateFromBoard(loaded.problem.board, initialToMove(loaded)))
    setLastMove(null)
    setStatus('playing')
  }

  function giveUp() {
    if (recordedRef.current) return
    recordedRef.current = true
    void recordOutcome(false)
  }

  return {
    game,
    lastMove,
    status,
    thinking,
    solverError,
    solutionMoves,
    isUserTurn,
    wrongReason,
    wrongFlash,
    hintPoint,
    hintLoading,
    hintAvailable,
    handleHint,
    handleIntersectionClick,
    handlePass,
    reset,
    giveUp,
  }
}
