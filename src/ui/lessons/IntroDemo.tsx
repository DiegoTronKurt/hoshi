import { useEffect, useState } from 'react'
import { createBoard, toPoint } from '../../core/board'
import { computeAreaOwnership } from '../../core/scoring'
import { BLACK, WHITE } from '../../core/types'
import type { BoardState } from '../../core/types'
import { useI18n } from '../../i18n'
import { BoardCanvas } from '../board/BoardCanvas'
import { minimoTheme } from '../board/themes'

const SIZE = 7
/** ~12 segundos: bastante para leer el titulo y ver el revelado de
 * territorio, poco para aburrir a alguien que solo quiere tocar el tablero
 * -- por eso ademas hay un boton "Continuar" visible desde el arranque, no
 * hace falta esperar el auto-avance para seguir. */
const AUTO_ADVANCE_MS = 12000
/** Respiro antes de calcular el territorio: BoardCanvas dispara su
 * animacion de revelado (450ms) al ver la referencia de `territory` pasar
 * de ausente a presente -- calcularlo ya en el primer render lo dejaria
 * coloreado desde el primer cuadro, sin nada que "revelar". */
const REVEAL_DELAY_MS = 300

/**
 * Posicion ya terminada y asentada a proposito (sin capturas ni fronteras
 * ambiguas): un muro de Negro en x=4 pegado a un muro de Blanco en x=5 (dos
 * columnas de piedras en contacto directo, sin ningun punto vacio entre
 * ellas), asi que cada region vacia restante toca solo un color -- Negro
 * (columnas 0-3) mucho mas grande que Blanco (columna 6), para que "ganar"
 * se vea como una diferencia de area clara, no un margen ajustado.
 */
function demoBoard(): BoardState {
  const board = createBoard(SIZE)
  for (let y = 0; y < SIZE; y++) {
    board.stones[toPoint(SIZE, 4, y)] = BLACK
    board.stones[toPoint(SIZE, 5, y)] = WHITE
  }
  return board
}

const DEMO_BOARD = demoBoard()

interface IntroDemoProps {
  onContinue: () => void
}

/**
 * Demo visual muy corta antes de n0-l1 (LearnScreen.tsx): una partida chica
 * ya terminada con el territorio coloreado, para que "ganar" se sienta
 * concreto desde el segundo cero, antes de tocar nada. No interactiva a
 * proposito (a diferencia de GuidedDemo.tsx, que ensena una jugada) -- aca
 * no hay nada que aprender a jugar, solo algo que ver.
 */
export function IntroDemo({ onContinue }: IntroDemoProps) {
  const { t } = useI18n()
  const [territory, setTerritory] = useState<Int8Array | null>(null)

  useEffect(() => {
    const revealTimer = window.setTimeout(() => setTerritory(computeAreaOwnership(DEMO_BOARD)), REVEAL_DELAY_MS)
    const advanceTimer = window.setTimeout(onContinue, AUTO_ADVANCE_MS)
    return () => {
      window.clearTimeout(revealTimer)
      window.clearTimeout(advanceTimer)
    }
  }, [onContinue])

  return (
    <div className="learn-intro-demo">
      <h2>{t('learn.introDemo.title')}</h2>
      <p className="learn-intro-demo-body">{t('learn.introDemo.body')}</p>
      <BoardCanvas
        width={SIZE}
        stones={DEMO_BOARD.stones}
        lastMove={null}
        territory={territory}
        theme={minimoTheme}
        onIntersectionClick={() => {}}
      />
      <button type="button" className="learn-intro-demo-continue" onClick={onContinue}>
        {t('learn.introDemo.continue')}
      </button>
    </div>
  )
}
