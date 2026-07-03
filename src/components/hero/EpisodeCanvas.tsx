/**
 * "Activity episode canvas" composition for the Veritio Cloud section
 * (1120×520 @ 30fps, 400f) — the hero's SAME four scored events, but tracked
 * visually the way Veritio Cloud presents them: event cards popping onto a
 * dotted infinite-canvas with lane edges drawing between them, a faint day
 * watermark, and the episode risk rollup badge landing once the last card is
 * in. All numbers come from `data/episode.ts` (real `@veritio/core` scores).
 * Inline styles only; everything derives from `useCurrentFrame()` so the loop
 * is deterministic. The background rides the fade envelope so a stalled
 * player is transparent over the identical static fallback.
 */
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { EPISODE_ID, canvasCards, finalRollup } from './data/episode'
import { consoleTheme as T, levelColor } from './theme'

export const CANVAS_FPS = 30
export const CANVAS_DURATION = 400
export const CANVAS_W = 1120
export const CANVAS_H = 520

/** Frame at which each card pops in. */
export const CARD_ENTERS = [22, 92, 162, 232] as const
/** The rollup badge lands after the deploy card. */
const BADGE_AT = 290
/** Hold, then cross-fade for the loop restart. */
export const CANVAS_FADE_OUT_START = 372
const CANVAS_FADE_OUT_END = 396

const CARD_W = 228
const CARD_H = 84

/** Card center in canvas pixels. */
const centerOf = (i: number) => ({
  x: canvasCards[i]!.x * CANVAS_W,
  y: canvasCards[i]!.y * CANVAS_H,
})

/** One event card popping in with a spring scale + fade. */
function EventCard({ index }: { index: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const card = canvasCards[index]!
  const enter = CARD_ENTERS[index]!
  const pop = spring({ frame: frame - enter, fps, config: { damping: 16, mass: 0.7 } })
  const opacity = interpolate(frame, [enter, enter + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const color = levelColor[card.step.assessment.level]
  const { x, y } = centerOf(index)

  return (
    <div
      style={{
        position: 'absolute',
        left: x - CARD_W / 2,
        top: y - CARD_H / 2,
        width: CARD_W,
        height: CARD_H,
        boxSizing: 'border-box',
        padding: '10px 14px',
        background: '#101e17',
        border: `1px solid ${T.lineStrong}`,
        borderRadius: 6,
        fontFamily: T.mono,
        opacity,
        transform: `scale(${interpolate(pop, [0, 1], [0.7, 1])})`,
        boxShadow: '0 12px 32px rgba(2, 8, 5, 0.45)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 9.5, letterSpacing: 1.8, color: T.textFaint }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: color }} />
          {card.kind}
        </span>
        <span style={{ fontSize: 10.5, color }}>{card.step.assessment.score.toFixed(3)}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 12.5, color: T.text, letterSpacing: 0.2 }}>{card.step.action}</div>
      <div style={{ marginTop: 5, fontSize: 10.5, color: T.textSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {card.step.detail}
      </div>
    </div>
  )
}

/** Edges between consecutive cards, drawn with strokeDashoffset as the target card lands. */
function Edges() {
  const frame = useCurrentFrame()
  return (
    <svg width={CANVAS_W} height={CANVAS_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
      {canvasCards.slice(1).map((card, i) => {
        const a = centerOf(i)
        const b = centerOf(i + 1)
        const start = { x: a.x + CARD_W / 2 + 6, y: a.y }
        const end = { x: b.x - CARD_W / 2 - 6, y: b.y }
        const midX = (start.x + end.x) / 2
        const d = `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`
        const len = Math.hypot(end.x - start.x, end.y - start.y) * 1.3
        const draw = interpolate(frame, [CARD_ENTERS[i + 1]! - 14, CARD_ENTERS[i + 1]! + 6], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        })
        return (
          <g key={card.step.sequence}>
            <path
              d={d}
              fill="none"
              stroke={T.accentBright}
              strokeWidth={1.4}
              strokeDasharray={`${len}`}
              strokeDashoffset={len * (1 - draw)}
              opacity={0.55}
            />
            <circle cx={end.x} cy={end.y} r={2.6} fill={T.accentBright} opacity={draw} />
          </g>
        )
      })}
    </svg>
  )
}

/** Episode rollup badge — the payoff, landing after the deploy card. */
function RollupBadge() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - BADGE_AT, fps, config: { damping: 15 } })
  const opacity = interpolate(frame, [BADGE_AT, BADGE_AT + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const pulse = 0.5 + 0.5 * Math.abs(Math.sin(frame / 13))
  const color = levelColor[finalRollup.level]

  return (
    <div
      style={{
        position: 'absolute',
        top: 22,
        right: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '12px 18px',
        background: '#101e17',
        border: `1px solid ${color}55`,
        borderRadius: 6,
        fontFamily: T.mono,
        opacity,
        transform: `scale(${interpolate(pop, [0, 1], [0.85, 1])})`,
        boxShadow: '0 12px 32px rgba(2, 8, 5, 0.45)',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: color, opacity: pulse }} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, color: T.text, letterSpacing: 0.4 }}>Critical risk</span>
          <span style={{ fontSize: 9, letterSpacing: 1.6, color: T.textFaint }}>EPISODE ROLLUP</span>
        </span>
      </span>
      {[
        [finalRollup.peak.toFixed(2), 'PEAK'],
        [finalRollup.velocityScore.toFixed(2), 'VELOCITY'],
        [`${finalRollup.stepCount}`, 'STEPS'],
      ].map(([value, label]) => (
        <span key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right' }}>
          <span style={{ fontSize: 13, color: T.text }}>{value}</span>
          <span style={{ fontSize: 9, letterSpacing: 1.6, color: T.textFaint }}>{label}</span>
        </span>
      ))}
    </div>
  )
}

/** The canvas scene rendered by the Player (pinned to a late frame for reduced motion). */
export function EpisodeCanvas() {
  const frame = useCurrentFrame()
  const envelope =
    interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) *
    interpolate(frame, [CANVAS_FADE_OUT_START, CANVAS_FADE_OUT_END], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: envelope,
          background: `radial-gradient(rgba(231, 239, 233, 0.07) 1px, transparent 1px) 0 0 / 26px 26px, ${T.bg}`,
        }}
      >
        {/* Day watermark — the episode's real occurredAt date. */}
        <div
          style={{
            position: 'absolute',
            bottom: -26,
            left: 30,
            fontFamily: T.mono,
            fontSize: 130,
            fontWeight: 600,
            letterSpacing: 6,
            color: 'rgba(231, 239, 233, 0.045)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          23 JUN
        </div>

        <Edges />
        {canvasCards.map((_, i) => (
          <EventCard key={i} index={i} />
        ))}
        <RollupBadge />

        {/* Status chip, bottom-left like the product. */}
        <div
          style={{
            position: 'absolute',
            left: 24,
            bottom: 20,
            padding: '7px 12px',
            border: `1px solid ${T.line}`,
            borderRadius: 4,
            fontFamily: T.mono,
            fontSize: 10.5,
            letterSpacing: 0.8,
            color: T.textSoft,
            background: 'rgba(12, 26, 20, 0.7)',
          }}
        >
          {canvasCards.length} events · 1 episode · {EPISODE_ID}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
