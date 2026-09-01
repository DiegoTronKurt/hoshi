/**
 * Temas de color de toda la app (chrome: fondo, tarjetas, texto, acento).
 * Distinto del sistema de temas de tablero existente en ../board/themes.ts,
 * que solo afecta los colores del SVG/canvas del tablero. Ambos conviven
 * como selectores separados en Ajustes.
 */
export interface AppThemeColors {
  bg: string
  surface: string
  surfaceAlt: string
  border: string
  borderStrong: string
  text: string
  textMuted: string
  textFaint: string
  accent: string
  accentContrast: string
}

export interface AppTheme {
  id: string
  scheme: 'light' | 'dark'
  colors: AppThemeColors
}

export const cremaTheme: AppTheme = {
  id: 'crema',
  scheme: 'light',
  colors: {
    bg: '#f2eee4',
    surface: '#ffffff',
    surfaceAlt: '#f7f3ea',
    border: '#d9d2c0',
    borderStrong: '#b8ac8e',
    text: '#1a1a1a',
    textMuted: '#5c584c',
    textFaint: '#8c8672',
    accent: '#8a5a2c',
    accentContrast: '#ffffff',
  },
}

export const piedraTheme: AppTheme = {
  id: 'piedra',
  scheme: 'light',
  colors: {
    bg: '#eceae6',
    surface: '#ffffff',
    surfaceAlt: '#f2f0ec',
    border: '#d3d0c8',
    borderStrong: '#b0aca2',
    text: '#232220',
    textMuted: '#5c5954',
    textFaint: '#8f8b83',
    accent: '#4a5d52',
    accentContrast: '#ffffff',
  },
}

export const bambuTheme: AppTheme = {
  id: 'bambu',
  scheme: 'light',
  colors: {
    bg: '#eef2e8',
    surface: '#ffffff',
    surfaceAlt: '#f3f6ee',
    border: '#cddabc',
    borderStrong: '#aac491',
    text: '#1e2417',
    textMuted: '#4d5645',
    textFaint: '#7c8871',
    accent: '#4a7c3f',
    accentContrast: '#ffffff',
  },
}

export const amanecerTheme: AppTheme = {
  id: 'amanecer',
  scheme: 'light',
  colors: {
    bg: '#fbeee2',
    surface: '#fffaf5',
    surfaceAlt: '#fdf3ea',
    border: '#eecdad',
    borderStrong: '#d9a76e',
    text: '#2a1e14',
    textMuted: '#5c4a3a',
    textFaint: '#8c7660',
    accent: '#c9752e',
    // Blanco sobre este acento da ~3.46:1, por debajo de AA (4.5:1) para
    // texto normal (queda marcado como pendiente de QA visual en el plan).
    // Texto oscuro sobre el mismo acento da ~4.69:1, que si pasa AA.
    accentContrast: '#2a1e14',
  },
}

export const nocheTheme: AppTheme = {
  id: 'noche',
  scheme: 'dark',
  colors: {
    bg: '#16140f',
    surface: '#262218',
    surfaceAlt: '#302b1e',
    border: '#55503f',
    borderStrong: '#6f6952',
    text: '#ececec',
    textMuted: '#bbbbbb',
    textFaint: '#999999',
    accent: '#c99a2e',
    accentContrast: '#1a1a1a',
  },
}

export const pizarraTheme: AppTheme = {
  id: 'pizarra',
  scheme: 'dark',
  colors: {
    bg: '#1a1e22',
    surface: '#262c31',
    surfaceAlt: '#20262b',
    border: '#3d454c',
    borderStrong: '#57616a',
    text: '#eceef0',
    textMuted: '#b7bec4',
    textFaint: '#8b939a',
    accent: '#5fa8d3',
    accentContrast: '#10171c',
  },
}

export const APP_THEMES: AppTheme[] = [cremaTheme, piedraTheme, bambuTheme, amanecerTheme, nocheTheme, pizarraTheme]

export type AppThemeId = (typeof APP_THEMES)[number]['id'] | 'system'

export function getAppTheme(id: string): AppTheme {
  return APP_THEMES.find((theme) => theme.id === id) ?? cremaTheme
}
