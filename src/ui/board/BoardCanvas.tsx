import { useCallback, useEffect, useRef } from 'react'
import { toPoint, toXY } from '../../core/board'
import { BLACK } from '../../core/types'
import { getHoshiPoints } from './hoshiPoints'
import type { BoardTheme } from './themes'

interface BoardCanvasProps {
  width: number
  height?: number
  stones: Int8Array
  lastMove: number | null
  /** Punto sugerido a resaltar (por ejemplo, la jugada correcta en un reporte de errores). No es una piedra. */
  hintMove?: number | null
  theme: BoardTheme
  onIntersectionClick: (point: number) => void
}

export function BoardCanvas({ width, height = width, stones, lastMove, hintMove = null, theme, onIntersectionClick }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef({ margin: 0, cell: 0 })

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
    for (let p = 0; p < stones.length; p++) {
      const value = stones[p]
      if (value === 0) continue
      const [x, y] = toXY(width, p)
      const cx = margin + x * cell
      const cy = margin + y * cell
      const style = value === BLACK ? theme.blackStone : theme.whiteStone

      if (style.dropShadow) {
        ctx.beginPath()
        ctx.ellipse(cx + stoneRadius * 0.12, cy + stoneRadius * 0.18, stoneRadius * 0.98, stoneRadius * 0.9, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.fill()
      }

      ctx.beginPath()
      ctx.arc(cx, cy, stoneRadius, 0, Math.PI * 2)
      if (style.highlight) {
        const gradient = ctx.createRadialGradient(
          cx - stoneRadius * 0.35,
          cy - stoneRadius * 0.4,
          stoneRadius * 0.05,
          cx,
          cy,
          stoneRadius,
        )
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
  }, [width, height, stones, lastMove, hintMove, theme])

  useEffect(() => {
    draw()
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => draw())
    observer.observe(container)
    return () => observer.disconnect()
  }, [draw])

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
