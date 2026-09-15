import { useCallback, useEffect, useRef, useState } from 'react'
import { toPoint, toXY } from '../../core/board'
import { BLACK, EMPTY } from '../../core/types'
import type { Color } from '../../core/types'
import { getHoshiPoints } from './hoshiPoints'
import type { BoardTheme } from './themes'

/** Cache a nivel de modulo: los temas son assets estaticos del bundle, nunca
 * cambian en caliente, asi que basta con decodificar cada imagen una sola
 * vez aunque el usuario alterne entre temas repetidas veces. */
const textureImageCache = new Map<string, HTMLImageElement>()

function useTextureImage(src: string | undefined): HTMLImageElement | null {
  const [, forceRedraw] = useState(0)
  useEffect(() => {
    if (!src || textureImageCache.has(src)) return
    const img = new Image()
    img.onload = () => {
      textureImageCache.set(src, img)
      forceRedraw((n) => n + 1)
    }
    img.src = src
  }, [src])
  return src ? (textureImageCache.get(src) ?? null) : null
}

interface WrongFlashProp {
  point: number
  id: number
}

interface CapturedFlashProp {
  points: number[]
  color: Color
  id: number
}

interface BoardCanvasProps {
  width: number
  height?: number
  stones: Int8Array
  lastMove: number | null
  /** Punto sugerido a resaltar (por ejemplo, la jugada correcta en un reporte de errores). No es una piedra. */
  hintMove?: number | null
  /** Ultimo clic incorrecto en un ejercicio, para un destello breve en ese
   * punto. `id` (no `point`) es lo que dispara la animacion -- clickear el
   * mismo punto invalido dos veces seguidas debe destellar las dos veces. */
  wrongFlash?: WrongFlashProp | null
  /** Piedras recien capturadas (jugador o bot), para un desvanecido breve en
   * PlayGameScreen -- opt-in via settings.captureAnimationEnabled, por eso
   * PlayGameScreen solo pasa esto cuando la preferencia esta activada; el
   * resto de los ~17 usos de BoardCanvas nunca lo pasan y no cambian en
   * nada. `id` (no el contenido de `points`) dispara la animacion, igual
   * que wrongFlash -- deshacer y repetir la misma captura debe volver a
   * animar. */
  capturedFlash?: CapturedFlashProp | null
  /** Dueño final de cada punto (BLACK/WHITE/EMPTY para neutral), solo al
   * terminar la partida -- ver core/scoring.ts::computeAreaOwnership. Al
   * pasar de ausente a presente dispara la animacion de revelado; mientras
   * la referencia no cambie no se repite. */
  territory?: Int8Array | null
  theme: BoardTheme
  /** Letras de columna (A-T, salteando la I por convencion) y numeros de
   * fila (1 abajo, creciendo hacia arriba) dibujados en el margen ya
   * existente alrededor de la rejilla -- no agranda el canvas. Preferencia
   * de Ajustes (settings.coordinatesEnabled), default false: no todo el
   * mundo quiere el ruido visual extra, y en miniaturas pequenas (72-88px)
   * el texto no alcanza a leerse -- esos usos de BoardCanvas simplemente no
   * pasan esta prop. */
  coordinatesEnabled?: boolean
  /** Multiplicador sobre el grosor de linea de rejilla base de cada tema.
   * Default 1 (sin cambio para los usos que no lo pasan). */
  lineWidthMultiplier?: number
  onIntersectionClick: (point: number) => void
}

/** Notacion Go estandar: sin "I" para no confundirla con el numero 1. */
const COLUMN_LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'

/** Duracion del asentado de una piedra recien jugada. Diseno original
 * (roadmap), implementado aca porque el tablero es canvas, no DOM: no hay
 * transicion CSS posible, cada cuadro se redibuja a mano via rAF. */
const STONE_SETTLE_MS = 120
const CAPTURE_FLASH_MS = 350
const TERRITORY_REVEAL_MS = 450
const WRONG_FLASH_MS = 500

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

