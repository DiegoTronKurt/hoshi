import { useI18n } from '../../i18n'
import { gameHeight, gameWidth } from '../../storage/db'
import type { SavedGameRecord } from '../../storage/db'

interface SavedGamesListProps {
  games: SavedGameRecord[]
}

export function SavedGamesList({ games }: SavedGamesListProps) {
  const { language, t } = useI18n()

  if (games.length === 0) {
    return <p className="saved-games-empty">{t('play.savedGames.empty')}</p>
  }

  const locale = language === 'es' ? 'es' : 'en'

  return (
    <ul className="saved-games-list">
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
            game.mode === 'bot'
              ? `${t('play.savedGames.vsBot')} (${game.botPlayouts})`
              : t('play.savedGames.local')
          const winnerLabel = game.result.winner === 'black' ? t('color.black') : t('color.white')

          return (
            <li key={game.id}>
              {date} · {gameWidth(game)}x{gameHeight(game)} · {opponent} · {winnerLabel} {game.result.black} -{' '}
              {game.result.white}
              {game.scoringRule === 'japanese' && ` (${t('play.scoringRule.japaneseBadge')})`}
            </li>
          )
        })}
    </ul>
  )
}
