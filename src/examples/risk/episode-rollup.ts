import {
  DEFAULT_RISK_POLICY,
  type EpisodeRiskRollup,
  type EpisodeRiskStep,
  type RiskScoringPolicy,
  type RiskSignals,
  clamp01,
  riskPolicy,
  rollupEpisodeRisk,
  round4,
  scoreRiskSignals,
} from '@veritio/core/risk-score'

/**
 * Proves the episode-rollup invariants a read model depends on when it turns a
 * sequence of scored steps into ONE episode risk number:
 *
 * - An episode score is never a sum and never an average. It is
 *   `max(peak, velocityScore)` — the worst single step, or the worst decayed
 *   momentum burst, whichever is higher. One risky step therefore cannot be
 *   diluted by padding the episode with quiet steps.
 * - Momentum carries forward through `rollup.windowSeconds` /
 *   `rollup.decayPerWindow`: the gap between two steps is floored into WHOLE
 *   windows and `decayPerWindow` is applied once per whole window by repeated
 *   multiply (never `pow`), so sub-window gaps carry momentum in full and long
 *   gaps cool the episode off.
 * - `rollup.velocityNormalizer` is the only thing converting raw momentum into
 *   a 0..1 score, so it alone decides whether a burst can out-rank the peak.
 * - The rollup sorts by `occurredAt` itself, so a caller's array order cannot
 *   change the published episode score.
 *
 * The fixture re-derives the momentum series locally from the policy constants
 * and asserts it reproduces the library's `velocityScore` exactly; if the
 * protocol math ever drifts from the documented decay rule, this fixture fails
 * instead of printing a plausible-looking number.
 *
 * Every step id, timestamp, and signal is pinned, and the math uses only the
 * crypto-free `@veritio/core/risk-score` subpath, so the printed output is
 * byte-stable across runs and across the TypeScript/Python/Go SDKs.
 */
export type EpisodeStepInput = {
  stepId: string
  occurredAt: string
  signals: RiskSignals
}

/**
 * One pinned agent episode in a production tenant: a quiet lookup, a tight
 * burst of writes, a two-minute pause that cools momentum, an irreversible
 * permission change, then a long quiet tail. Chosen so the gaps exercise every
 * branch of the decay rule — a sub-window gap (full carry), a multi-window gap
 * (partial carry), and a very long gap (near-total cool-off).
 */
export const episodeSteps: ReadonlyArray<EpisodeStepInput> = [
  {
    stepId: 'step_01_read_config',
    occurredAt: '2026-08-09T10:00:00.000Z',
    signals: {
      operationType: 'read',
      reversibility: 'reversible',
      envCriticality: 'production',
      referenceCount: 12,
    },
  },
  {
    stepId: 'step_02_update_rows',
    occurredAt: '2026-08-09T10:00:30.000Z',
    signals: {
      operationType: 'update',
      reversibility: 'recoverable',
      envCriticality: 'production',
      dataVolume: 40,
      fanOut: 2,
    },
  },
  {
    stepId: 'step_03_config_change',
    occurredAt: '2026-08-09T10:01:00.000Z',
    signals: {
      operationType: 'config',
      reversibility: 'recoverable',
      envCriticality: 'production',
      fanOut: 6,
    },
  },
  {
    stepId: 'step_04_bulk_update',
    occurredAt: '2026-08-09T10:03:00.000Z',
    signals: {
      operationType: 'update',
      reversibility: 'recoverable',
      envCriticality: 'production',
      dataVolume: 900,
    },
  },
  {
    stepId: 'step_05_grant_admin',
    occurredAt: '2026-08-09T10:03:20.000Z',
    signals: {
      operationType: 'permission',
      reversibility: 'irreversible',
      envCriticality: 'production',
      fanOut: 4,
    },
  },
  {
    stepId: 'step_06_read_audit',
    occurredAt: '2026-08-09T10:13:00.000Z',
    signals: {
      operationType: 'read',
      reversibility: 'reversible',
      envCriticality: 'production',
    },
  },
]

