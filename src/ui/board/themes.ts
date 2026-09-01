export interface StoneStyle {
  fill: string
  stroke: string
  strokeWidth: number
  /** Color del brillo especular. Si falta, la piedra se rellena plana (p.ej. Sumi-e). */
  highlight?: string
  /** Si es true, se dibuja una sombra proyectada sutil debajo de la piedra. */
  dropShadow?: boolean
}

export interface BoardTheme {
  id: string
  background: string
  lines: { color: string; widthPx: number }
  hoshi: { color: string; radiusPx: number }
  blackStone: StoneStyle
  whiteStone: StoneStyle
  lastMoveMarker: { color: string }
  hintMarker: { color: string }
  coordinates: { color: string }
}

export const minimoTheme: BoardTheme = {
  id: 'minimo',
  background: '#ffffff',
  lines: { color: '#666666', widthPx: 1 },
  hoshi: { color: '#666666', radiusPx: 3 },
  blackStone: { fill: '#1a1a1a', stroke: '#000000', strokeWidth: 1, highlight: '#5a5a5a', dropShadow: true },
  whiteStone: { fill: '#f7f7f2', stroke: '#333333', strokeWidth: 1, highlight: '#ffffff', dropShadow: true },
  lastMoveMarker: { color: '#c0392b' },
  hintMarker: { color: '#2f6f9f' },
  coordinates: { color: '#999999' },
}

export const sumieTheme: BoardTheme = {
  id: 'sumie',
  background: '#ede6d3',
  lines: { color: '#4a4438', widthPx: 1 },
  hoshi: { color: '#4a4438', radiusPx: 3 },
  // Tinta plana a propósito, sin brillo ni sombra: es el carácter del tema.
  blackStone: { fill: '#1c1a15', stroke: '#0c0a08', strokeWidth: 1.5 },
  whiteStone: { fill: '#ede6d3', stroke: '#2a2620', strokeWidth: 2 },
  lastMoveMarker: { color: '#8a2e2e' },
  hintMarker: { color: '#2f5f6f' },
  coordinates: { color: '#7a715c' },
}

export const kayaTheme: BoardTheme = {
  id: 'kaya',
  background: '#e3b872',
  lines: { color: '#6b4a23', widthPx: 1 },
  hoshi: { color: '#6b4a23', radiusPx: 3.2 },
  blackStone: { fill: '#20201f', stroke: '#050505', strokeWidth: 1, highlight: '#6a6a68', dropShadow: true },
  whiteStone: { fill: '#faf3e2', stroke: '#c9a35a', strokeWidth: 1, highlight: '#ffffff', dropShadow: true },
  lastMoveMarker: { color: '#b23b2e' },
  hintMarker: { color: '#2f6f9f' },
  coordinates: { color: '#7a5a2c' },
}

export const nocturnoTheme: BoardTheme = {
  id: 'nocturno',
  background: '#050505',
  lines: { color: '#8a6a2a', widthPx: 1 },
  hoshi: { color: '#c99a3a', radiusPx: 3 },
  // Contorno con sombra pero sin brillo: silueta, no gloss.
  blackStone: { fill: '#161616', stroke: '#8a6a2a', strokeWidth: 1.5, dropShadow: true },
  whiteStone: { fill: '#e8e2d0', stroke: '#8a6a2a', strokeWidth: 1.5, dropShadow: true },
  lastMoveMarker: { color: '#e0562f' },
  hintMarker: { color: '#4fa3d1' },
  coordinates: { color: '#8a6a2a' },
}

export const BOARD_THEMES: BoardTheme[] = [minimoTheme, sumieTheme, kayaTheme, nocturnoTheme]

export type BoardThemeId = (typeof BOARD_THEMES)[number]['id']

export function getTheme(id: string): BoardTheme {
  return BOARD_THEMES.find((theme) => theme.id === id) ?? minimoTheme
}
