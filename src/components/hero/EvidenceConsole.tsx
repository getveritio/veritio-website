/**
 * Composition root for the hero "Evidence Console" (1120×640 @ 30fps, 480f) —
 * a strip-chart recorder: report header, printed ledger of audit events, a
 * live rollup summary line, and the risk trace drawing across ruled policy
 * zones. Deliberately unornamented (no window chrome, no pills, no texture):
 * hairlines, tabular mono type, and color only on data. A global opacity
 * envelope fades the panel in at frame 0 and out before 480 so the Player's
 * `loop` restart is invisible. Everything derives from `useCurrentFrame()` —
 * no state, no timers — so the loop is deterministic.
 */
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { bandOf } from '@veritio/core/risk-score'
import { EventFeed } from './EventFeed'
import { StripChart, activeStepAt, traceValueAt } from './StripChart'
import { EPISODE_ID, POLICY_VERSION, bandThresholds, timeline } from './data/episode'
import { consoleTheme as T, levelColor } from './theme'
import { FADE_IN_END, FADE_OUT_END, FADE_OUT_START, VERIFIED_AT } from './choreography'

const PAD_X = 30

/** Report header: instrument title left, scope metadata right. Static chrome. */
function ReportHead() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingBottom: 14,
        borderBottom: `1px solid ${T.lineStrong}`,
        fontFamily: T.mono,
      }}
    >
      <span style={{ fontSize: 13, letterSpacing: 3, color: T.text }}>
        VERITIO · EVIDENCE STREAM
      </span>
      <span style={{ fontSize: 11, letterSpacing: 1, color: T.textFaint }}>
        tenant acme · production · policy {POLICY_VERSION}
      </span>
    </div>
  )
}

/**
 * Live rollup summary line between ledger and chart: episode id, the current
 * partial-rollup readout, and the record/verify status. The rollup numerals
 * update as rows land; status crossfades from a pulsing RECORDING to
 * CHAIN VERIFIED once the last link is in.
 */
function SummaryLine() {
  const frame = useCurrentFrame()
  const value = traceValueAt(frame)
  const level = bandOf(value, bandThresholds)
  const active = activeStepAt(frame)
  const rollup = active >= 0 ? timeline[active]!.rollup : null
  const verified = interpolate(frame, [VERIFIED_AT, VERIFIED_AT + 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const pulse = 0.4 + 0.6 * Math.abs(Math.sin(frame / 14))

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        padding: '16px 4px 14px',
        fontFamily: T.mono,
        fontSize: 12,
        letterSpacing: 1.2,
      }}
    >
      <span style={{ color: T.textFaint }}>
        EPISODE <span style={{ color: T.textSoft }}>{EPISODE_ID}</span>
      </span>
      <span style={{ color: T.textFaint }}>
        ROLLUP{' '}
        <span style={{ color: levelColor[level] }}>
          {value.toFixed(2)} {level.toUpperCase()}
        </span>
        {rollup ? (
          <span style={{ color: T.textFaint }}>
            {' · peak '}
            {rollup.peak.toFixed(2)}
            {' · velocity '}
            {rollup.velocityScore.toFixed(2)}
          </span>
        ) : null}
      </span>
      <span style={{ position: 'relative' }}>
        <span style={{ color: T.accentBright, opacity: verified }}>CHAIN VERIFIED ✓</span>
        <span
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            whiteSpace: 'nowrap',
            color: T.textSoft,
            opacity: 1 - verified,
          }}
        >
          <span style={{ color: T.accentBright, opacity: pulse }}>●</span> RECORDING
        </span>
      </span>
    </div>
  )
}

/** The composition rendered by the Player (and pinned to a late frame for reduced motion). */
export function EvidenceConsole() {
  const frame = useCurrentFrame()
  const envelope =
    interpolate(frame, [0, FADE_IN_END], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) *
    interpolate(frame, [FADE_OUT_START, FADE_OUT_END], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })

  // The background rides the envelope too: at the loop edges (and if playback
  // ever stalls at frame 0) the whole composition is transparent, so the
  // identical static fallback underneath shows through instead of a blank
  // dark box — the loop restart reads as a crossfade through the end state.
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: envelope, background: T.bg, padding: `24px ${PAD_X}px 20px` }}>
        <ReportHead />
        <EventFeed />
        <SummaryLine />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-end' }}>
          <StripChart width={1120 - PAD_X * 2} height={232} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
