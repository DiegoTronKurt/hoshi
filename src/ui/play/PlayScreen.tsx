import { useState } from 'react'
import { BLACK } from '../../core/types'
import { PlayConfigScreen } from './PlayConfigScreen'
import { PlayGameScreen } from './PlayGameScreen'
import type { PlayConfig, PlaySeed } from './playConfig'

type PlayView = { kind: 'config' } | { kind: 'game'; config: PlayConfig }

interface PlayScreenProps {
  onGameActiveChange: (active: boolean) => void
  onNavigateToToday: () => void
  onNavigateToReview: (gameId: number) => void
  /** Posicion de arranque (partida de comprobacion de una leccion): si viene
   * seteada, esta pantalla salta directo a la partida en modo local con esa
   * posicion en vez de mostrar la pantalla de configuracion. */
  initialSeed?: PlaySeed
}

function seededConfig(seed: PlaySeed): PlayConfig {
  return {
    size: seed.size,
    mode: 'local',
    strengthId: 'normal',
    botStyle: 'standard',
    humanColor: BLACK,
    initialStones: seed.stones,
    initialToMove: seed.toMove,
  }
}

/**
 * Router chico de la pestana Jugar, mismo patron que LearnScreen: pantalla
 * de configuracion (formulario) y pantalla de partida en curso (tablero, sin
 * nada de eso editable) son dos vistas separadas, nunca mezcladas.
 */
export function PlayScreen({ onGameActiveChange, onNavigateToToday, onNavigateToReview, initialSeed }: PlayScreenProps) {
  const [view, setView] = useState<PlayView>(() =>
    initialSeed ? { kind: 'game', config: seededConfig(initialSeed) } : { kind: 'config' },
  )

  if (view.kind === 'config') {
    return <PlayConfigScreen onStart={(config) => setView({ kind: 'game', config })} />
  }

  return (
    <PlayGameScreen
      config={view.config}
      onExitToConfig={() => setView({ kind: 'config' })}
      onNavigateToToday={onNavigateToToday}
      onNavigateToReview={onNavigateToReview}
      onActiveChange={onGameActiveChange}
    />
  )
}
