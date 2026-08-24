import {
  type AuditRecord,
  HASH_ALGORITHM,
  type SecurityRiskAssertion,
  buildSecurityRiskAssessedEvent,
  createAuditEvent,
  createSecurityRiskAssertion,
  hashAssertionRecord,
  hashAuditRecord,
  hashIdempotencyKey,
  verifyAuditRecords,
} from '@veritio/core'
import { DEFAULT_RISK_POLICY, type RiskSignals, scoreRiskSignals } from '@veritio/core/risk-score'

/**
 * Proves the three-step security.risk assertion path and the hashing invariant
 * that makes an assertion verifiable next to an audit record:
 *
 * - `createSecurityRiskAssertion` only STAMPS an envelope. It never recomputes a
 *   score: the conclusion comes from `scoreRiskSignals`, the producer authority
 *   is forced to `veritio.detectors` so a detector cannot forge a different
 *   evidence authority, and the raw idempotency key is tenant-scoped hashed
 *   (`hashIdempotencyKey`) rather than stored.
 * - `hashAssertionRecord` is parity with `hashAuditRecord`: both are bare
 *   lowercase SHA-256 hex over the canonical JSON of the record MINUS its own
 *   `hash` field. This fixture proves that by hashing each record in both its
 *   unhashed and its persisted (hash-carrying) form and showing one digest, and
 *   by showing that overwriting the stored `hash` with a tampered value does not
 *   change the recomputed digest — a persisted digest can never feed back into
 *   its own recomputation.
 * - `buildSecurityRiskAssessedEvent` derives the queryable `security.risk.assessed`
 *   event from the same conclusion: the subject becomes the event target, the
 *   producer becomes a service actor, and `activityEpisodeId` is stamped AFTER
 *   caller metadata so a host can never shadow the key read models group on.
 *
 * Every id, timestamp, idempotency key, sequence, and `appendedAt` is pinned, so
 * the printed digests are byte-stable across runs and across the TS/Python/Go
 * SDKs. A real deployment lets a conforming `AuditStore` assign `sequence`,
 * `previousHash`, and `appendedAt`; they are pinned here only so the documented
 * hashes stay reproducible.
 */
export const riskScope = { tenantId: 'org_acme', environment: 'production' } as const

/** The subject the risk conclusion is about: one governed change in the evidence graph. */
export const riskSubject = {
  authority: 'acme-billing',
  kind: 'change',
  type: 'subscription',
  id: 'chg_subscription_sub_9f31_4d21c0',
} as const

/** Pinned signals for the assessed step: an irreversible production bulk delete. */
export const riskSignals: RiskSignals = {
  operationType: 'destructive',
  reversibility: 'irreversible',
  envCriticality: 'production',
  dataVolume: 4200,
  fanOut: 6,
  referenceCount: 18,
}

/**
 * Scores the pinned step and stamps the append-only assertion envelope. The
 * assertion carries the conclusion produced by the scorer verbatim, so the
 * envelope stays a record of a decision rather than a second scoring engine.
 */
export function buildRiskAssertion(): SecurityRiskAssertion {
  const assessment = scoreRiskSignals(riskSignals, DEFAULT_RISK_POLICY)

  return createSecurityRiskAssertion({
    id: 'asr_risk_sub_9f31_01',
    scope: riskScope,
    occurredAt: '2026-08-09T10:00:00.000Z',
    producerId: 'svc_risk_detector',
    subject: riskSubject,
    idempotencyKey: 'security.risk:chg_subscription_sub_9f31_4d21c0:step',
    conclusion: {
      score: assessment.score,
      level: assessment.level,
      policyVersion: assessment.policyVersion,
      assessment: 'step',
    },
    factors: assessment.factors,
  })
}

/**
 * Builds the audit record the assertion sits beside, in the exact shape a
 * conforming `AuditStore` persists. `hash` is computed with `hashAuditRecord`
 * over the record minus its own hash field — the same rule `hashAssertionRecord`
 * applies to the assertion envelope.
 */
export function buildAssessedAuditRecord(assertion: SecurityRiskAssertion): AuditRecord {
  const eventInput = buildSecurityRiskAssessedEvent({
    scope: riskScope,
    occurredAt: '2026-08-09T10:00:00.000Z',
    producerId: 'svc_risk_detector',
    subject: riskSubject,
    conclusion: assertion.conclusion,
    factors: assertion.factors,
    riskSignals,
    activityEpisodeId: 'aep_billing_upgrade_01',
    metadata: { assertionId: assertion.id },
  })

  const event = createAuditEvent({ ...eventInput, id: 'evt_risk_assessed_01' })
  const idempotencyKey = 'security.risk.assessed:chg_subscription_sub_9f31_4d21c0'

  const unhashed: Omit<AuditRecord, 'hash'> = {
    event,
    sequence: 1,
    previousHash: null,
    hashAlgorithm: HASH_ALGORITHM,
    canonicalization: 'veritio-json-v1',
    appendedAt: '2026-08-09T10:00:00.500Z',
    idempotencyKeyHash: hashIdempotencyKey(riskScope.tenantId, idempotencyKey),
  }

  return { ...unhashed, hash: hashAuditRecord(unhashed) }
}

if (import.meta.main) {
  const assertion = buildRiskAssertion()
  const assertionHash = hashAssertionRecord(assertion)
  const record = buildAssessedAuditRecord(assertion)

  // The persisted forms: each record as it is stored, carrying its own digest.
  const persistedAssertion = { ...assertion, hash: assertionHash } as SecurityRiskAssertion
  const tamperedAssertion = { ...assertion, hash: 'sha256:not-the-real-digest' } as SecurityRiskAssertion
  const tamperedRecord: AuditRecord = { ...record, hash: 'sha256:not-the-real-digest' }

  const output = {
    assertion,
    assertionHash,
    assessedEvent: record.event,
    auditRecord: record,
    hashParity: {
      note: 'hashAssertionRecord and hashAuditRecord both hash the canonical JSON of the record with its own `hash` field excluded, and emit bare lowercase sha256 hex.',
      // The idempotency key is never stored raw; only its tenant-scoped hash is.
      rawIdempotencyKeyStored: 'idempotencyKey' in assertion,
      assertion: {
        digest: assertionHash,
        // Re-hashing the persisted form reproduces the same digest...
        recomputedFromPersistedForm: hashAssertionRecord(persistedAssertion) === assertionHash,
        // ...and a tampered stored hash cannot change its own recomputation.
        tamperedStoredHashIgnored: hashAssertionRecord(tamperedAssertion) === assertionHash,
        bareLowercaseSha256Hex: /^[0-9a-f]{64}$/.test(assertionHash),
      },
      auditRecord: {
        digest: record.hash,
        recomputedFromPersistedForm: hashAuditRecord(record) === record.hash,
        tamperedStoredHashIgnored: hashAuditRecord(tamperedRecord) === record.hash,
        bareLowercaseSha256Hex: /^[0-9a-f]{64}$/.test(record.hash),
      },
      // Both digests cover different records, so they must not collide.
      digestsDiffer: assertionHash !== record.hash,
      chainVerification: verifyAuditRecords([record]),
      tamperedChainVerification: verifyAuditRecords([tamperedRecord]),
    },
  }

  console.log(JSON.stringify(output, null, 2))
}
