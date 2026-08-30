import { useCallback, useEffect, useRef } from 'react'
import { toPoint, toXY } from '../../core/board'
import { BLACK } from '../../core/types'
import { getHoshiPoints } from './hoshiPoints'
import type { BoardTheme } from './themes'

interface BoardCanvasProps {
  size: number
  stones: Int8Array
  lastMove: number | null
  theme: BoardTheme
  onIntersectionClick: (point: number) => void
}

export function BoardCanvas({ size, stones, lastMove, theme, onIntersectionClick }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef({ displaySize: 0, margin: 0, cell: 0 })

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const displaySize = container.clientWidth
    const dpr = window.devicePixelRatio || 1
    canvas.width = displaySize * dpr
    canvas.height = displaySize * dpr
    canvas.style.width = `${displaySize}px`
    canvas.style.height = `${displaySize}px`

    const margin = displaySize / (size + 1)
    const cell = (displaySize - margin * 2) / (size - 1)
    layoutRef.current = { displaySize, margin, cell }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = theme.background
    ctx.fillRect(0, 0, displaySize, displaySize)

    ctx.strokeStyle = theme.lines.color
    ctx.lineWidth = theme.lines.widthPx
    for (let i = 0; i < size; i++) {
      const pos = margin + i * cell
      ctx.beginPath()
      ctx.moveTo(margin, pos)
      ctx.lineTo(margin + (size - 1) * cell, pos)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(pos, margin)
      ctx.lineTo(pos, margin + (size - 1) * cell)
      ctx.stroke()
    }

    ctx.fillStyle = theme.hoshi.color
    for (const point of getHoshiPoints(size)) {
      const [x, y] = toXY(size, point)
      ctx.beginPath()
      ctx.arc(margin + x * cell, margin + y * cell, theme.hoshi.radiusPx, 0, Math.PI * 2)
      ctx.fill()
    }

    const stoneRadius = cell * 0.46
    for (let p = 0; p < stones.length; p++) {
      const value = stones[p]
      if (value === 0) continue
      const [x, y] = toXY(size, p)
      const cx = margin + x * cell
      const cy = margin + y * cell
      const style = value === BLACK ? theme.blackStone : theme.whiteStone
      ctx.beginPath()
      ctx.arc(cx, cy, stoneRadius, 0, Math.PI * 2)
      ctx.fillStyle = style.fill
      ctx.fill()
      ctx.lineWidth = style.strokeWidth
      ctx.strokeStyle = style.stroke
      ctx.stroke()
    }

    if (lastMove !== null) {
      const [x, y] = toXY(size, lastMove)
      ctx.beginPath()
      ctx.arc(margin + x * cell, margin + y * cell, stoneRadius * 0.28, 0, Math.PI * 2)
      ctx.fillStyle = theme.lastMoveMarker.color
      ctx.fill()
    }
  }, [size, stones, lastMove, theme])

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
    if (x < 0 || y < 0 || x >= size || y >= size) return

    const targetX = margin + x * cell
    const targetY = margin + y * cell
    const distance = Math.hypot(clickX - targetX, clickY - targetY)
    if (distance > cell / 2) return

    onIntersectionClick(toPoint(size, x, y))
  }

  return (
    <div ref={containerRef} className="board-container">
      <canvas ref={canvasRef} onClick={handleClick} role="img" />
    </div>
  )
}
