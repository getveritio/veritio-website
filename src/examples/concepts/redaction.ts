import {
  type AuditEvent,
  type AuditEventInput,
  type JsonObject,
  canonicalJson,
  createAuditEvent,
  hashAuditEvent,
} from '@veritio/core'

/**
 * Proves the metadata-redaction invariants every Veritio SDK must preserve:
 *
 * - Redaction happens INSIDE `createAuditEvent`, before canonical JSON and
 *   before hashing. There is no separate "redact later" step a caller can skip,
 *   and no exported redaction helper to call out of order.
 * - Redaction is decided by KEY NAME ONLY, case-insensitively, on a substring
 *   match against the sensitive-key families (password, secret, token, apiKey /
 *   api_key, authorization, email, phone, ssn). The VALUE is never inspected, so
 *   the decision cannot vary with payload shape or length.
 * - Matching is recursive: nested objects are walked, and a sensitive key
 *   replaces its whole subtree (arrays and objects included) with the stable
 *   marker `[redacted]`.
 * - The single carve-out is a minimized digest envelope: `{ algorithm, digest }`
 *   (and `{ captureMode, digest }`) survives under a sensitive key so governed
 *   revision evidence stays useful for fields like `customerEmail` — but any
 *   sibling raw value riding along inside that envelope is stripped.
 * - Redaction is deterministic: the same input produces byte-identical canonical
 *   JSON and the same event hash on every run.
 * - A secret-shaped value therefore cannot reach the hash. Two events that
 *   differ ONLY in the raw value under a sensitive key hash identically, and the
 *   raw value never appears in the canonical bytes that are hashed.
 *
 * Every id and timestamp is pinned so the printed output is byte-stable across
 * runs. The `[redacted]` marker and the key families are protocol-level
 * behavior shared by the TypeScript, Python, and Go SDKs.
 */

export const redactionScope = { tenantId: 'org_acme', environment: 'production' } as const

/**
 * Fake credential-shaped value used to prove that a secret never influences the
 * hashed bytes. It is not a real key and is deliberately distinctive so a
 * substring search over the canonical JSON is a meaningful check.
 */
const FAKE_SECRET = 'sk_live_NOT_A_REAL_KEY_0000000000'

/**
 * A second fake credential of a different length and shape. If redaction were
 * value-dependent or incomplete, swapping this in would change the event hash.
 */
const OTHER_FAKE_SECRET = 'ghp_alsoNotReal_1111'

/**
 * Precomputed content digest standing in for a governed field commitment. Only
 * a value matching `sha256:<64 lowercase hex>` is eligible for the digest
 * envelope carve-out, so this literal is what makes the carve-out observable.
 */
const EMAIL_DIGEST = 'sha256:3f79bb7b435b05321651daefd374cdc681dc06faa65e374e38337b88ca046dea'

/**
 * Builds the pinned audit-event input whose metadata mixes sensitive and safe
 * keys. Returned fresh on each call so "same input twice" is a real repeat of
 * the derivation rather than a reuse of an already-redacted object.
 */
function buildProbeInput(): AuditEventInput {
  return {
    id: 'evt_redaction_probe_01',
    occurredAt: '2026-08-09T10:00:00.000Z',
    actor: { type: 'service', id: 'svc_billing_api' },
    action: 'billing.invoice.issued',
    target: { type: 'invoice', id: 'inv_4821' },
    scope: redactionScope,
    purpose: 'billing',
    lawfulBasis: 'contract',
    retention: 'financial_7y',
    metadata: {
      // --- sensitive key families: value replaced by the marker ---
      password: 'hunter2',
      clientSecret: FAKE_SECRET,
      accessToken: FAKE_SECRET,
      apiKey: FAKE_SECRET,
      api_key: FAKE_SECRET,
      'x-api-key': FAKE_SECRET,
      AUTHORIZATION: 'Bearer abcdef',
      customerEmail: 'billing@acme.example',
      phoneNumber: '+1-555-0100',
      ssn: '000-00-0000',
      // Substring matching is deliberate over-redaction: an innocent key that
      // merely CONTAINS a family name is still redacted. Callers who need this
      // value must rename the key.
      tokenizerVersion: '3',
      // A sensitive key replaces its ENTIRE subtree, not just leaf strings.
      secretRotation: { previousKeyId: 'key_a', rotatedAtSequence: 41 },
      apiKeys: ['primary', 'standby'],
      // --- recursion: sensitive keys are found at any depth ---
      request: {
        method: 'POST',
        route: '/v1/invoices',
        headers: { authorization: 'Bearer abcdef', 'content-type': 'application/json' },
      },
      recipients: [{ id: 'usr_owner', email: 'owner@acme.example' }],
      // --- digest envelope carve-out under a sensitive key ---
      billingEmailCommitment: { algorithm: 'sha256', digest: EMAIL_DIGEST },
      // Same carve-out, but a raw value smuggled in as a sibling is stripped.
      contactEmailCommitment: {
        algorithm: 'sha256',
        digest: EMAIL_DIGEST,
        value: 'contact@acme.example',
      },
      // --- safe keys: preserved verbatim ---
      invoiceNumber: 'INV-4821',
      currency: 'EUR',
      amountCents: 129900,
      seatCount: 25,
      dunningStage: null,
      // Recorder-stamped grouping keys are non-PII by contract and must NOT
      // match the sensitive-key pattern, or provenance grouping would break.
      sessionId: 'ses_7c2a',
      activityEpisodeId: 'aep_7c2a',
    },
  }
}

