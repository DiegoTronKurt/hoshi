import type { WinRatePoint } from './fullGameReview'

const WIDTH = 640
const HEIGHT = 180
const PAD_LEFT = 30
const PAD_RIGHT = 8
const PAD_TOP = 10
const PAD_BOTTOM = 18

interface WinRateChartProps {
  curve: WinRatePoint[]
  /** Numeros de jugada (mismo indexado que WinRatePoint.moveNumber) a marcar
   * con un punto sobre la curva -- pensado para las jugadas que aparecen en
   * la lista de mayores caidas, no una seleccion cualquiera. */
  highlightMoveNumbers: number[]
  blackLabel: string
  whiteLabel: string
  ariaLabel: string
}

/** Grafico de linea de la probabilidad de victoria de NEGRO a lo largo de
 * toda la partida (ver summarizeWinRates en fullGameReview.ts para la
 * perspectiva fija). Mismo patron que RadarChart.tsx: SVG puro, estilos en
 * App.css via clases, sin libreria de graficos -- una sola linea con eje
 * fijo [0,100] no la necesita. */
export function WinRateChart({ curve, highlightMoveNumbers, blackLabel, whiteLabel, ariaLabel }: WinRateChartProps) {
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const lastMove = Math.max(1, curve.length - 1)

  function xFor(moveNumber: number): number {
    return PAD_LEFT + (moveNumber / lastMove) * plotWidth
  }
  function yFor(probability: number): number {
    return PAD_TOP + (1 - probability) * plotHeight
  }

  const linePoints = curve.map((p) => `${xFor(p.moveNumber)},${yFor(p.blackWinProbability)}`).join(' ')
  const areaPoints = `${xFor(0)},${yFor(0)} ${linePoints} ${xFor(curve[curve.length - 1]?.moveNumber ?? 0)},${yFor(0)}`

  const highlightSet = new Set(highlightMoveNumbers)
  const highlightedPoints = curve.filter((p) => highlightSet.has(p.moveNumber))

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="winrate-chart" role="img" aria-label={ariaLabel}>
      <line className="winrate-grid-line" x1={PAD_LEFT} y1={yFor(0.5)} x2={WIDTH - PAD_RIGHT} y2={yFor(0.5)} />

      <polygon className="winrate-fill" points={areaPoints} />
      <polyline className="winrate-line" points={linePoints} />

      {highlightedPoints.map((p) => (
        <circle key={p.moveNumber} className="winrate-swing-dot" cx={xFor(p.moveNumber)} cy={yFor(p.blackWinProbability)} r={3.5} />
      ))}

      <text className="winrate-side-label" x={2} y={PAD_TOP + 8}>
        {blackLabel}
      </text>
      <text className="winrate-side-label" x={2} y={HEIGHT - PAD_BOTTOM + 4}>
        {whiteLabel}
      </text>
      <text className="winrate-axis-label" x={PAD_LEFT} y={HEIGHT - 4}>
        0
      </text>
      <text className="winrate-axis-label" x={WIDTH - PAD_RIGHT} y={HEIGHT - 4} textAnchor="end">
        {lastMove}
      </text>
    </svg>
  )
}
