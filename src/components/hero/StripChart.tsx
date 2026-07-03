/**
 * Strip-chart recorder of the Evidence Console: the episode risk rollup drawn
 * as a trace over time, seismograph-style. Horizontal ruled zones sit at the
 * REAL reference policy thresholds (`DEFAULT_RISK_POLICY.bands`:
 * 0.05/0.25/0.5/0.75) and the trace steps up to each partial rollup
 * (0.202 → 0.36 → 0.6 → 1.0) as ledger rows land — score-over-time is what
 * episode rollup actually is (peak + velocity), so the instrument is truthful
 * by construction. The live level readout is re-derived from the interpolated
 * value with the SDK's own `bandOf`. Inline styles only.
 */
import { Easing, interpolate, useCurrentFrame } from 'remotion'
import { bandOf, type RiskLevel } from '@veritio/core/risk-score'
import { bandThresholds, timeline } from './data/episode'
import { consoleTheme as T, levelColor } from './theme'
import { ENTER_FRAMES, TRACE_DELAY, TRACE_IN, VERIFIED_AT } from './choreography'

/** The trace's value at a frame: piecewise ease between partial rollup scores. */
export const traceValueAt = (frame: number) => {
  let value = 0
  for (let i = 0; i < timeline.length; i++) {
    const start = ENTER_FRAMES[i]! + TRACE_DELAY
    const prev = i === 0 ? 0 : timeline[i - 1]!.rollup.score
    const next = timeline[i]!.rollup.score
    if (frame < start) break
    value = interpolate(frame, [start, start + TRACE_IN], [prev, next], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    })
  }
  return value
}

/** Latest rollup whose trace transition has started — drives the live readouts. */
export const activeStepAt = (frame: number) => {
  let active = -1
  for (let i = 0; i < timeline.length; i++) {
    if (frame >= ENTER_FRAMES[i]! + TRACE_DELAY) active = i
  }
  return active
}

/** Ruled zones from the real policy thresholds — never retyped by hand. `mid` centers the zone label. */
const ZONES: { at: number; mid: number; level: RiskLevel }[] = [
  { at: bandThresholds.critical, mid: (bandThresholds.critical + 1) / 2, level: 'critical' },
  { at: bandThresholds.high, mid: (bandThresholds.high + bandThresholds.critical) / 2, level: 'high' },
  { at: bandThresholds.medium, mid: (bandThresholds.medium + bandThresholds.high) / 2, level: 'medium' },
  { at: bandThresholds.low, mid: (bandThresholds.low + bandThresholds.medium) / 2, level: 'low' },
]

const AXIS_TICKS = [1, 0.75, 0.5, 0.25, 0]

export function StripChart({ width, height }: { width: number; height: number }) {
  const frame = useCurrentFrame()

  const padLeft = 52
  const padRight = 96
  const padY = 10
  const plotW = width - padLeft - padRight
  const plotH = height - padY * 2
  const xOf = (f: number) =>
    padLeft + plotW * Math.min(1, Math.max(0, f / VERIFIED_AT))
  const yOf = (v: number) => padY + plotH * (1 - v)

  // Sampled polyline from frame 0 to the pen head — deterministic per frame.
  const head = Math.min(frame, VERIFIED_AT)
  const points: string[] = []
  for (let f = 0; f <= head; f += 2) points.push(`${xOf(f)},${yOf(traceValueAt(f))}`)
  points.push(`${xOf(head)},${yOf(traceValueAt(head))}`)

  const value = traceValueAt(frame)
  const level = bandOf(value, bandThresholds)
  const penColor = levelColor[level]

  return (
    <svg width={width} height={height} style={{ display: 'block' }} aria-hidden>
      {/* Ruled threshold lines + zone labels at the right margin. */}
      {ZONES.map((zone) => (
        <g key={zone.level}>
          <line
            x1={padLeft}
            y1={yOf(zone.at)}
            x2={padLeft + plotW}
            y2={yOf(zone.at)}
            stroke={levelColor[zone.level]}
            strokeWidth={1}
            strokeDasharray="1 5"
            opacity={0.5}
          />
          <text
            x={padLeft + plotW + 12}
            y={yOf(zone.mid) + 3.5}
            fill={levelColor[zone.level]}
            opacity={0.75}
            fontFamily={T.mono}
            fontSize={10.5}
            letterSpacing={1.5}
          >
            {zone.level.toUpperCase()}
          </text>
        </g>
      ))}

      {/* Y axis numerals + frame rules. */}
      {AXIS_TICKS.map((tick) => (
        <text
          key={tick}
          x={padLeft - 12}
          y={yOf(tick) + 3.5}
          textAnchor="end"
          fill={T.textFaint}
          fontFamily={T.mono}
          fontSize={10.5}
        >
          {tick.toFixed(2)}
        </text>
      ))}
      <line x1={padLeft} y1={padY} x2={padLeft} y2={padY + plotH} stroke={T.lineStrong} strokeWidth={1} />
      <line
        x1={padLeft}
        y1={padY + plotH}
        x2={padLeft + plotW}
        y2={padY + plotH}
        stroke={T.lineStrong}
        strokeWidth={1}
      />

      {/* Event tick marks on the baseline where each ledger row lands. */}
      {timeline.map((step, i) => {
        const at = ENTER_FRAMES[i]! + TRACE_DELAY
        if (frame < at) return null
        return (
          <line
            key={step.sequence}
            x1={xOf(at)}
            y1={padY + plotH}
            x2={xOf(at)}
            y2={padY + plotH + 5}
            stroke={levelColor[step.rollup.level]}
            strokeWidth={1.5}
          />
        )
      })}

      {/* The trace and its pen head. */}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={T.accentBright}
        strokeWidth={1.8}
      />
      <circle cx={xOf(head)} cy={yOf(value)} r={3.2} fill={penColor} />
    </svg>
  )
}