export function BoardCanvas({
  width,
  height = width,
  stones,
  lastMove,
  hintMove = null,
  wrongFlash = null,
  capturedFlash = null,
  territory = null,
  theme,
  coordinatesEnabled = false,
  lineWidthMultiplier = 1,
  onIntersectionClick,
}: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef({ margin: 0, cell: 0 })
  const textureImage = useTextureImage(theme.backgroundTexture?.src)

  const prevLastMoveRef = useRef(lastMove)
  const prevTerritoryRef = useRef(territory)
  const prevWrongFlashRef = useRef(wrongFlash)
  const prevCapturedFlashRef = useRef(capturedFlash)
  const stoneAnimRef = useRef<{ point: number; start: number } | null>(null)
  const territoryAnimRef = useRef<{ start: number } | null>(null)
  const wrongAnimRef = useRef<{ point: number; start: number } | null>(null)
  const captureAnimRef = useRef<{ points: number[]; color: Color; start: number } | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const displayWidth = container.clientWidth
    // La celda es cuadrada (para que las piedras no salgan ovaladas) y se
    // deriva del ancho disponible, igual que antes para un tablero cuadrado;
    // el alto sale de la misma celda aplicada al numero de filas, asi que un
    // tablero rectangular como el 9x13 de Forma queda mas alto que ancho en
    // vez de estirado.
    const cell = displayWidth / (width + 1)
    const margin = cell
    const displayHeight = (height - 1) * cell + margin * 2
    const dpr = window.devicePixelRatio || 1
    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
    canvas.style.width = `${displayWidth}px`
    canvas.style.height = `${displayHeight}px`

    layoutRef.current = { margin, cell }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const backgroundTexture = theme.backgroundTexture
    const pattern = backgroundTexture && textureImage ? ctx.createPattern(textureImage, 'repeat') : null
    if (pattern && backgroundTexture && textureImage) {
      // La imagen se genera al doble de tileSizePx (nitidez en pantallas de
      // alta densidad, ver themes.ts); este escalado hace que el patron
      // repita cada tileSizePx unidades de espacio de usuario (px CSS, dado
      // el setTransform de mas arriba) en vez de a la resolucion nativa del
      // bitmap, sin importar el devicePixelRatio real de la pantalla.
      const scale = backgroundTexture.tileSizePx / textureImage.naturalWidth
      pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, 0, 0]))
    }
    ctx.fillStyle = pattern ?? theme.background
    ctx.fillRect(0, 0, displayWidth, displayHeight)

    ctx.strokeStyle = theme.lines.color
    ctx.lineWidth = theme.lines.widthPx * lineWidthMultiplier
    for (let x = 0; x < width; x++) {
      const pos = margin + x * cell
      ctx.beginPath()
      ctx.moveTo(pos, margin)
      ctx.lineTo(pos, margin + (height - 1) * cell)
      ctx.stroke()
    }
    for (let y = 0; y < height; y++) {
      const pos = margin + y * cell
      ctx.beginPath()
      ctx.moveTo(margin, pos)
      ctx.lineTo(margin + (width - 1) * cell, pos)
      ctx.stroke()
    }

    ctx.fillStyle = theme.hoshi.color
    for (const point of getHoshiPoints(width, height)) {
      const [x, y] = toXY(width, point)
      ctx.beginPath()
      ctx.arc(margin + x * cell, margin + y * cell, theme.hoshi.radiusPx, 0, Math.PI * 2)
      ctx.fill()
    }

    if (coordinatesEnabled) {
      const fontSize = Math.max(9, Math.min(13, cell * 0.28))
      ctx.fillStyle = theme.coordinates.color
      ctx.font = `${fontSize}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const columnLabelY = margin + (height - 1) * cell + margin / 2
      for (let x = 0; x < width; x++) {
        ctx.fillText(COLUMN_LETTERS[x] ?? '', margin + x * cell, columnLabelY)
      }
      const rowLabelX = margin / 2
      for (let y = 0; y < height; y++) {
        ctx.fillText(String(height - y), rowLabelX, margin + y * cell)
      }
    }

    const stoneRadius = cell * 0.46

    if (territory) {
      const revealProgress = territoryAnimRef.current
        ? easeOutCubic(Math.min(1, (performance.now() - territoryAnimRef.current.start) / TERRITORY_REVEAL_MS))
        : 1
      const markerHalf = cell * 0.26 * revealProgress
      if (markerHalf > 0.1) {
        ctx.globalAlpha = 0.45 * revealProgress
        for (let p = 0; p < territory.length; p++) {
          const owner = territory[p]
          if (owner === EMPTY || stones[p] !== EMPTY) continue
          const [x, y] = toXY(width, p)
          const cx = margin + x * cell
          const cy = margin + y * cell
          ctx.fillStyle = owner === BLACK ? theme.blackStone.fill : theme.whiteStone.fill
          ctx.fillRect(cx - markerHalf, cy - markerHalf, markerHalf * 2, markerHalf * 2)
        }
        ctx.globalAlpha = 1
      }
    }

    for (let p = 0; p < stones.length; p++) {
      const value = stones[p]
      if (value === 0) continue
      const [x, y] = toXY(width, p)
      const cx = margin + x * cell
      const cy = margin + y * cell
      const style = value === BLACK ? theme.blackStone : theme.whiteStone

      let radius = stoneRadius
      let alpha = 1
      if (stoneAnimRef.current && stoneAnimRef.current.point === p) {
        const progress = easeOutCubic(Math.min(1, (performance.now() - stoneAnimRef.current.start) / STONE_SETTLE_MS))
        radius = stoneRadius * (0.55 + 0.45 * progress)
        alpha = 0.4 + 0.6 * progress
      }
      ctx.globalAlpha = alpha

      if (style.dropShadow) {
        ctx.beginPath()
        ctx.ellipse(cx + radius * 0.12, cy + radius * 0.18, radius * 0.98, radius * 0.9, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.fill()
      }

      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      if (style.highlight) {
        const gradient = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.4, radius * 0.05, cx, cy, radius)
        gradient.addColorStop(0, style.highlight)
        gradient.addColorStop(1, style.fill)
        ctx.fillStyle = gradient
      } else {
        ctx.fillStyle = style.fill
      }
      ctx.fill()
      ctx.lineWidth = style.strokeWidth
      ctx.strokeStyle = style.stroke
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    if (captureAnimRef.current) {
      const progress = Math.min(1, (performance.now() - captureAnimRef.current.start) / CAPTURE_FLASH_MS)
      const alpha = 1 - easeOutCubic(progress)
      if (alpha > 0.02) {
        const style = captureAnimRef.current.color === BLACK ? theme.blackStone : theme.whiteStone
        ctx.globalAlpha = alpha
        for (const point of captureAnimRef.current.points) {
          const [x, y] = toXY(width, point)
          const cx = margin + x * cell
          const cy = margin + y * cell
          ctx.beginPath()
          ctx.arc(cx, cy, stoneRadius, 0, Math.PI * 2)
          ctx.fillStyle = style.fill
          ctx.fill()
          ctx.lineWidth = style.strokeWidth
          ctx.strokeStyle = style.stroke
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }
    }

    if (lastMove !== null) {
      const [x, y] = toXY(width, lastMove)
      ctx.beginPath()
      ctx.arc(margin + x * cell, margin + y * cell, stoneRadius * 0.28, 0, Math.PI * 2)
      ctx.fillStyle = theme.lastMoveMarker.color
      ctx.fill()
    }

    if (hintMove !== null) {
      const [x, y] = toXY(width, hintMove)
      ctx.beginPath()
      ctx.arc(margin + x * cell, margin + y * cell, stoneRadius * 0.55, 0, Math.PI * 2)
      ctx.lineWidth = 2
      ctx.strokeStyle = theme.hintMarker.color
      ctx.stroke()
    }

    if (wrongAnimRef.current) {
      const progress = Math.min(1, (performance.now() - wrongAnimRef.current.start) / WRONG_FLASH_MS)
      const alpha = 1 - easeOutCubic(progress)
      if (alpha > 0.02) {
        const [x, y] = toXY(width, wrongAnimRef.current.point)
        ctx.beginPath()
        ctx.arc(margin + x * cell, margin + y * cell, stoneRadius * 0.7, 0, Math.PI * 2)
        ctx.globalAlpha = alpha
        ctx.lineWidth = 3
        ctx.strokeStyle = theme.lastMoveMarker.color
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
  }, [
    width,
    height,
    stones,
    lastMove,
    hintMove,
    territory,
    theme,
    textureImage,
    coordinatesEnabled,
    lineWidthMultiplier,
  ])

  useEffect(() => {
    if (lastMove !== null && lastMove !== prevLastMoveRef.current && stones[lastMove] !== EMPTY) {
      stoneAnimRef.current = { point: lastMove, start: performance.now() }
    }
    prevLastMoveRef.current = lastMove

    if (territory && territory !== prevTerritoryRef.current) {
      territoryAnimRef.current = { start: performance.now() }
    }
    prevTerritoryRef.current = territory

    if (wrongFlash && wrongFlash !== prevWrongFlashRef.current) {
      wrongAnimRef.current = { point: wrongFlash.point, start: performance.now() }
    }
    prevWrongFlashRef.current = wrongFlash

    if (capturedFlash && capturedFlash !== prevCapturedFlashRef.current) {
      captureAnimRef.current = { points: capturedFlash.points, color: capturedFlash.color, start: performance.now() }
    }
    prevCapturedFlashRef.current = capturedFlash

    let rafId: number | null = null
    function tick() {
      draw()
      if (stoneAnimRef.current && performance.now() - stoneAnimRef.current.start >= STONE_SETTLE_MS) {
        stoneAnimRef.current = null
      }
      if (territoryAnimRef.current && performance.now() - territoryAnimRef.current.start >= TERRITORY_REVEAL_MS) {
        territoryAnimRef.current = null
      }
      if (wrongAnimRef.current && performance.now() - wrongAnimRef.current.start >= WRONG_FLASH_MS) {
        wrongAnimRef.current = null
      }
      if (captureAnimRef.current && performance.now() - captureAnimRef.current.start >= CAPTURE_FLASH_MS) {
        captureAnimRef.current = null
      }
      rafId =
        stoneAnimRef.current || territoryAnimRef.current || wrongAnimRef.current || captureAnimRef.current
          ? requestAnimationFrame(tick)
          : null
    }

    if (stoneAnimRef.current || territoryAnimRef.current || wrongAnimRef.current || captureAnimRef.current) {
      rafId = requestAnimationFrame(tick)
    } else {
      draw()
    }

    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => draw())
    observer.observe(container)
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [draw, lastMove, stones, territory, wrongFlash, capturedFlash])

  function handleClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const { margin, cell } = layoutRef.current
    const clickX = event.clientX - rect.left
    const clickY = event.clientY - rect.top

    const x = Math.round((clickX - margin) / cell)
    const y = Math.round((clickY - margin) / cell)
    if (x < 0 || y < 0 || x >= width || y >= height) return

    const targetX = margin + x * cell
    const targetY = margin + y * cell
    const distance = Math.hypot(clickX - targetX, clickY - targetY)
    if (distance > cell / 2) return

    onIntersectionClick(toPoint(width, x, y))
  }

  return (
    <div ref={containerRef} className="board-container">
      <canvas ref={canvasRef} onClick={handleClick} role="img" />
    </div>
  )
}
