import { useI18n } from '../../i18n'

interface PlayInGameControlsProps {
  onUndo: () => void
  undoDisabled: boolean
  onPass: () => void
  passDisabled: boolean
  showCount: boolean
  onToggleCount: () => void
  onExit: () => void
  /** Si esta partida ofrece la pista de red (elegido en Configurar partida) --
   * cuando es false, el boton ni se muestra, no solo se deshabilita. */
  hintVisible: boolean
  onHint: () => void
  hintDisabled: boolean
  hintsRemaining: number
  hintLoading: boolean
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
  hintVisible,
  onHint,
  hintDisabled,
  hintsRemaining,
  hintLoading,
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
      {hintVisible && (
        <button type="button" onClick={onHint} disabled={hintDisabled}>
          {hintLoading ? t('play.hint.loading') : t('play.hint.button', { remaining: hintsRemaining })}
        </button>
      )}
      <button type="button" className="play-exit-button" onClick={onExit}>
        {t('play.exit')}
      </button>
    </div>
  )
}
