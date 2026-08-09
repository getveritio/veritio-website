import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { ROLLUP_SCORES, STREAM_ROWS } from './types'
import { revealProgress, useSpringIn } from './lib/remocn-timeline'
import { CHART_WIDTH, DURATION_FRAMES, OUTRO_FRAMES, theme } from './theme'

const ROW_GRID =
  '2.4rem 4.1rem minmax(5.5rem,1.15fr) minmax(5.5rem,1fr) 3.1rem minmax(5.8rem,0.95fr)'

function riskColor(level: string | null): string {
  if (!level) return theme.mutedForeground
  return theme.risk[level as keyof typeof theme.risk] ?? theme.mutedForeground
}

/**
 * Multiplier that dissolves everything that animated in, leaving only the empty
 * panel chrome the clip opened on — so `loop` playback has no visible seam.
 */
function outroFade(frame: number): number {
  return interpolate(frame, [DURATION_FRAMES - OUTRO_FRAMES, DURATION_FRAMES - 1], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t * t,
  })
}

function DotGrid() {
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `radial-gradient(${theme.grid} 1px, transparent 1px)`,
        backgroundSize: '22px 22px',
        opacity: 0.9,
      }}
    />
  )
}

function HeaderBar({ frame }: { frame: number }) {
  const opacity = revealProgress(frame, 0, 10) * outroFade(frame)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px 10px',
        opacity,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: theme.emerald,
            boxShadow: `0 0 0 3px ${theme.emeraldSoft}`,
          }}
        />
        <span
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: theme.foreground,
            textTransform: 'uppercase',
          }}
        >
          Evidence stream
        </span>
      </div>
      <span
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: theme.mutedForeground,
        }}
      >
        Operations · demo
      </span>
    </div>
  )
}

function LedgerHeader({ frame }: { frame: number }) {
  const opacity = revealProgress(frame, 6, 10) * outroFade(frame)
  const cols = ['Seq', 'Time', 'Action', 'Origin', 'Risk', 'Hash']
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: ROW_GRID,
        gap: 8,
        padding: '8px 12px',
        borderBottom: `1px solid ${theme.border}`,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: theme.mutedForeground,
        opacity,
      }}
    >
      {cols.map((c, i) => (
        <span key={c} style={{ textAlign: i >= 4 ? 'right' : 'left' }}>
          {c}
        </span>
      ))}
    </div>
  )
}

function LedgerRow({
  index,
  frame,
}: {
  index: number
  frame: number
}) {
  const row = STREAM_ROWS[index]
  const progress = revealProgress(frame, row.at, 12)
  const opacity = progress * outroFade(frame)
  const y = interpolate(progress, [0, 1], [10, 0])
  const highlight =
    frame >= row.at + 8 && frame < (STREAM_ROWS[index + 1]?.at ?? row.at + 28)
      ? 1
      : 0

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: ROW_GRID,
        gap: 8,
        alignItems: 'center',
        padding: '9px 12px',
        borderBottom: `1px solid ${theme.border}`,
        background:
          highlight > 0 ? 'rgba(255,255,255,0.06)' : 'transparent',
        opacity,
        transform: `translateY(${y}px)`,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        color: theme.foreground,
      }}
    >
      <span style={{ color: theme.mutedForeground, fontVariantNumeric: 'tabular-nums' }}>
        #{row.seq}
      </span>
      <span style={{ color: theme.mutedForeground, fontVariantNumeric: 'tabular-nums' }}>
        {row.time}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: row.dot,
            flexShrink: 0,
          }}
        />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.action}
        </span>
      </span>
      <span
        style={{
          color: theme.mutedForeground,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {row.origin}
      </span>
      <span
        style={{
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          color: riskColor(row.level),
        }}
      >
        {row.risk === null ? '—' : row.risk.toFixed(3)}
      </span>
      <span
        style={{
          textAlign: 'right',
          color: theme.mutedForeground,
          fontSize: 10,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {row.prev === 'genesis' ? 'genesis' : row.prev}
        <span style={{ opacity: 0.45 }}> → </span>
        {row.hash}
      </span>
    </div>
  )
}

function RiskChart({ frame }: { frame: number }) {
  const visibleCount = STREAM_ROWS.filter((r) => frame >= r.at + 6).length
  const width = CHART_WIDTH
  const height = 88
  const padX = 12
  const padY = 12
  const points = ROLLUP_SCORES.slice(0, Math.max(visibleCount, 1)).map((score, i, arr) => {
    const x =
      padX + (arr.length === 1 ? 0 : (i / (arr.length - 1)) * (width - padX * 2))
    const y = height - padY - score * (height - padY * 2)
    return { x, y, score, level: STREAM_ROWS[i]?.level }
  })

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  const chartOpacity = revealProgress(frame, 44, 16) * outroFade(frame)
  const last = points[points.length - 1]

  return (
    <div
      style={{
        marginTop: 12,
        padding: '10px 12px 8px',
        borderRadius: 10,
        border: `1px solid ${theme.border}`,
        background: theme.card,
        opacity: chartOpacity,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 6,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: theme.mutedForeground,
        }}
      >
        <span>Episode risk</span>
        <span style={{ color: last ? riskColor(last.level ?? null) : theme.mutedForeground }}>
          {last ? last.score.toFixed(3) : '—'}
        </span>
      </div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {[0.25, 0.5, 0.75].map((g) => {
          const y = height - padY - g * (height - padY * 2)
          return (
            <line
              key={g}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke={theme.border}
              strokeWidth={1}
            />
          )
        })}
        {points.length > 1 ? (
          <path d={path} fill="none" stroke={theme.foreground} strokeWidth={1.5} />
        ) : null}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 ? 4 : 3}
            fill={riskColor(p.level ?? null)}
          />
        ))}
      </svg>
    </div>
  )
}

function ChainBadge({ frame }: { frame: number }) {
  const start = 214
  const spring = useSpringIn(start)
  if (spring <= 0.001) return null

  return (
    <div
      style={{
        marginTop: 12,
        display: 'inline-flex',
        alignSelf: 'flex-start',
        alignItems: 'center',
        gap: 8,
        padding: '7px 11px',
        borderRadius: 8,
        border: `1px solid ${theme.emerald}`,
        background: theme.emeraldSoft,
        opacity: spring * outroFade(frame),
        transform: `scale(${0.92 + spring * 0.08})`,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: theme.emerald,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M4.5 3.2H3.2a2 2 0 0 0 0 5.6h1.3M7.5 3.2h1.3a2 2 0 1 1 0 5.6H7.5M4.2 6h3.6"
          stroke={theme.emerald}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
      Hash-chain verified
    </div>
  )
}

export const EvidenceStream: React.FC = () => {
  const frame = useCurrentFrame()

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <DotGrid />
      <AbsoluteFill
        style={{
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            flex: 1,
            borderRadius: 12,
            border: `1px solid ${theme.border}`,
            background: 'rgba(24,24,27,0.92)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          }}
        >
          <HeaderBar frame={frame} />
          <div style={{ padding: '0 12px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                borderRadius: 10,
                border: `1px solid ${theme.border}`,
                overflow: 'hidden',
                background: theme.bg,
              }}
            >
              <LedgerHeader frame={frame} />
              {STREAM_ROWS.map((_, i) => (
                <LedgerRow key={i} index={i} frame={frame} />
              ))}
            </div>
            <RiskChart frame={frame} />
            <ChainBadge frame={frame} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
