import { type RiskSignals, normalizeRiskSignals } from '@veritio/core/risk-score'

/**
 * Proves the two halves of the `normalizeRiskSignals` fail-closed contract that
 * the risk docs quote verbatim.
 *
 * 1. Omission is never cheap: an absent `reversibility` normalizes to
 *    `recoverable`, an absent `envCriticality` to `production`, and absent
 *    magnitudes to `0`, so a caller that leaves a signal out can never score
 *    lower than one that states the conservative value explicitly. The input
 *    object is not mutated.
 * 2. Invalid input throws instead of scoring low: unknown enum members and
 *    non-integer / negative / NaN magnitudes raise a `TypeError` rather than
 *    being coerced. The exact messages are printed so the documentation can
 *    show the strings a host application will actually see.
 *
 * Every value here is literal, so the output is byte-stable for CI comparison.
 */

/**
 * One rejected-input probe. `case` is the label the docs show; the signals
 * themselves are not echoed into the output because `NaN` has no faithful JSON
 * form and would print as `null`, which would misdescribe the rejected input.
 */
interface FailClosedCase {
  case: string
  signals: unknown
}

/**
 * Signals that supply only the required `operationType`. Everything the
 * normalizer fills in below is therefore a documented conservative default,
 * not an echo of caller input.
 */
const sparseSignals: RiskSignals = { operationType: 'update' }

/**
 * Rejected inputs, one per fail-closed branch of the normalizer. They are typed
 * as `unknown` because each deliberately violates the `RiskSignals` contract;
 * the cast happens at the single call site below.
 */
const failClosedCases: FailClosedCase[] = [
  { case: 'unknown operationType', signals: { operationType: 'exfiltrate' } },
  { case: 'unknown reversibility', signals: { operationType: 'delete', reversibility: 'undoable' } },
  { case: 'negative dataVolume', signals: { operationType: 'read', dataVolume: -1 } },
  { case: 'fractional fanOut', signals: { operationType: 'update', fanOut: 2.5 } },
  { case: 'NaN referenceCount', signals: { operationType: 'config', referenceCount: Number.NaN } },
]

/**
 * Runs one rejected-input probe and reports the thrown error verbatim. Rethrows
 * anything that is not an `Error` so a silently accepted invalid signal — the
 * failure this fixture exists to catch — surfaces instead of printing a
 * misleading success line.
 */
function captureRejection(probe: FailClosedCase): Record<string, unknown> {
  try {
    normalizeRiskSignals(probe.signals as RiskSignals)
  } catch (error) {
    if (!(error instanceof Error)) throw error
    return { case: probe.case, errorName: error.name, message: error.message }
  }
  throw new Error(`expected normalizeRiskSignals to reject: ${probe.case}`)
}

if (import.meta.main) {
  const output = {
    conservativeDefaults: {
      input: sparseSignals,
      normalized: normalizeRiskSignals(sparseSignals),
      inputUnchanged: JSON.stringify(sparseSignals) === JSON.stringify({ operationType: 'update' }),
    },
    failClosed: failClosedCases.map(captureRejection),
  }
  console.log(JSON.stringify(output, null, 2))
}
