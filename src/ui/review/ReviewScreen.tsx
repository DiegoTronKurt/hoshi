import { useEffect, useMemo, useState } from 'react'
import { analyzeGame } from '../../analysis/mistakes'
import type { ConceptOccurrence } from '../../analysis/mistakes'
import type { ConceptSeverity } from '../../analysis/concepts'
import { applyMove, createGame } from '../../core/rules'
import { sgfToGameRecord } from '../../core/sgf'
import type { RecordedMove } from '../../core/sgf'
import { BLACK } from '../../core/types'
import type { GameState } from '../../core/types'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { listGames } from '../../storage/db'
import type { SavedGameRecord } from '../../storage/db'
import { BoardCanvas } from '../board/BoardCanvas'
import { useSettings } from '../settings'

function stateAtMove(size: number, komi: number, moves: RecordedMove[], moveNumber: number): GameState {
  let state = createGame(size, komi)
  for (let i = 0; i < moveNumber && i < moves.length; i++) {
    const result = applyMove(state, moves[i].point)
    if (!result.legal || !result.state) break
    state = result.state
  }
  return state
}

const SEVERITY_KEY: Record<ConceptSeverity, TranslationKey> = {
  high: 'review.severity.high',
  medium: 'review.severity.medium',
  low: 'review.severity.low',
}

type Mistake = ConceptOccurrence & { result: 'incorrect'; severity: ConceptSeverity; moveNumber: number }

function isMistake(occurrence: ConceptOccurrence): occurrence is Mistake {
  return occurrence.result === 'incorrect'
}

export function ReviewScreen() {
  const { t, language } = useI18n()
  const { theme } = useSettings()
  const [games, setGames] = useState<SavedGameRecord[]>([])
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null)

  useEffect(() => {
    listGames()
      .then(setGames)
      .catch(() => setGames([]))
  }, [])

  const selectedGame = games.find((g) => g.id === selectedGameId) ?? null

  const moves = useMemo(() => {
    if (!selectedGame) return []
    return sgfToGameRecord(selectedGame.sgf).moves
  }, [selectedGame])

  const events = useMemo(() => {
    if (!selectedGame) return []
    return analyzeGame(selectedGame.size, selectedGame.komi, moves).filter(isMistake)
  }, [selectedGame, moves])

  function selectGame(id: number) {
    setSelectedGameId(id)
    setSelectedEventIndex(null)
  }

  function backToList() {
    setSelectedGameId(null)
    setSelectedEventIndex(null)
  }

  const selectedEvent = selectedEventIndex !== null ? events[selectedEventIndex] : null
  const boardState =
    selectedGame && selectedEvent ? stateAtMove(selectedGame.size, selectedGame.komi, moves, selectedEvent.moveNumber) : null

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
                const opponent =
                  game.mode === 'bot' ? `${t('play.savedGames.vsBot')} (${game.botPlayouts})` : t('play.savedGames.local')
                const winnerLabel = game.result.winner === 'black' ? t('color.black') : t('color.white')
                return (
                  <li key={game.id}>
                    <button type="button" onClick={() => selectGame(game.id as number)}>
                      {date} · {game.size}x{game.size} · {opponent} · {winnerLabel} {game.result.black} -{' '}
                      {game.result.white}
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
        <button type="button" onClick={backToList}>
          {t('review.backToList')}
        </button>
        <h2>{t('review.title')}</h2>
      </div>

      {events.length === 0 ? (
        <p className="review-empty">{t('review.noMistakes')}</p>
      ) : (
        <ul className="review-mistakes-list">
          {events.map((event, index) => {
            const conceptLabelKey = `concept.${event.conceptId}.label` as TranslationKey
            const conceptSummaryKey = `concept.${event.conceptId}.summary` as TranslationKey
            const colorKey = event.color === BLACK ? 'color.black' : 'color.white'
            return (
              <li key={index}>
                <button
                  type="button"
                  className={index === selectedEventIndex ? 'active' : ''}
                  onClick={() => setSelectedEventIndex(index)}
                >
                  <span className="review-mistake-move">
                    {t('review.moveNumber', { n: event.moveNumber })} · {t(colorKey)}
                  </span>
                  <span className="review-mistake-concept">{t(conceptLabelKey)}</span>
                  <span className={`review-severity review-severity-${event.severity}`}>{t(SEVERITY_KEY[event.severity])}</span>
                  <span className="review-mistake-summary">{t(conceptSummaryKey)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {boardState && selectedEvent && (
        <div className="review-board">
          <BoardCanvas
            size={selectedGame.size}
            stones={boardState.board.stones}
            lastMove={selectedEvent.point}
            hintMove={selectedEvent.suggestedPoint ?? null}
            theme={theme}
            onIntersectionClick={() => {}}
          />
          {selectedEvent.suggestedPoint !== undefined && <p className="review-hint-legend">{t('review.suggestedMove')}</p>}
        </div>
      )}
    </div>
  )
}
