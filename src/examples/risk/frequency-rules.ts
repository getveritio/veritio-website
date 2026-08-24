import {
  DEFAULT_RISK_POLICY,
  type EpisodeFrequencyRule,
  type EpisodeRiskStep,
  type RiskScoringPolicy,
  riskPolicy,
  rollupEpisodeRisk,
} from '@veritio/core/risk-score'

/**
 * Proves the two frequency-rule invariants an episode rollup depends on:
 *
 * - A configured `rollup.frequencyRules` entry fires at most once per episode,
 *   over an inclusive sliding window of steps whose `action` exact-matches the
 *   rule, and its `boost` joins the final `max(peak, velocityScore,
 *   frequencyScore)`. Rules can therefore only RAISE an episode score. The same
 *   steps that band `low` under the rule-free reference policy band `high` once
 *   the burst rule is configured, and the rule-free rollup emits no frequency
 *   fields at all, so pre-frequency callers stay byte-identical.
 * - `EpisodeRiskRollup.frequencyMatches` reports EVERY configured rule, fired or
 *   not, with the observed window `count`, so a non-firing rule is explainable
 *   evidence rather than silence. A step without an `action` can never match.
 * - `riskPolicy` overrides `rollup.frequencyRules` WHOLESALE, never by merging:
 *   supplying a list replaces the base list entirely, and omitting the key keeps
 *   the base list. Rules never accumulate across calls, so a hand-tuned policy
 *   always contains exactly the rules its author wrote.
 *
 * Every step timestamp, score, action, and rule constant is pinned so the
 * printed output is byte-stable across runs and across the TS/Python/Go SDKs.
 */

/** Burst rule: repeated failed logins inside five minutes. Fires on this episode. */
const failedLoginBurst: EpisodeFrequencyRule = {
  actions: ['auth.login.failed'],
  windowSeconds: 300,
  threshold: 4,
  boost: 0.55,
}

/** Exfiltration-shaped rule kept deliberately UNMET, to show a non-firing match. */
const exportBurst: EpisodeFrequencyRule = {
  actions: ['data.export.started', 'data.export.completed'],
  windowSeconds: 600,
  threshold: 3,
  boost: 0.4,
}

/**
 * One pinned episode: four failed logins tight enough to trip the burst rule,
 * one un-actioned step (which no rule may ever count), and one lone export far
 * enough out that decay drops momentum. Raw step scores stay small on purpose so
 * the frequency boost, not peak or velocity, is what moves the episode band.
 */
export const loginBurstEpisode: EpisodeRiskStep[] = [
  { occurredAt: '2026-08-09T10:00:00.000Z', score: 0.12, action: 'auth.login.failed' },
  { occurredAt: '2026-08-09T10:00:40.000Z', score: 0.12, action: 'auth.login.failed' },
  { occurredAt: '2026-08-09T10:01:30.000Z', score: 0.12, action: 'auth.login.failed' },
  { occurredAt: '2026-08-09T10:02:10.000Z', score: 0.12, action: 'auth.login.failed' },
  // No `action`: invisible to every rule, still scored for peak and velocity.
  { occurredAt: '2026-08-09T10:05:00.000Z', score: 0.1 },
  { occurredAt: '2026-08-09T10:12:00.000Z', score: 0.2, action: 'data.export.completed' },
]

/**
 * The hand-tuned detection policy documented on the risk page. Overriding any
 * field makes the policy hand-tuned, so `policyVersion` is mandatory: a derived
 * "+tempX.XX" suffix must never misdescribe the constants behind a published
 * risk conclusion.
 */
export function burstDetectionPolicy(): RiskScoringPolicy {
  return riskPolicy({
    overrides: {
      policyVersion: 'acme.burst-detection.v1',
      rollup: { frequencyRules: [failedLoginBurst, exportBurst] },
    },
  })
}

/**
 * Projects one rollup down to the fields the docs compare. `frequencyScore` and
 * `frequencyMatches` are OPTIONAL in the protocol — absent whenever the policy
 * configures no rules — so this reports their presence rather than assuming it.
 */
function rollupProfile(policy: RiskScoringPolicy) {
  const rollup = rollupEpisodeRisk(loginBurstEpisode, policy)
  return {
    policyVersion: rollup.policyVersion,
    configuredRuleCount: policy.rollup.frequencyRules.length,
    score: rollup.score,
    level: rollup.level,
    peak: rollup.peak,
    velocityScore: rollup.velocityScore,
    stepCount: rollup.stepCount,
    emitsFrequencyFields: 'frequencyScore' in rollup && 'frequencyMatches' in rollup,
    frequencyScore: rollup.frequencyScore,
    frequencyMatches: rollup.frequencyMatches,
  }
}

if (import.meta.main) {
  const detectionPolicy = burstDetectionPolicy()
  const withoutRules = rollupProfile(DEFAULT_RISK_POLICY)
  const withRules = rollupProfile(detectionPolicy)

  // Wholesale replacement: v2 supplies ONE rule and gets exactly that one rule.
  const replacedRules = riskPolicy({
    overrides: {
      policyVersion: 'acme.burst-detection.v2',
      rollup: { frequencyRules: [exportBurst] },
    },
  })
  // Omitting the key keeps whatever the base policy carried (here: none).
  const untouchedRules = riskPolicy({
    overrides: {
      policyVersion: 'acme.burst-detection.v2-window',
      rollup: { windowSeconds: 30 },
    },
  })

  const output = {
    episode: loginBurstEpisode,
    configuredRules: detectionPolicy.rollup.frequencyRules,
    withoutFrequencyRules: withoutRules,
    withFrequencyRules: withRules,
    // The boost is the only reason the episode moved; peak and velocity are
    // identical in both rollups because the steps never changed.
    ruleEffect: {
      scoreBefore: withoutRules.score,
      scoreAfter: withRules.score,
      levelBefore: withoutRules.level,
      levelAfter: withRules.level,
      peakUnchanged: withoutRules.peak === withRules.peak,
      velocityUnchanged: withoutRules.velocityScore === withRules.velocityScore,
      firedBoosts: (withRules.frequencyMatches ?? [])
        .filter((match) => match.fired)
        .map((match) => ({ actions: match.actions, count: match.count, boost: match.boost })),
      unfiredRules: (withRules.frequencyMatches ?? [])
        .filter((match) => !match.fired)
        .map((match) => ({ actions: match.actions, count: match.count, threshold: match.threshold })),
    },
    replacesWholesale: {
      v1Actions: detectionPolicy.rollup.frequencyRules.map((rule) => rule.actions),
      v2Actions: replacedRules.rollup.frequencyRules.map((rule) => rule.actions),
      // A merge would leave 2 (or 3) rules on v2; replacement leaves exactly 1.
      v2RuleCount: replacedRules.rollup.frequencyRules.length,
      v2DroppedLoginRule: replacedRules.rollup.frequencyRules.every(
        (rule) => !rule.actions.includes('auth.login.failed'),
      ),
      // Omitting rollup.frequencyRules keeps the base list untouched.
      omittedKeyKeepsBaseRules: untouchedRules.rollup.frequencyRules.length,
      omittedKeyWindowSeconds: untouchedRules.rollup.windowSeconds,
      // Derivation always starts from DEFAULT_RISK_POLICY, which is never mutated.
      defaultPolicyStillRuleFree: DEFAULT_RISK_POLICY.rollup.frequencyRules.length === 0,
    },
  }

  console.log(JSON.stringify(output, null, 2))
}
