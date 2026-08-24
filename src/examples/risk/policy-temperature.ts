import {
  DEFAULT_RISK_POLICY,
  type RiskScoringPolicy,
  type RiskSignals,
  riskPolicy,
  scoreRiskSignals,
} from '@veritio/core/risk-score'

/**
 * One fixed signal set scored under every temperature so the documented table
 * shows only the policy changing, never the input. Deliberately exercises all
 * three temperature-scaled scoring fields (magnitude maxBoost, the irreversible
 * multiplier, the production multiplier) and is sized to land mid-range, so the
 * same signals cross bands instead of saturating at 1.0 everywhere.
 */
export const auditedSignals: RiskSignals = {
  operationType: 'update',
  reversibility: 'irreversible',
  envCriticality: 'production',
  dataVolume: 120,
  fanOut: 5,
  referenceCount: 8,
}

/** Temperatures documented on the risk-policy page, lenient through strict. */
export const documentedTemperatures = [0, 0.2, 0.5, 0.8, 1] as const

/**
 * Projects the fields `riskPolicy({ temperature })` actually rescales. Keeping
 * this projection explicit is the point of the fixture: it proves the knob
 * touches only bands, rollup decay/velocity, magnitude maxBoost, and the
 * irreversible/production multipliers, and leaves every other pinned constant
 * (operation bases, weights, k, windowSeconds) untouched.
 */
export function temperatureProfile(policy: RiskScoringPolicy) {
  const assessment = scoreRiskSignals(auditedSignals, policy)
  return {
    policyVersion: policy.policyVersion,
    bands: policy.bands,
    rollup: {
      windowSeconds: policy.rollup.windowSeconds,
      decayPerWindow: policy.rollup.decayPerWindow,
      velocityNormalizer: policy.rollup.velocityNormalizer,
      frequencyRuleCount: policy.rollup.frequencyRules.length,
    },
    scaledMultipliers: {
      magnitudeMaxBoost: policy.magnitude.maxBoost,
      irreversibleFactor: policy.reversibilityFactor.irreversible,
      productionFactor: policy.envCriticalityFactor.production,
    },
    fixedSignalScore: { score: assessment.score, level: assessment.level },
  }
}

/**
 * Compares a derived policy against `DEFAULT_RISK_POLICY` on every field except
 * `policyVersion`, which is expected to carry the deterministic "+temp0.50"
 * suffix. This is the invariant the fixture asserts: temperature 0.5 is the
 * reference policy byte-for-byte, so a hosted retune of the endpoints cannot
 * silently move the documented default.
 */
export function matchesReferenceConstants(policy: RiskScoringPolicy): boolean {
  const strip = ({ policyVersion: _ignored, ...rest }: RiskScoringPolicy) => rest
  return JSON.stringify(strip(policy)) === JSON.stringify(strip(DEFAULT_RISK_POLICY))
}

/**
 * Renders the rejection for a temperature the protocol refuses, so the docs can
 * show that the knob fails closed instead of rounding a caller's value into a
 * policyVersion string that would misdescribe the constants behind a hashed
 * risk conclusion.
 */
export function rejection(temperature: number): { temperature: number; error: string } {
  try {
    riskPolicy({ temperature })
    return { temperature, error: 'accepted (unexpected)' }
  } catch (error) {
    return { temperature, error: (error as Error).message }
  }
}

if (import.meta.main) {
  const referencePolicy = riskPolicy({ temperature: 0.5 })
  const output = {
    signals: auditedSignals,
    profiles: documentedTemperatures.map((temperature) => ({
      temperature,
      ...temperatureProfile(riskPolicy({ temperature })),
    })),
    referenceInvariant: {
      defaultPolicyVersion: DEFAULT_RISK_POLICY.policyVersion,
      derivedPolicyVersion: referencePolicy.policyVersion,
      constantsMatchDefault: matchesReferenceConstants(referencePolicy),
    },
    rejections: [rejection(0.005), rejection(1.5)],
  }

  if (!matchesReferenceConstants(referencePolicy)) {
    throw new Error('temperature 0.5 must reproduce DEFAULT_RISK_POLICY constants exactly')
  }

  console.log(JSON.stringify(output, null, 2))
}
