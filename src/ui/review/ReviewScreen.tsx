import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { analyzeGame } from '../../analysis/mistakes'
import type { ConceptOccurrence } from '../../analysis/mistakes'
import { CONCEPTS } from '../../analysis/concepts'
import type { ConceptId, ConceptSeverity } from '../../analysis/concepts'
import { sgfToGameRecord } from '../../core/sgf'
import { BLACK } from '../../core/types'
import { buildImportedGameRecord } from '../../content/sgfImport'
import type { SgfImportError } from '../../content/sgfImport'
import { createEvalBackend } from '../../eval/backend'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { goBack } from '../../navigation/backNav'
import { reportLocalBack } from '../../navigation/localBack'
import { approxKyuForStrengthId } from '../play/strengthLevels'
import { gameHeight, gameWidth, listGames, saveGame } from '../../storage/db'
import type { SavedGameRecord } from '../../storage/db'
import { downloadTextFile } from '../common/downloadTextFile'
import { useLazyWorkerClient } from '../common/useLazyWorkerClient'
import { useSettings } from '../settings'
import { DojoScreen } from './DojoScreen'
import { FullGameReviewPanel } from './FullGameReviewPanel'
import { ReviewMistakeBoard } from './ReviewMistakeBoard'
import { stateAtMove } from './reviewState'

const IMPORT_ERROR_KEY: Record<SgfImportError, TranslationKey> = {
  parse: 'review.import.errorParse',
  'handicap-unsupported': 'review.import.errorHandicap',
  'no-result': 'review.import.errorNoResult',
}

const SEVERITY_KEY: Record<ConceptSeverity, TranslationKey> = {
  high: 'review.severity.high',
  medium: 'review.severity.medium',
  low: 'review.severity.low',
}

const SEVERITY_ORDER: Record<ConceptSeverity, number> = { high: 0, medium: 1, low: 2 }

const POINT_COST_KEY: Record<'realized' | 'potential', TranslationKey> = {
  realized: 'review.mistakePointCostRealized',
  potential: 'review.mistakePointCostPotential',
}

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
  const { theme, remoteEvalUrl } = useSettings()
  const [games, setGames] = useState<SavedGameRecord[]>([])
  const [selectedGameId, setSelectedGameId] = useState<number | null>(initialGameId ?? null)
  const [expandedSecondary, setExpandedSecondary] = useState<Set<number>>(new Set())
  const [importError, setImportError] = useState<TranslationKey | null>(null)
  const [dojoOpen, setDojoOpen] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  function reloadGames() {
    listGames()
      .then(setGames)
      .catch(() => setGames([]))
  }

  useEffect(() => {
    reloadGames()
  }, [])

  async function handleSgfFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImportError(null)
    const text = await file.text()
    const imported = buildImportedGameRecord(text)
    if (!imported.ok) {
      setImportError(IMPORT_ERROR_KEY[imported.error])
      return
    }
    await saveGame(imported.record)
    reloadGames()
  }

  // Un solo backend de evaluacion para toda la vida de la pantalla:
  // recrearlo por cada mistake reconsultado obligaria a recargar el modelo
  // (~11.5MB) cada vez. Local o remoto segun Ajustes (E3 del roadmap) --
  // cambiar la preferencia mientras la pantalla ya esta abierta se aplica
  // recien la proxima vez que se entra a Revisar, mismo criterio que el
  // resto de las preferencias de SettingsContext.
  const evalClient = useLazyWorkerClient(() => createEvalBackend(remoteEvalUrl))

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

  function handleExportSgf() {
    if (!selectedGame) return
    const date = selectedGame.createdAt.slice(0, 10)
    downloadTextFile(`hoshi-partida-${date}-${selectedGame.id}.sgf`, selectedGame.sgf, 'application/x-go-sgf')
  }

  function toggleSecondary(index: number) {
    setExpandedSecondary((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  // Boton fisico "atras" de Android: detalle de partida o Dojo -> lista --
  // ver navigation/localBack.ts. dojoOpen y selectedGameId nunca estan
  // activos a la vez (el Dojo se abre solo desde la lista), asi que un solo
  // nivel de profundidad alcanza para los dos.
  useEffect(() => {
    reportLocalBack(() => {
      if (dojoOpen) {
        setDojoOpen(false)
        return true
      }
      if (selectedGameId === null) return false
      backToList()
      return true
    }, dojoOpen || selectedGameId !== null ? 1 : 0)
    return () => reportLocalBack(null, 0)
  }, [dojoOpen, selectedGameId])

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

  if (dojoOpen) {
    return <DojoScreen evalClient={evalClient} onBack={() => setDojoOpen(false)} />
  }

  if (!selectedGame) {
    return (
      <div className="review">
        <h2>{t('review.title')}</h2>
        <div className="review-import">
          <button type="button" onClick={() => importInputRef.current?.click()}>
            {t('review.import.button')}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".sgf"
            className="review-import-file-input"
            onChange={handleSgfFileSelected}
          />
          <button type="button" onClick={() => setDojoOpen(true)}>
            {t('dojo.openCta')}
          </button>
        </div>
        {importError && <p className="review-import-error">{t(importError)}</p>}
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

      <p className="review-margin-line">
        {t('review.marginLine', {
          margin: Math.abs(selectedGame.result.black - selectedGame.result.white),
          winner: t(selectedGame.result.winner === 'black' ? 'color.black' : 'color.white'),
        })}
      </p>
      <button type="button" onClick={handleExportSgf}>
        {t('review.exportSgf')}
      </button>
      {events.some((e) => e.pointCost !== undefined) && (
        <p className="review-point-cost-disclaimer">{t('review.pointCostDisclaimer')}</p>
      )}

      <FullGameReviewPanel
        key={selectedGame.id}
        width={gameWidth(selectedGame)}
        height={gameHeight(selectedGame)}
        komi={selectedGame.komi}
        moves={moves}
        evalClient={evalClient}
      />

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
              {primaryEvent.pointCost !== undefined && (
                <p className="review-mistake-point-cost">
                  {t(POINT_COST_KEY[CONCEPTS[primaryEvent.conceptId].costKind ?? 'potential'], {
                    move: primaryEvent.moveNumber,
                    points: Math.round(primaryEvent.pointCost * 10) / 10,
                  })}
                </p>
              )}
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
                        {event.pointCost !== undefined && (
                          <p className="review-mistake-point-cost">
                            {t(POINT_COST_KEY[CONCEPTS[event.conceptId].costKind ?? 'potential'], {
                              move: event.moveNumber,
                              points: Math.round(event.pointCost * 10) / 10,
                            })}
                          </p>
                        )}
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
