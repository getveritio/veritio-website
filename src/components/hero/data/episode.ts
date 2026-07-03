/**
 * Scripted activity-episode timeline for the hero "Evidence Console".
 *
 * This module is the SINGLE source of every number the hero displays. Risk
 * scores and the episode rollup are computed at build/load time by the real,
 * published `@veritio/core/risk-score` policy math (crypto-free, browser-safe)
 * — never hardcoded — so the marketing animation cannot drift from what the
 * SDK actually computes. The four signal sets are taken verbatim from the OSS
 * conformance fixtures (spec/conformance/risk-episode-rollup.json and
 * risk-scoring-default-policy.json), which pin the arc
 * 0.202 low → 0.36 medium → 0.6 high → 1.0 critical and the final rollup
 * {score:1, level:"critical", peak:1, velocityScore:0.4302}.
 *
 * The short hash strings are display placeholders (real sha256 chaining needs
 * node:crypto, which is deliberately excluded from the island); UI copy must
 * label them illustrative. Everything else — field names, actor types, action
 * strings, policy version, level bands — is real protocol vocabulary.
 */
import {
  DEFAULT_RISK_POLICY,
  scoreRiskSignals,
  rollupEpisodeRisk,
  type EpisodeRiskRollup,
  type RiskAssessment,
  type RiskSignals,
} from '@veritio/core/risk-score'

/** Protocol `actor.type` values used in this episode (subset of the event-schema enum). */
export type HeroActorType = 'ai_agent' | 'user' | 'service'

/** One scripted audit event before scoring: protocol-shaped surface + risk signals. */
interface ScriptedEvent {
  action: string
  actor: { type: HeroActorType; id: string }
  detail: string
  occurredAt: string
  signals: RiskSignals
}

/** Durable activity-episode id shown in the gauge caption (protocol `metadata.activityEpisodeId` shape). */
export const EPISODE_ID = 'ep_7c21f0a3'

/** Reference policy version shown in the caption — read from the SDK, not retyped. */
export const POLICY_VERSION = DEFAULT_RISK_POLICY.policyVersion

/**
 * Illustrative record-hash short strings for the chain-link visual. The first
 * entry is the episode's `previousHash` tail; entry i+1 is event i's `hash`.
 */
export const chainHashes = ['a3f9…', '7c21…', '9e04…', '5db8…', 'c1a7…'] as const

const SCRIPT: ScriptedEvent[] = [
  {
    action: 'agent.session.started',
    actor: { type: 'ai_agent', id: 'claude-code' },
    detail: 'insert 1 row · production',
    occurredAt: '2026-06-23T00:00:00.000Z',
    signals: { operationType: 'create', dataVolume: 1 },
  },
  {
    action: 'change.files.changed',
    actor: { type: 'ai_agent', id: 'claude-code' },
    detail: 'bulk update · 500 rows · staging',
    occurredAt: '2026-06-23T00:00:30.000Z',
    signals: {
      operationType: 'bulk',
      reversibility: 'reversible',
      envCriticality: 'staging',
      dataVolume: 500,
      fanOut: 5,
      referenceCount: 10,
    },
  },
  {
    action: 'review.approval.recorded',
    actor: { type: 'user', id: 'usr_ops' },
    detail: 'grant role · production',
    occurredAt: '2026-06-23T00:01:00.000Z',
    signals: { operationType: 'permission', envCriticality: 'production' },
  },
  {
    action: 'deploy.deployed',
    actor: { type: 'service', id: 'svc_deploy' },
    detail: 'drop table · 12k rows · 12 refs',
    occurredAt: '2026-06-23T00:03:00.000Z',
    signals: {
      operationType: 'destructive',
      reversibility: 'irreversible',
      envCriticality: 'production',
      dataVolume: 12000,
      fanOut: 12,
      referenceCount: 12,
    },
  },
]

/** A scripted event with its real per-step assessment and the partial episode rollup after it. */
export interface TimelineStep extends ScriptedEvent {
  sequence: number
  assessment: RiskAssessment
  /** Rollup of steps[0..i] — the gauge value the instant this row lands. */
  rollup: EpisodeRiskRollup
  prevHash: string
  hash: string
}

/**
 * The fully scored timeline, computed once at module evaluation. Pure and
 * deterministic (no Date.now, no crypto), so it is safe to run both in the
 * browser island and in Astro frontmatter for the static no-JS fallback —
 * both surfaces always show identical numbers.
 */
export const timeline: TimelineStep[] = SCRIPT.map((event, i) => {
  const assessment = scoreRiskSignals(event.signals)
  const rollup = rollupEpisodeRisk(
    SCRIPT.slice(0, i + 1).map((s) => ({
      occurredAt: s.occurredAt,
      score: scoreRiskSignals(s.signals).score,
    })),
  )
  return {
    ...event,
    sequence: i + 1,
    assessment,
    rollup,
    prevHash: chainHashes[i]!,
    hash: chainHashes[i + 1]!,
  }
})

/** End-state rollup — the gauge's resting value ({score:1, level:"critical"}). */
export const finalRollup: EpisodeRiskRollup = timeline[timeline.length - 1]!.rollup

/**
 * Canvas layout for the Veritio Cloud "activity episode canvas" visual: the
 * SAME four scored events, placed on lanes across the canvas (fractions of
 * canvas width/height). Shared by the Remotion composition and the static
 * fallback so the two surfaces can never diverge.
 */
export interface CanvasCard {
  step: TimelineStep
  /** Mono kind label shown on the card header. */
  kind: string
  /** Horizontal center, fraction of canvas width. */
  x: number
  /** Vertical center, fraction of canvas height. */
  y: number
}

export const canvasCards: CanvasCard[] = timeline.map((step, i) => ({
  step,
  kind: ['AGENT', 'CHANGE', 'REVIEW', 'DEPLOY'][i]!,
  x: [0.13, 0.37, 0.6, 0.84][i]!,
  y: [0.3, 0.62, 0.26, 0.56][i]!,
}))

/** Real reference-policy band thresholds (low/medium/high/critical lower bounds) for gauge segments. */
export const bandThresholds = DEFAULT_RISK_POLICY.bands