/**
 * Runs the pinned probe through `createAuditEvent`. Exported so the docs page
 * can show one call site while CI re-runs the identical derivation.
 */
export function buildRedactionProbeEvent(): AuditEvent {
  return createAuditEvent(buildProbeInput())
}

/**
 * Builds the same event with one metadata key carrying the supplied value, used
 * to show that the hash depends on the KEY being sensitive, not on the value.
 */
function buildSecretVariant(value: string): AuditEvent {
  return createAuditEvent({
    id: 'evt_redaction_variant_01',
    occurredAt: '2026-08-09T10:00:00.000Z',
    actor: { type: 'service', id: 'svc_billing_api' },
    action: 'billing.invoice.issued',
    target: { type: 'invoice', id: 'inv_4821' },
    scope: redactionScope,
    metadata: { apiKey: value, invoiceNumber: 'INV-4821' },
  })
}

if (import.meta.main) {
  const before = buildProbeInput().metadata as JsonObject
  const first = buildRedactionProbeEvent()
  const second = buildRedactionProbeEvent()

  const firstCanonical = canonicalJson(first)
  const secondCanonical = canonicalJson(second)
  const after = first.metadata

  // Classify each top-level metadata key by whether its value survived intact.
  const keyOutcomes: Record<string, string> = {}
  for (const key of Object.keys(before).sort()) {
    const redactedValue = after[key]
    if (redactedValue === '[redacted]') {
      keyOutcomes[key] = 'redacted'
    } else if (canonicalJson(redactedValue) === canonicalJson(before[key])) {
      keyOutcomes[key] = 'preserved'
    } else {
      keyOutcomes[key] = 'rewritten'
    }
  }

  const withRealSecret = buildSecretVariant(FAKE_SECRET)
  const withOtherSecret = buildSecretVariant(OTHER_FAKE_SECRET)
  const withMarkerAlready = buildSecretVariant('[redacted]')

  const output = {
    sensitiveKeyFamilies: [
      'password',
      'secret',
      'token',
      'apiKey / api_key / api-key',
      'authorization',
      'email',
      'phone',
      'ssn',
    ],
    matching: {
      note: 'Case-insensitive SUBSTRING match on the KEY NAME only. The value is never inspected.',
      redactionMarker: '[redacted]',
    },
    keyOutcomes,
    beforeMetadata: before,
    afterMetadata: after,
    subtreeReplacement: {
      note: 'A sensitive key replaces its whole subtree, so nested objects and arrays cannot leak a value through a sensitive parent.',
      secretRotation: after.secretRotation,
      apiKeys: after.apiKeys,
    },
    recursion: {
      note: 'Nested objects are walked, so a sensitive key is caught at any depth. Object keys are also sorted into canonical order.',
      requestHeaders: (after.request as JsonObject).headers,
      recipients: after.recipients,
    },
    digestEnvelopeCarveOut: {
      note: 'Only a minimized { algorithm, digest } envelope survives a sensitive key, keeping governed field commitments usable. Any sibling raw value inside the envelope is stripped.',
      billingEmailCommitment: after.billingEmailCommitment,
      contactEmailCommitment: after.contactEmailCommitment,
      rawSiblingStripped: !canonicalJson(after.contactEmailCommitment).includes(
        'contact@acme.example',
      ),
    },
    determinism: {
      canonicalJsonIdentical: firstCanonical === secondCanonical,
      hashIdentical: hashAuditEvent(first) === hashAuditEvent(second),
      eventHash: hashAuditEvent(first),
    },
    secretNeverReachesTheHash: {
      note: 'Redaction runs inside createAuditEvent, before canonical JSON and before hashing, so the raw value is absent from the hashed bytes and cannot move the hash.',
      rawSecretInCanonicalBytes: firstCanonical.includes(FAKE_SECRET),
      realSecretHash: hashAuditEvent(withRealSecret),
      differentSecretHash: hashAuditEvent(withOtherSecret),
      preRedactedHash: hashAuditEvent(withMarkerAlready),
      hashUnchangedByTheSecretValue:
        hashAuditEvent(withRealSecret) === hashAuditEvent(withOtherSecret) &&
        hashAuditEvent(withRealSecret) === hashAuditEvent(withMarkerAlready),
    },
  }

  console.log(JSON.stringify(output, null, 2))
}
