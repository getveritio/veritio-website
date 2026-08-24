import {
  DEFAULT_RISK_POLICY,
  type RiskAssessment,
  type RiskSignals,
  normalizeRiskSignals,
  scoreRiskSignals,
} from '@veritio/core/risk-score'

/**
 * Proves that per-step risk scoring is explainable and reproducible from the
 * crypto-free `@veritio/core/risk-score` subpath alone: no `node:crypto`, no
 * store, no event chain. Three fixed signal sets are scored under
 * `DEFAULT_RISK_POLICY` (`veritio.reference.v1`), and each result carries the
 * same six ordered `factors[]` — operationType base, the three saturating
 * additive magnitude boosts, then the reversibility and environment
 * multipliers. The omitted fields in the first case also show the fail-closed
 * normalization defaults (recoverable / production / magnitude 0), so an
 * absent signal can never score lower than an explicit zero.
 */
export const riskScenarios: ReadonlyArray<{ name: string; signals: RiskSignals }> = [
  {
    name: 'read-config-lookup',
    signals: { operationType: 'read' },
  },
  {
    name: 'bulk-export-staging',
    signals: {
      operationType: 'bulk',
      reversibility: 'reversible',
      envCriticality: 'staging',
      dataVolume: 5000,
      fanOut: 3,
      referenceCount: 12,
    },
  },
  {
    name: 'destructive-drop-production',
    signals: {
      operationType: 'destructive',
      reversibility: 'irreversible',
      envCriticality: 'production',
      dataVolume: 250000,
      fanOut: 40,
      referenceCount: 180,
    },
  },
]

/**
 * Scores every pinned scenario and returns the input signals, the fail-closed
 * normalized signals, and the full assessment. Pure and deterministic: the
 * output depends only on the fixed inputs and the policy constants, which is
 * what makes this fixture byte-comparable in CI.
 */
export function explainRiskScenarios(): Array<{
  name: string
  signals: RiskSignals
  normalized: RiskSignals
  assessment: RiskAssessment
}> {
  return riskScenarios.map(({ name, signals }) => ({
    name,
    signals,
    normalized: normalizeRiskSignals(signals),
    assessment: scoreRiskSignals(signals, DEFAULT_RISK_POLICY),
  }))
}

if (import.meta.main) {
  const scenarios = explainRiskScenarios()
  console.log(
    JSON.stringify(
      {
        policyVersion: DEFAULT_RISK_POLICY.policyVersion,
        bands: DEFAULT_RISK_POLICY.bands,
        factorOrder: scenarios[0]?.assessment.factors.map((factor) => factor.key),
        scenarios,
      },
      null,
      2,
    ),
  )
}
