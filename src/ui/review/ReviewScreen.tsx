import { useEffect, useMemo, useState } from 'react'
import { analyzeGame } from '../../analysis/mistakes'
import type { ConceptOccurrence } from '../../analysis/mistakes'
import type { ConceptId, ConceptSeverity } from '../../analysis/concepts'
import { sgfToGameRecord } from '../../core/sgf'
import { BLACK } from '../../core/types'
import { EvalClient } from '../../eval/client'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { goBack } from '../../navigation/backNav'
import { reportLocalBack } from '../../navigation/localBack'
import { approxKyuForStrengthId } from '../play/strengthLevels'
import { gameHeight, gameWidth, listGames } from '../../storage/db'
import type { SavedGameRecord } from '../../storage/db'
import { useSettings } from '../settings'
import { ReviewMistakeBoard } from './ReviewMistakeBoard'
import { stateAtMove } from './reviewState'

const EVAL_MODEL_URL = `${import.meta.env.BASE_URL}models/kata-b10c128/model.json`

const SEVERITY_KEY: Record<ConceptSeverity, TranslationKey> = {
  high: 'review.severity.high',
  medium: 'review.severity.medium',
  low: 'review.severity.low',
}

const SEVERITY_ORDER: Record<ConceptSeverity, number> = { high: 0, medium: 1, low: 2 }

export type Mistake = ConceptOccurrence & { result: 'incorrect'; severity: ConceptSeverity; moveNumber: number }

function isMistake(occurrence: ConceptOccurrence): occurrence is Mistake {
  return occurrence.result === 'incorrect'
}

/** Peor severidad entre los errores de una partida, o null si no tuvo ninguno. */
function worstSeverity(mistakes: Mistake[]): ConceptSeverity | null {
  if (mistakes.length === 0) return null
  return mistakes.reduce<ConceptSeverity>(
    (worst, m) => (SEVERITY_ORDER[m.severity] < SEVERITY_ORDER[worst] ? m.severity : worst),
    mistakes[0].severity,
  )
}

interface ReviewScreenProps {
  /** Salta a Ejercicios ya filtrado en el concepto del error principal. */
  onPracticeConcept: (conceptId: ConceptId) => void
  /** Partida a abrir directo en el detalle al entrar (p.ej. desde "Revisar
   * esta partida" al terminar una partida en Jugar). Se consume una sola vez
   * como valor inicial: cada vez que la pestana se monta de nuevo llega un
   * valor fresco, mismo patron que initialConcept en ExercisesScreen. */
  initialGameId?: number
}

