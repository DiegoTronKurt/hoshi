import { useI18n } from '../../i18n'

interface PlayInGameControlsProps {
  onUndo: () => void
  undoDisabled: boolean
  onPass: () => void
  passDisabled: boolean
  showCount: boolean
  onToggleCount: () => void
  onExit: () => void
}

/** Fila de controles compacta de la partida en curso: nada de configuracion
 * editable aca, solo acciones sobre la partida ya en marcha. */
export function PlayInGameControls({
  onUndo,
  undoDisabled,
  onPass,
  passDisabled,
  showCount,
  onToggleCount,
  onExit,
}: PlayInGameControlsProps) {
  const { t } = useI18n()

  return (
    <div className="play-ingame-controls">
      <button type="button" onClick={onUndo} disabled={undoDisabled}>
        {t('play.undo')}
      </button>
      <button type="button" onClick={onPass} disabled={passDisabled}>
        {t('board.pass')}
      </button>
      <button type="button" aria-pressed={showCount} className={showCount ? 'active' : ''} onClick={onToggleCount}>
        {t('play.count.button')}
      </button>
      <button type="button" className="play-exit-button" onClick={onExit}>
        {t('play.exit')}
      </button>
    </div>
  )
}
