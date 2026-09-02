const SIZE = 40
const STROKE = 4
const RADIUS = SIZE / 2 - STROKE / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface ProgressRingProps {
  /** 0 a 100. */
  percent: number
  label: string
}

/** Anillo de progreso chico a mano, sin libreria: para el porcentaje de
 * lecciones completadas del nivel actual (roadmap: progreso de contenido,
 * nunca una racha). */
export function ProgressRing({ percent, label }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const offset = CIRCUMFERENCE * (1 - clamped / 100)

  return (
    <div className="progress-ring" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE}>
        <circle className="progress-ring-track" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE} fill="none" />
        <circle
          className="progress-ring-value"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <span className="progress-ring-text">{Math.round(clamped)}%</span>
    </div>
  )
}