/**
 * Scores every pinned step into the `EpisodeRiskStep` shape the rollup consumes.
 * Step scores are DERIVED by `scoreRiskSignals`, never hand-written, so the
 * episode numbers below trace back to the same per-step policy constants the
 * scoring fixtures document.
 */
export function scoredEpisodeSteps(policy: RiskScoringPolicy = DEFAULT_RISK_POLICY): EpisodeRiskStep[] {
  return episodeSteps.map((step) => ({
    occurredAt: step.occurredAt,
    score: scoreRiskSignals(step.signals, policy).score,
  }))
}

/**
 * Re-derives the decayed momentum series the rollup walks internally, using only
 * the policy's `windowSeconds` / `decayPerWindow` and the exported `round4`.
 * Exists so the documentation can SHOW the carry arithmetic per step; its
 * `maxMomentum` is cross-checked against the library's `velocityScore` in
 * `analyzeEpisode`, which is what keeps this a proof rather than a re-telling.
 */
export function momentumTrace(steps: EpisodeRiskStep[], policy: RiskScoringPolicy) {
  const { windowSeconds, decayPerWindow } = policy.rollup
  const sorted = [...steps].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))

  let momentum = 0
  let previousMs: number | null = null

  return sorted.map((step) => {
    const currentMs = Date.parse(step.occurredAt)
    const gapSeconds = previousMs === null ? null : Math.max(0, (currentMs - previousMs) / 1000)
    // Whole windows only: a 59s gap under a 60s window carries momentum in full.
    const wholeWindows = gapSeconds === null ? 0 : Math.floor(gapSeconds / windowSeconds)
    let decay = 1
    for (let i = 0; i < wholeWindows; i += 1) decay = decay * decayPerWindow
    const carried = previousMs === null ? 0 : round4(momentum * decay)
    momentum = round4(step.score + (previousMs === null ? 0 : momentum * decay))
    previousMs = currentMs

    return {
      occurredAt: step.occurredAt,
      stepScore: step.score,
      gapSeconds,
      wholeWindows,
      decayApplied: round4(decay),
      carriedIn: carried,
      momentum,
    }
  })
}

/**
 * Builds the full explanation printed by this fixture: the per-step scores, the
 * decayed running rollup (recomputed by re-rolling each growing prefix through
 * the real `rollupEpisodeRisk`, never by faking it), the final rollup, and which
 * step actually decided the episode score.
 */
export function analyzeEpisode(policy: RiskScoringPolicy = DEFAULT_RISK_POLICY) {
  const steps = scoredEpisodeSteps(policy)
  const trace = momentumTrace(steps, policy)
  const rollup = rollupEpisodeRisk(steps, policy)

  const running = steps.map((_step, index) => {
    const prefix = rollupEpisodeRisk(steps.slice(0, index + 1), policy)
    const line = trace[index]!
    return {
      stepId: episodeSteps[index]!.stepId,
      occurredAt: line.occurredAt,
      stepScore: line.stepScore,
      gapSeconds: line.gapSeconds,
      wholeWindows: line.wholeWindows,
      decayApplied: line.decayApplied,
      carriedIn: line.carriedIn,
      momentum: line.momentum,
      runningPeak: prefix.peak,
      runningVelocityScore: prefix.velocityScore,
      runningScore: prefix.score,
      runningLevel: prefix.level,
    }
  })

  const maxMomentum = trace.reduce((max, line) => (line.momentum > max ? line.momentum : max), 0)
  const peakIndex = steps.findIndex((step) => step.score === rollup.peak)
  const momentumIndex = trace.findIndex((line) => line.momentum === maxMomentum)

  return {
    steps,
    trace,
    rollup,
    running,
    maxMomentum,
    dominance: {
      // max(peak, velocityScore): a single worst step and a decayed burst are
      // the only two ways an episode score can be produced under a rule-free
      // policy, and the higher of the two wins outright.
      peak: rollup.peak,
      velocityScore: rollup.velocityScore,
      decidedBy:
        rollup.peak > rollup.velocityScore
          ? 'peak'
          : rollup.velocityScore > rollup.peak
            ? 'velocity'
            : 'tie',
      peakStepId: episodeSteps[peakIndex]!.stepId,
      momentumPeakStepId: episodeSteps[momentumIndex]!.stepId,
      // velocityScore is exactly clamp01(round4(maxMomentum / velocityNormalizer)).
      velocityFromMomentum: clamp01(round4(maxMomentum / policy.rollup.velocityNormalizer)),
    },
  }
}

