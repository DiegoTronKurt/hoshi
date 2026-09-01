/**
 * Iconos de la barra de navegacion inferior. Dibujados a mano en SVG,
 * stroke="currentColor" para heredar el color via CSS (`.bottom-nav
 * button.active`), sin libreria de iconos externa -- mismo patron sin
 * dependencias que RadarChart.tsx.
 */
interface IconProps {
  className?: string
}

const COMMON = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Hoy: check dentro de un circulo. */
export function TodayIcon({ className }: IconProps) {
  return (
    <svg {...COMMON} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  )
}

/** Aprender: libro abierto. */
export function LearnIcon({ className }: IconProps) {
  return (
    <svg {...COMMON} className={className} aria-hidden="true">
      <path d="M12 6.5c-1.4-1.1-3.4-1.6-5.5-1.6-.6 0-1 .4-1 1v11c0 .6.4 1 1 1 2.1 0 4.1.5 5.5 1.6" />
      <path d="M12 6.5c1.4-1.1 3.4-1.6 5.5-1.6.6 0 1 .4 1 1v11c0 .6-.4 1-1 1-2.1 0-4.1.5-5.5 1.6" />
      <path d="M12 6.5v13" />
    </svg>
  )
}

/** Jugar: dos piedras go superpuestas, una rellena y una contorno. */
export function PlayIcon({ className }: IconProps) {
  return (
    <svg {...COMMON} className={className} aria-hidden="true">
      <circle cx="9.5" cy="10" r="6" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="15" r="6" />
    </svg>
  )
}

/** Ejercicios: circulos concentricos con punto central. */
export function ExercisesIcon({ className }: IconProps) {
  return (
    <svg {...COMMON} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Revisar: lupa con una grilla 2x2 dentro. */
export function ReviewIcon({ className }: IconProps) {
  return (
    <svg {...COMMON} className={className} aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.3 15.3L20 20" />
      <path d="M10.5 7v7M7 10.5h7" />
    </svg>
  )
}

/** Perfil: silueta de una persona. */
export function ProfileIcon({ className }: IconProps) {
  return (
    <svg {...COMMON} className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" />
    </svg>
  )
}
