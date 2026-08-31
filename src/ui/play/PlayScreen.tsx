import { useEffect, useMemo, useRef, useState } from 'react'
import { applyMove, createGame } from '../../core/rules'
import { computeAreaScore } from '../../core/scoring'
import { gameRecordToSgf } from '../../core/sgf'
import type { RecordedMove } from '../../core/sgf'
import { BLACK } from '../../core/types'
import type { Color, GameState, IllegalReason } from '../../core/types'
import { EngineClient } from '../../engine/client'
import { useI18n } from '../../i18n'
import { listGames, saveGame } from '../../storage/db'
import type { SavedGameRecord } from '../../storage/db'
import { BoardCanvas } from '../board/BoardCanvas'
import { minimoTheme } from '../board/themes'
import { GameControls } from './GameControls'
import type { GameMode } from './GameControls'
import { SavedGamesList } from './SavedGamesList'
import { STRENGTH_LEVELS } from './strengthLevels'
import type { StrengthLevel } from './strengthLevels'

const KOMI = 6.5

export function PlayScreen() {
  const { t } = useI18n()

  const [size, setSize] = useState(9)
  const [mode, setMode] = useState<GameMode>('local')
  const [strengthId, setStrengthId] = useState<StrengthLevel['id']>('normal')
  const [humanColor, setHumanColor] = useState<Color>(BLACK)

  const [game, setGame] = useState<GameState>(() => createGame(9, KOMI))
  const [moves, setMoves] = useState<RecordedMove[]>([])
  const [lastMove, setLastMove] = useState<number | null>(null)
  const [message, setMessage] = useState<IllegalReason | null>(null)
  const [botThinking, setBotThinking] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [savedGames, setSavedGames] = useState<SavedGameRecord[]>([])

  const engineRef = useRef<EngineClient | null>(null)
  const savedThisGameRef = useRef(false)

  useEffect(() => {
    engineRef.current = new EngineClient()
    return () => engineRef.current?.terminate()
  }, [])

  useEffect(() => {
    listGames()
      .then(setSavedGames)
      .catch(() => setSavedGames([]))
  }, [])

  function resetGame(nextSize: number) {
    setGame(createGame(nextSize, KOMI))
    setMoves([])
    setLastMove(null)
    setMessage(null)
    setBotThinking(false)
    setJustSaved(false)
    savedThisGameRef.current = false
  }

  function handleSizeChange(nextSize: number) {
    setSize(nextSize)
    resetGame(nextSize)
  }

  function handleModeChange(nextMode: GameMode) {
    setMode(nextMode)
    resetGame(size)
  }

  function handleHumanColorChange(color: Color) {
    setHumanColor(color)
    resetGame(size)
  }

  function isHumanTurn(): boolean {
    if (game.gameOver || botThinking) return false
    return mode === 'local' || game.toMove === humanColor
  }

  function applyPlayerMove(point: number | null) {
    const color = game.toMove
    const result = applyMove(game, point)
    if (!result.legal || !result.state) {
      setMessage(result.reason ?? null)
      return
    }
    setMoves((prev) => [...prev, { color, point }])
    setGame(result.state)
    setLastMove(point)
    setMessage(null)
  }

  function handleIntersectionClick(point: number) {
    if (!isHumanTurn()) return
    applyPlayerMove(point)
  }

  function handlePass() {
    if (!isHumanTurn()) return
    applyPlayerMove(null)
  }

  // El bot juega automaticamente cuando le toca a el en modo "Contra el bot".
  useEffect(() => {
    if (mode !== 'bot' || game.gameOver || game.toMove === humanColor) return
    const engine = engineRef.current
    if (!engine) return

    const strength = STRENGTH_LEVELS.find((level) => level.id === strengthId) ?? STRENGTH_LEVELS[1]
    let cancelled = false
    setBotThinking(true)

    engine.chooseMove(game, strength.playouts).then((response) => {
      if (cancelled) return
      setBotThinking(false)
      const color = game.toMove
      const result = applyMove(game, response.move)
      if (!result.legal || !result.state) return
      setMoves((prev) => [...prev, { color, point: response.move }])
      setGame(result.state)
      setLastMove(response.move)
    })

    return () => {
      cancelled = true
    }
  }, [game, mode, humanColor, strengthId])

  const finalScore = useMemo(() => {
    if (!game.gameOver) return null
    return computeAreaScore(game.board, game.komi)
  }, [game])

  // Guarda la partida en IndexedDB apenas termina, una sola vez.
  useEffect(() => {
    if (!game.gameOver || savedThisGameRef.current || !finalScore) return
    savedThisGameRef.current = true

    const winner: 'black' | 'white' = finalScore.black > finalScore.white ? 'black' : 'white'
    const strength = STRENGTH_LEVELS.find((level) => level.id === strengthId)
    const sgf = gameRecordToSgf(size, KOMI, moves)

    saveGame({
      createdAt: new Date().toISOString(),
      size,
      komi: KOMI,
      mode,
      botPlayouts: mode === 'bot' ? strength?.playouts : undefined,
      result: { black: finalScore.black, white: finalScore.white, winner },
      sgf,
    }).then(() => {
      setJustSaved(true)
      listGames()
        .then(setSavedGames)
        .catch(() => {})
    })
  }, [game.gameOver, finalScore, size, mode, strengthId, moves])

  const turnKey = game.toMove === BLACK ? 'board.turn.black' : 'board.turn.white'

  return (
    <>
      <GameControls
        size={size}
        onSizeChange={handleSizeChange}
        mode={mode}
        onModeChange={handleModeChange}
        strengthId={strengthId}
        onStrengthChange={setStrengthId}
        humanColor={humanColor}
        onHumanColorChange={handleHumanColorChange}
        onNewGame={() => resetGame(size)}
        onPass={handlePass}
        passDisabled={!isHumanTurn()}
      />

      <BoardCanvas
        size={size}
        stones={game.board.stones}
        lastMove={lastMove}
        theme={minimoTheme}
        onIntersectionClick={handleIntersectionClick}
      />

      <div className="status" aria-live="polite">
        {game.gameOver ? (
          <>
            <p className="turn">{t('board.gameOver')}</p>
            {finalScore && (
              <p className="result">
                {t('play.result.title')}: {t('color.black')} {finalScore.black} - {t('color.white')}{' '}
                {finalScore.white} (
                {finalScore.black > finalScore.white ? t('play.result.winnerBlack') : t('play.result.winnerWhite')})
              </p>
            )}
            {justSaved && <p className="saved-note">{t('play.saved')}</p>}
          </>
        ) : botThinking ? (
          <p className="turn">{t('play.thinking')}</p>
        ) : (
          <p className="turn">{t(turnKey)}</p>
        )}
        {message && <p className="illegal-message">{t(`board.illegal.${message}`)}</p>}
        <p className="captures">
          {t('board.captures')}: {t('board.captures.black')} {game.captures.black} · {t('board.captures.white')}{' '}
          {game.captures.white}
        </p>
      </div>

      <section className="saved-games">
        <h2>{t('play.savedGames.title')}</h2>
        <SavedGamesList games={savedGames} />
      </section>
    </>
  )
}
