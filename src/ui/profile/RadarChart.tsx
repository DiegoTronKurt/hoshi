const SIZE = 240
const CENTER = SIZE / 2
const MAX_RADIUS = SIZE / 2 - 44
const RINGS = [25, 50, 75, 100]

export interface RadarAxisDatum {
  id: string
  label: string
  score: number | null
}

interface RadarChartProps {
  axes: RadarAxisDatum[]
  noDataLabel: string
}

function pointOnAxis(index: number, count: number, radius: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) }
}

function polygonPoints(values: number[]): string {
  return values
    .map((value, index) => {
      const { x, y } = pointOnAxis(index, values.length, (value / 100) * MAX_RADIUS)
      return `${x},${y}`
    })
    .join(' ')
}

/** Radar de 6 ejes (o los que se pasen). Los ejes sin datos todavia se
 * grafican en el centro (valor 0) y se marcan con un punto hueco, en vez de
 * ocultarse, para que la forma del poligono se pueda comparar de una sesion
 * a otra sin que cambie de forma solo porque un eje empezo a tener datos. */
export function RadarChart({ axes, noDataLabel }: RadarChartProps) {
  const values = axes.map((a) => a.score ?? 0)

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="radar-chart" role="img" aria-label={axes.map((a) => `${a.label}: ${a.score === null ? noDataLabel : Math.round(a.score) + '%'}`).join(', ')}>
      {RINGS.map((ring) => (
        <polygon
          key={ring}
          className="radar-grid-ring"
          points={polygonPoints(axes.map(() => ring))}
        />
      ))}

      {axes.map((_, index) => {
        const outer = pointOnAxis(index, axes.length, MAX_RADIUS)
        return <line key={index} className="radar-grid-line" x1={CENTER} y1={CENTER} x2={outer.x} y2={outer.y} />
      })}

      <polygon className="radar-fill" points={polygonPoints(values)} />

      {axes.map((axis, index) => {
        const point = pointOnAxis(index, axes.length, (values[index] / 100) * MAX_RADIUS)
        return (
          <circle
            key={axis.id}
            className={axis.score === null ? 'radar-vertex radar-vertex-empty' : 'radar-vertex'}
            cx={point.x}
            cy={point.y}
            r={4}
          />
        )
      })}

      {axes.map((axis, index) => {
        const label = pointOnAxis(index, axes.length, MAX_RADIUS + 24)
        return (
          <text key={axis.id} className="radar-label" x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">
            {axis.label}
          </text>
        )
      })}
    </svg>
  )
}
