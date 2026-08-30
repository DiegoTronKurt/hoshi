import { useState } from 'react'
import { applyMove, createGame } from './core/rules'
import { BLACK } from './core/types'
import type { GameState, IllegalReason } from './core/types'
import { useI18n } from './i18n'
import type { Language } from './i18n'
import { BoardCanvas } from './ui/board/BoardCanvas'
import { minimoTheme } from './ui/board/themes'
import './App.css'

const BOARD_SIZES = [5, 7, 9] as const
const KOMI = 6.5

function createInitialGame(size: number): GameState {
  return createGame(size, KOMI)
}

function App() {
  const { language, setLanguage, t } = useI18n()
  const [size, setSize] = useState<number>(9)
  const [game, setGame] = useState<GameState>(() => createInitialGame(9))
  const [lastMove, setLastMove] = useState<number | null>(null)
  const [message, setMessage] = useState<IllegalReason | null>(null)

  const turnKey = game.toMove === BLACK ? 'board.turn.black' : 'board.turn.white'

  function handleNewGame(nextSize: number) {
    setSize(nextSize)
    setGame(createInitialGame(nextSize))
    setLastMove(null)
    setMessage(null)
  }

  function handleIntersectionClick(point: number) {
    const result = applyMove(game, point)
    if (!result.legal || !result.state) {
      setMessage(result.reason ?? null)
      return
    }
    setGame(result.state)
    setLastMove(point)
    setMessage(null)
  }

  function handlePass() {
    const result = applyMove(game, null)
    if (result.legal && result.state) {
      setGame(result.state)
      setMessage(null)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>{t('app.title')}</h1>
        <p className="tagline">{t('app.tagline')}</p>
        <div className="language-switch" role="group" aria-label={t('language.label')}>
          {(['en', 'es'] as Language[]).map((lang) => (
            <button
              key={lang}
              type="button"
              className={lang === language ? 'active' : ''}
              onClick={() => setLanguage(lang)}
            >
              {t(lang === 'en' ? 'language.en' : 'language.es')}
            </button>
          ))}
        </div>
      </header>

      <main className="app-main">
        <div className="controls">
          <label htmlFor="board-size">{t('board.size')}</label>
          <select
            id="board-size"
            value={size}
            onChange={(event) => handleNewGame(Number(event.target.value))}
          >
            {BOARD_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}x{s}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => handleNewGame(size)}>
            {t('board.newGame')}
          </button>
          <button type="button" onClick={handlePass} disabled={game.gameOver}>
            {t('board.pass')}
          </button>
        </div>

        <BoardCanvas
          size={size}
          stones={game.board.stones}
          lastMove={lastMove}
          theme={minimoTheme}
          onIntersectionClick={handleIntersectionClick}
        />

        <div className="status" aria-live="polite">
          <p className="turn">{game.gameOver ? t('board.gameOver') : t(turnKey)}</p>
          {message && <p className="illegal-message">{t(`board.illegal.${message}`)}</p>}
          <p className="captures">
            {t('board.captures')}: {t('board.captures.black')} {game.captures.black} ·{' '}
            {t('board.captures.white')} {game.captures.white}
          </p>
        </div>
      </main>
    </div>
  )
}

export default App