export function ReviewScreen({ onPracticeConcept, initialGameId }: ReviewScreenProps) {
  const { t, language } = useI18n()
  const { theme } = useSettings()
  const [games, setGames] = useState<SavedGameRecord[]>([])
  const [selectedGameId, setSelectedGameId] = useState<number | null>(initialGameId ?? null)
  const [expandedSecondary, setExpandedSecondary] = useState<Set<number>>(new Set())

  useEffect(() => {
    listGames()
      .then(setGames)
      .catch(() => setGames([]))
  }, [])

  // Un solo EvalClient para toda la vida de la pantalla (mismo patron que
  // SolverClient en TodayScreen/ExercisePracticeScreen/LessonPractice y
  // EngineClient en PlayGameScreen): recrearlo por cada mistake
  // reconsultado obligaria a recargar el modelo (~11.5MB) cada vez. Estado
  // (no solo ref) porque ReviewMistakeBoard lo recibe como prop y necesita
  // re-renderizar cuando pasa de null al cliente real, tras el mount.
  const [evalClient, setEvalClient] = useState<EvalClient | null>(null)
  useEffect(() => {
    const client = new EvalClient(EVAL_MODEL_URL)
    setEvalClient(client)
    return () => client.terminate()
  }, [])

  const gameMistakes = useMemo(() => {
    const map = new Map<number, Mistake[]>()
    for (const g of games) {
      if (g.id === undefined) continue
      const gameMoves = sgfToGameRecord(g.sgf).moves
      map.set(g.id, analyzeGame(gameWidth(g), gameHeight(g), g.komi, gameMoves).filter(isMistake))
    }
    return map
  }, [games])

  const selectedGame = games.find((g) => g.id === selectedGameId) ?? null

  const moves = useMemo(() => {
    if (!selectedGame) return []
    return sgfToGameRecord(selectedGame.sgf).moves
  }, [selectedGame])

  const events = useMemo(() => {
    if (!selectedGame) return []
    return analyzeGame(gameWidth(selectedGame), gameHeight(selectedGame), selectedGame.komi, moves).filter(isMistake)
  }, [selectedGame, moves])

  // El evento de mayor severidad primero, en vez del orden cronologico: se
  // destaca como "error principal" y el resto queda como lista secundaria.
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
    [events],
  )
  const primaryEvent = sortedEvents[0] ?? null
  const secondaryEvents = sortedEvents.slice(1)

  function selectGame(id: number) {
    setSelectedGameId(id)
    setExpandedSecondary(new Set())
  }

  function backToList() {
    setSelectedGameId(null)
  }

  function toggleSecondary(index: number) {
    setExpandedSecondary((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  // Boton fisico "atras" de Android: detalle de partida -> lista -- ver
  // navigation/localBack.ts.
  useEffect(() => {
    reportLocalBack(() => {
      if (selectedGameId === null) return false
      backToList()
      return true
    }, selectedGameId === null ? 0 : 1)
    return () => reportLocalBack(null, 0)
  }, [selectedGameId])

  // Un tablero por error, no solo el seleccionado -- cada mistake (principal
  // y secundarios) muestra su propio ReviewMistakeBoard con su propio botón
  // "Preguntar a la IA" (perezoso, ver ReviewMistakeBoard::askAi), asi que
  // calcular los N tableros de mas no dispara N evaluaciones de la red.
  const eventBoardStates = useMemo(() => {
    if (!selectedGame) return []
    return sortedEvents.map((event) =>
      stateAtMove(gameWidth(selectedGame), gameHeight(selectedGame), selectedGame.komi, moves, event.moveNumber),
    )
  }, [selectedGame, moves, sortedEvents])

  const locale = language === 'es' ? 'es' : 'en'

  if (!selectedGame) {
    return (
      <div className="review">
        <h2>{t('review.title')}</h2>
        {games.length === 0 ? (
          <p className="review-empty">{t('review.noGames')}</p>
        ) : (
          <ul className="review-games-list">
            {games
              .slice()
              .reverse()
              .map((game) => {
                const date = new Date(game.createdAt).toLocaleDateString(locale, {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })
                const kyu = approxKyuForStrengthId(game.botStrengthId)
                const opponent =
                  game.mode === 'bot'
                    ? kyu !== null
                      ? t('play.savedGames.vsBotKyu', { kyu })
                      : t('play.savedGames.vsBot')
                    : t('play.savedGames.local')
                const winnerLabel = game.result.winner === 'black' ? t('color.black') : t('color.white')
                const severity = game.id !== undefined ? worstSeverity(gameMistakes.get(game.id) ?? []) : null
                return (
                  <li key={game.id}>
                    <button type="button" onClick={() => selectGame(game.id as number)}>
                      <span>
                        {date} · {gameWidth(game)}x{gameHeight(game)} · {opponent} · {winnerLabel} {game.result.black} -{' '}
                        {game.result.white}
                        {game.scoringRule === 'japanese' && ` (${t('play.scoringRule.japaneseBadge')})`}
                      </span>
                      {severity && (
                        <span className={`review-severity review-severity-${severity} review-game-severity`}>
                          {t(SEVERITY_KEY[severity])}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="review">
      <div className="review-header">
        <button type="button" onClick={goBack}>
          {t('review.backToList')}
        </button>
        <h2>{t('review.title')}</h2>
      </div>

      {events.length === 0 ? (
        <p className="review-empty">{t('review.noMistakes')}</p>
      ) : (
        <>
          {primaryEvent && eventBoardStates[0] && (
            <section className="review-primary-mistake">
              <div className="review-primary-mistake-header">
                <span className="review-primary-mistake-title">{t('review.primaryMistake')}</span>
                <span className={`review-severity review-severity-${primaryEvent.severity}`}>
                  {t(SEVERITY_KEY[primaryEvent.severity])}
                </span>
              </div>

              <ReviewMistakeBoard
                key={`${selectedGame.id}-0`}
                game={selectedGame}
                moves={moves}
                event={primaryEvent}
                boardState={eventBoardStates[0]}
                theme={theme}
                evalClient={evalClient}
              />

              <p className="review-mistake-move">
                {t('review.moveNumber', { n: primaryEvent.moveNumber })} ·{' '}
                {t(primaryEvent.color === BLACK ? 'color.black' : 'color.white')}
              </p>
              <p className="review-mistake-concept">{t(`concept.${primaryEvent.conceptId}.label` as TranslationKey)}</p>
              <p className="review-mistake-summary">{t(`concept.${primaryEvent.conceptId}.summary` as TranslationKey)}</p>
              <button
                type="button"
                className="review-practice-concept"
                onClick={() => onPracticeConcept(primaryEvent.conceptId)}
              >
                {t('review.practiceConcept')}
              </button>
            </section>
          )}

          {secondaryEvents.length > 0 && (
            <div className="review-secondary-mistakes">
              <h3>{t('review.otherMistakes')}</h3>
              {secondaryEvents.map((event, i) => {
                const index = i + 1
                const boardState = eventBoardStates[index]
                if (!boardState) return null
                const colorKey = event.color === BLACK ? 'color.black' : 'color.white'
                const expanded = expandedSecondary.has(index)
                return (
                  <section key={index} className="review-secondary-mistake-card">
                    <button
                      type="button"
                      className="review-secondary-mistake-toggle"
                      aria-expanded={expanded}
                      onClick={() => toggleSecondary(index)}
                    >
                      <span className={`review-severity review-severity-${event.severity}`}>
                        {t(SEVERITY_KEY[event.severity])}
                      </span>
                      <span className="review-secondary-mistake-summary-line">
                        {t('review.moveNumber', { n: event.moveNumber })} ·{' '}
                        {t(`concept.${event.conceptId}.label` as TranslationKey)}
                      </span>
                    </button>

                    {expanded && (
                      <>
                        <ReviewMistakeBoard
                          key={`${selectedGame.id}-${index}`}
                          game={selectedGame}
                          moves={moves}
                          event={event}
                          boardState={boardState}
                          theme={theme}
                          evalClient={evalClient}
                        />

                        <p className="review-mistake-move">
                          {t('review.moveNumber', { n: event.moveNumber })} · {t(colorKey)}
                        </p>
                        <p className="review-mistake-concept">
                          {t(`concept.${event.conceptId}.label` as TranslationKey)}
                        </p>
                        <p className="review-mistake-summary">
                          {t(`concept.${event.conceptId}.summary` as TranslationKey)}
                        </p>
                        <button
                          type="button"
                          className="review-practice-concept"
                          onClick={() => onPracticeConcept(event.conceptId)}
                        >
                          {t('review.practiceConcept')}
                        </button>
                      </>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
