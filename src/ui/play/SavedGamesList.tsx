import { useI18n } from '../../i18n'
import { gameHeight, gameWidth } from '../../storage/db'
import type { SavedGameRecord } from '../../storage/db'
import { approxKyuForStrengthId } from './strengthLevels'

const MAX_VISIBLE_GAMES = 10

interface SavedGamesListProps {
  games: SavedGameRecord[]
}

export function SavedGamesList({ games }: SavedGamesListProps) {
  const { language, t } = useI18n()

  if (games.length === 0) {
    return <p className="saved-games-empty">{t('play.savedGames.empty')}</p>
  }

  const locale = language === 'es' ? 'es' : 'en'
  const recent = games.slice().reverse().slice(0, MAX_VISIBLE_GAMES)
  const hiddenCount = games.length - recent.length

  return (
    <>
      <ul className="saved-games-list">
        {recent.map((game) => {
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

          return (
            <li key={game.id}>
              {date} · {gameWidth(game)}x{gameHeight(game)} · {opponent} · {winnerLabel} {game.result.black} -{' '}
              {game.result.white}
              {game.scoringRule === 'japanese' && ` (${t('play.scoringRule.japaneseBadge')})`}
            </li>
          )
        })}
      </ul>
      {hiddenCount > 0 && <p className="saved-games-more">{t('play.savedGames.moreCount', { n: hiddenCount })}</p>}
    </>
  )
}