/**
 * Re-rolls the same steps under a single retuned rollup knob so the docs can
 * show what each constant actually controls. `riskPolicy` requires an explicit
 * `policyVersion` for any override, so a retuned episode score can never be
 * published under the reference version string.
 */
export function knobVariant(
  label: string,
  policyVersion: string,
  rollupOverrides: { windowSeconds?: number; decayPerWindow?: number; velocityNormalizer?: number },
): {
  label: string
  changed: { windowSeconds?: number; decayPerWindow?: number; velocityNormalizer?: number }
  rollup: EpisodeRiskRollup
} {
  const policy = riskPolicy({ overrides: { policyVersion, rollup: rollupOverrides } })
  return {
    label,
    changed: rollupOverrides,
    rollup: rollupEpisodeRisk(scoredEpisodeSteps(), policy),
  }
}

if (import.meta.main) {
  const analysis = analyzeEpisode()

  if (analysis.dominance.velocityFromMomentum !== analysis.rollup.velocityScore) {
    throw new Error('locally derived momentum must reproduce the library velocityScore exactly')
  }

  const reversedRollup = rollupEpisodeRisk([...scoredEpisodeSteps()].reverse())

  const output = {
    policy: {
      policyVersion: DEFAULT_RISK_POLICY.policyVersion,
      bands: DEFAULT_RISK_POLICY.bands,
      rollup: {
        windowSeconds: DEFAULT_RISK_POLICY.rollup.windowSeconds,
        decayPerWindow: DEFAULT_RISK_POLICY.rollup.decayPerWindow,
        velocityNormalizer: DEFAULT_RISK_POLICY.rollup.velocityNormalizer,
        frequencyRuleCount: DEFAULT_RISK_POLICY.rollup.frequencyRules.length,
      },
    },
    // Each row: the step's own score, the gap floored into whole windows, the
    // decay that gap applied to carried momentum, and the rollup as it stood
    // after that step.
    steps: analysis.running,
    episode: analysis.rollup,
    dominance: analysis.dominance,
    orderIndependent: {
      note: 'rollupEpisodeRisk sorts by occurredAt on a non-mutating copy, so caller array order cannot move the episode score.',
      reversedInputMatches: JSON.stringify(reversedRollup) === JSON.stringify(analysis.rollup),
    },
    knobEffects: [
      // windowSeconds decides how many whole windows a gap contains, so a
      // shorter window cools the same timeline far harder.
      knobVariant('windowSeconds 15 (four times as many decay windows)', 'docs.rollup.window15', {
        windowSeconds: 15,
      }),
      knobVariant('windowSeconds 600 (every gap lands inside one window)', 'docs.rollup.window600', {
        windowSeconds: 600,
      }),
      // decayPerWindow decides how much survives each whole window: 1 never
      // forgets, 0 resets carry at the first window boundary.
      knobVariant('decayPerWindow 1 (momentum never cools)', 'docs.rollup.decay1', {
        decayPerWindow: 1,
      }),
      knobVariant('decayPerWindow 0 (any full window resets carry)', 'docs.rollup.decay0', {
        decayPerWindow: 0,
      }),
      // velocityNormalizer alone converts raw momentum into a 0..1 score, so it
      // alone decides whether a burst can out-rank the worst single step.
      knobVariant('velocityNormalizer 1.5 (burst out-ranks the peak)', 'docs.rollup.velocity1_5', {
        velocityNormalizer: 1.5,
      }),
      knobVariant('velocityNormalizer 6 (burst can never out-rank the peak)', 'docs.rollup.velocity6', {
        velocityNormalizer: 6,
      }),
    ],
  }

  console.log(JSON.stringify(output, null, 2))
}
