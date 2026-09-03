import { useCallback, useEffect, useRef } from 'react'
import { toPoint, toXY } from '../../core/board'
import { BLACK, EMPTY } from '../../core/types'
import { getHoshiPoints } from './hoshiPoints'
import type { BoardTheme } from './themes'

interface BoardCanvasProps {
  width: number
  height?: number
  stones: Int8Array
  lastMove: number | null
  /** Punto sugerido a resaltar (por ejemplo, la jugada correcta en un reporte de errores). No es una piedra. */
  hintMove?: number | null
  /** Dueño final de cada punto (BLACK/WHITE/EMPTY para neutral), solo al
   * terminar la partida -- ver core/scoring.ts::computeAreaOwnership. Al
   * pasar de ausente a presente dispara la animacion de revelado; mientras
   * la referencia no cambie no se repite. */
  territory?: Int8Array | null
  theme: BoardTheme
  onIntersectionClick: (point: number) => void
}

/** Duracion del asentado de una piedra recien jugada. Diseno original
 * (roadmap), implementado aca porque el tablero es canvas, no DOM: no hay
 * transicion CSS posible, cada cuadro se redibuja a mano via rAF. */
const STONE_SETTLE_MS = 120
const TERRITORY_REVEAL_MS = 450

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

export function BoardCanvas({
  width,
  height = width,
  stones,
  lastMove,
  hintMove = null,
  territory = null,
  theme,
  onIntersectionClick,
}: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef({ margin: 0, cell: 0 })

  const prevLastMoveRef = useRef(lastMove)
  const prevTerritoryRef = useRef(territory)
  const stoneAnimRef = useRef<{ point: number; start: number } | null>(null)
  const territoryAnimRef = useRef<{ start: number } | null>(null)

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

    ctx.fillStyle = theme.background
    ctx.fillRect(0, 0, displayWidth, displayHeight)

    ctx.strokeStyle = theme.lines.color
    ctx.lineWidth = theme.lines.widthPx
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
  }, [width, height, stones, lastMove, hintMove, territory, theme])

  useEffect(() => {
    if (lastMove !== null && lastMove !== prevLastMoveRef.current && stones[lastMove] !== EMPTY) {
      stoneAnimRef.current = { point: lastMove, start: performance.now() }
    }
    prevLastMoveRef.current = lastMove

    if (territory && territory !== prevTerritoryRef.current) {
      territoryAnimRef.current = { start: performance.now() }
    }
    prevTerritoryRef.current = territory

    let rafId: number | null = null
    function tick() {
      draw()
      if (stoneAnimRef.current && performance.now() - stoneAnimRef.current.start >= STONE_SETTLE_MS) {
        stoneAnimRef.current = null
      }
      if (territoryAnimRef.current && performance.now() - territoryAnimRef.current.start >= TERRITORY_REVEAL_MS) {
        territoryAnimRef.current = null
      }
      rafId = stoneAnimRef.current || territoryAnimRef.current ? requestAnimationFrame(tick) : null
    }

    if (stoneAnimRef.current || territoryAnimRef.current) {
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
  }, [draw, lastMove, stones, territory])

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
