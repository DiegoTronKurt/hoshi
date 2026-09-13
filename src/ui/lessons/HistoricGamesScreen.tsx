import { useEffect, useState } from 'react'
import { ALPHAGO_LEE_SEDOL_GAMES } from '../../content/historicGames'
import type { HistoricGame } from '../../content/historicGames'
import { EvalClient } from '../../eval/client'
import { EVAL_MODEL_URL } from '../../eval/modelUrl'
import { useI18n } from '../../i18n'
import { BoardCanvas } from '../board/BoardCanvas'
import { FullGameReviewPanel } from '../review/FullGameReviewPanel'
import { stateAtMove } from '../review/reviewState'
import { useSettings } from '../settings'

interface HistoricGamesScreenProps {
  onBack: () => void
}

/**
 * Referencia fuera de la escalera graduada, mismo patron de sub-pantalla
 * que JosekiScreen/AdvancedScreen (lista -> detalle, sin reportLocalBack
 * propio -- el fisico "atras" de Android vuelve directo a niveles, ver
 * LearnScreen). A diferencia de esas dos, el contenido no es un DemoScript
 * de pasos guiados: son 5 partidas reales completas (content/historicGames.ts)
 * navegables jugada a jugada, con el mismo analisis de IA de partida
 * completa que Revisar (FullGameReviewPanel) -- reusado tal cual sobre
 * {width,height,komi,moves} en vez de un SavedGameRecord, porque estas
 * partidas son contenido fijo de la app, no algo que pase por
 * storage/db.ts.
 */
export function HistoricGamesScreen({ onBack }: HistoricGamesScreenProps) {
  const { t } = useI18n()
  const { theme } = useSettings()
  const [selected, setSelected] = useState<HistoricGame | null>(null)
  const [moveIndex, setMoveIndex] = useState(0)

  // Mismo patron que ReviewScreen/PlayGameScreen: un EvalClient para toda
  // la vida de esta pantalla, no uno por partida abierta.
  const [evalClient, setEvalClient] = useState<EvalClient | null>(null)
  useEffect(() => {
    const client = new EvalClient(EVAL_MODEL_URL)
    setEvalClient(client)
    return () => client.terminate()
  }, [])

  function open(game: HistoricGame) {
    setSelected(game)
    setMoveIndex(game.moves.length)
  }

  function resultLabel(game: HistoricGame): string {
    const winnerName = game.result.winner === 'black' ? game.blackName : game.whiteName
    return game.result.method === 'resign'
      ? t('historicGames.resultResign', { winner: winnerName })
      : t('historicGames.resultPoints', { winner: winnerName, margin: game.result.margin ?? 0 })
  }

  if (selected) {
    const state = stateAtMove(selected.width, selected.height, selected.komi, selected.moves, moveIndex)
    const lastMove = moveIndex > 0 ? selected.moves[moveIndex - 1].point : null
    const atStart = moveIndex === 0
    const atEnd = moveIndex === selected.moves.length

    return (
      <div className="learn historic-games">
        <div className="lesson-header">
          <button type="button" onClick={() => setSelected(null)}>
            {t('historicGames.backToList')}
          </button>
          <h2>
            {selected.blackName} — {selected.whiteName}
          </h2>
        </div>

        <p className="lesson-paragraph">
          {t('historicGames.gameSubtitle', { date: selected.date })} · {resultLabel(selected)}
        </p>

        <BoardCanvas
          width={selected.width}
          height={selected.height}
          stones={state.board.stones}
          lastMove={lastMove}
          theme={theme}
          onIntersectionClick={() => {}}
        />

        <div className="historic-games-nav">
          <button type="button" onClick={() => setMoveIndex(0)} disabled={atStart}>
            {t('historicGames.navStart')}
          </button>
          <button type="button" onClick={() => setMoveIndex((n) => Math.max(0, n - 1))} disabled={atStart}>
            {t('historicGames.navPrev')}
          </button>
          <span className="historic-games-move-count">
            {t('review.moveNumber', { n: moveIndex })} / {selected.moves.length}
          </span>
          <button
            type="button"
            onClick={() => setMoveIndex((n) => Math.min(selected.moves.length, n + 1))}
            disabled={atEnd}
          >
            {t('historicGames.navNext')}
          </button>
          <button type="button" onClick={() => setMoveIndex(selected.moves.length)} disabled={atEnd}>
            {t('historicGames.navEnd')}
          </button>
        </div>

        <p className="review-ai-disclaimer">{t('historicGames.sourceDisclaimer')}</p>

        <FullGameReviewPanel
          width={selected.width}
          height={selected.height}
          komi={selected.komi}
          moves={selected.moves}
          evalClient={evalClient}
        />
      </div>
    )
  }

  return (
    <div className="learn historic-games">
      <div className="lesson-header">
        <button type="button" onClick={onBack}>
          {t('learn.backToLevels')}
        </button>
        <h2>{t('historicGames.title')}</h2>
      </div>
      <p className="lesson-paragraph">{t('historicGames.intro')}</p>
      <ul className="learn-lesson-list">
        {ALPHAGO_LEE_SEDOL_GAMES.map((game) => (
          <li key={game.id}>
            <button type="button" className="learn-lesson-card" onClick={() => open(game)}>
              <span className="historic-games-card-body">
                <span className="historic-games-card-title">
                  {t('historicGames.gameLabel', { round: game.round, black: game.blackName, white: game.whiteName })}
                </span>
                <span className="historic-games-card-result">{resultLabel(game)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
