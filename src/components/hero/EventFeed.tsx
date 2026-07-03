/**
 * Ledger table of the Evidence Console: fixed-column rows (SEQ / TIME /
 * ACTION / ORIGIN / RISK / HASH) that land like lines from a line printer —
 * a left-to-right reveal plus a brief afterglow, no cards, no pills. Color is
 * reserved for the risk numeral (policy level color) and the hash arrow.
 * All values come from `data/episode.ts` (real `@veritio/core` scores).
 * Inline styles only — frame-interpolated values cannot be utility classes.
 */
import { interpolate, useCurrentFrame } from 'remotion'
import { timeline, type TimelineStep } from './data/episode'
import { consoleTheme as T, levelColor } from './theme'
import { ENTER_FRAMES } from './choreography'

/** Shared column template so header and rows always align. */
export const LEDGER_COLUMNS = '56px 104px 1fr 250px 130px 190px'

const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  ...extra,
})

/** Formats the fixture timestamp as the compact clock shown per row (UTC, HH:MM:SS). */
const clockOf = (iso: string) => iso.slice(11, 19)

/** Column captions row — part of the static instrument chrome. */
export function LedgerHead() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: LEDGER_COLUMNS,
        gap: 18,
        padding: '10px 4px 8px',
        borderBottom: `1px solid ${T.lineStrong}`,
        fontFamily: T.mono,
        fontSize: 10.5,
        letterSpacing: 2.2,
        color: T.textFaint,
      }}
    >
      <span>SEQ</span>
      <span>TIME</span>
      <span>ACTION</span>
      <span>ORIGIN</span>
      <span style={{ textAlign: 'right' }}>RISK</span>
      <span style={{ textAlign: 'right' }}>HASH</span>
    </div>
  )
}

/**
 * One printed ledger line. `enter` is its choreographed landing frame; the
 * row reveals left→right and its fresh-print afterglow fades over ~40f.
 */
function LedgerRow({ step, enter }: { step: TimelineStep; enter: number }) {
  const frame = useCurrentFrame()
  const reveal = interpolate(frame, [enter, enter + 10], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const afterglow = interpolate(frame, [enter, enter + 6, enter + 46], [0, 0.08, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const color = levelColor[step.assessment.level]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: LEDGER_COLUMNS,
        gap: 18,
        alignItems: 'baseline',
        padding: '16px 4px',
        borderBottom: `1px solid ${T.line}`,
        fontFamily: T.mono,
        fontSize: 14,
        background: `rgba(231, 239, 233, ${afterglow})`,
        clipPath: `inset(0 ${100 - reveal}% 0 0)`,
      }}
    >
      <span style={cell({ color: T.textFaint })}>#{step.sequence}</span>
      <span style={cell({ color: T.textSoft })}>{clockOf(step.occurredAt)}</span>
      <span style={cell({ color: T.text, letterSpacing: 0.2 })}>{step.action}</span>
      <span style={cell({ color: T.textSoft })}>
        {step.actor.type}·{step.actor.id}
      </span>
      <span style={cell({ color, textAlign: 'right' })}>{step.assessment.score.toFixed(3)}</span>
      <span style={cell({ color: T.textFaint, textAlign: 'right' })}>
        {step.prevHash.replace('…', '')} <span style={{ color: T.accentBright }}>→</span>{' '}
        {step.hash.replace('…', '')}
      </span>
    </div>
  )
}

/** The full ledger: column captions plus the four choreographed printed lines. */
export function EventFeed() {
  return (
    <div>
      <LedgerHead />
      {timeline.map((step, i) => (
        <LedgerRow key={step.sequence} step={step} enter={ENTER_FRAMES[i]!} />
      ))}
    </div>
  )
}
