export interface StoneStyle {
  fill: string
  stroke: string
  strokeWidth: number
}

export interface BoardTheme {
  id: string
  background: string
  lines: { color: string; widthPx: number }
  hoshi: { color: string; radiusPx: number }
  blackStone: StoneStyle
  whiteStone: StoneStyle
  lastMoveMarker: { color: string }
  coordinates: { color: string }
}

export const minimoTheme: BoardTheme = {
  id: 'minimo',
  background: '#ffffff',
  lines: { color: '#666666', widthPx: 1 },
  hoshi: { color: '#666666', radiusPx: 3 },
  blackStone: { fill: '#1a1a1a', stroke: '#000000', strokeWidth: 1 },
  whiteStone: { fill: '#f7f7f2', stroke: '#333333', strokeWidth: 1 },
  lastMoveMarker: { color: '#c0392b' },
  coordinates: { color: '#999999' },
}
