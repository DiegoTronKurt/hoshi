import { useState } from 'react'
import { ALL_HISTORIC_GAMES } from '../../content/historicGames'
import type { HistoricGame } from '../../content/historicGames'
import { gameRecordToSgf } from '../../core/sgf'
import { createEvalBackend } from '../../eval/backend'
import { useI18n } from '../../i18n'
import { BoardCanvas } from '../board/BoardCanvas'
import { downloadTextFile } from '../common/downloadTextFile'
import { useLazyWorkerClient } from '../common/useLazyWorkerClient'
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
 * de pasos guiados: son partidas reales completas (content/historicGames.ts,
 * ALL_HISTORIC_GAMES -- hoy el duelo AlphaGo vs. Lee Sedol mas partidas
 * clasicas sueltas, cada una con su propio contexto factual en eventLabel)
 * navegables jugada a jugada, con el mismo analisis de IA de partida
 * completa que Revisar (FullGameReviewPanel) -- reusado tal cual sobre
 * {width,height,komi,moves} en vez de un SavedGameRecord, porque estas
 * partidas son contenido fijo de la app, no algo que pase por
 * storage/db.ts.
 */
export function HistoricGamesScreen({ onBack }: HistoricGamesScreenProps) {
  const { t } = useI18n()
  const { theme, remoteEvalUrl } = useSettings()
  const [selected, setSelected] = useState<HistoricGame | null>(null)
  const [moveIndex, setMoveIndex] = useState(0)

  // Un solo backend de evaluacion para toda la vida de esta pantalla, no
  // uno por partida abierta. Local o remoto segun Ajustes, ver ReviewScreen.
  const evalClient = useLazyWorkerClient(() => createEvalBackend(remoteEvalUrl))

  function open(game: HistoricGame) {
    setSelected(game)
    setMoveIndex(game.moves.length)
  }

  function handleExportSgf(game: HistoricGame) {
    const sgf = gameRecordToSgf(game.width, game.height, game.komi, game.moves)
    downloadTextFile(`${game.id}.sgf`, sgf, 'application/x-go-sgf')
  }

  function titleLabel(game: HistoricGame): string {
    return game.round > 0
      ? t('historicGames.gameLabel', { round: game.round, black: game.blackName, white: game.whiteName })
      : t('historicGames.gameLabelStandalone', { black: game.blackName, white: game.whiteName })
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
          {t('historicGames.gameSubtitle', { date: selected.date, event: selected.eventLabel })} · {resultLabel(selected)}
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

        <button type="button" onClick={() => handleExportSgf(selected)}>
          {t('review.exportSgf')}
        </button>

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
          {t('learn.back')}
        </button>
        <h2>{t('historicGames.title')}</h2>
      </div>
      <p className="lesson-paragraph">{t('historicGames.intro')}</p>
      <ul className="learn-lesson-list">
        {ALL_HISTORIC_GAMES.map((game) => (
          <li key={game.id}>
            <button type="button" className="learn-lesson-card" onClick={() => open(game)}>
              <span className="historic-games-card-body">
                <span className="historic-games-card-title">{titleLabel(game)}</span>
                <span className="historic-games-card-result">{resultLabel(game)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
