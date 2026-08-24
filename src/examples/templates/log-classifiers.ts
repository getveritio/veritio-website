import {
  type AuditLogClassificationInput,
  type AuditLogClassifiers,
  auditLogClassificationMetadata,
  auditLogSurfaceValues,
  auditLogVisibilityValues,
  detectAuditLogClassifiers,
  normalizeAuditLogSurface,
  normalizeAuditLogVisibility,
} from '@veritio/core'

/**
 * Proves the audit-log classifier round-trip in `@veritio/core` 0.4.7:
 * `auditLogClassificationMetadata` writes visibility/surface into metadata and
 * `detectAuditLogClassifiers` reads exactly the same classification back out.
 *
 * Three invariants are exercised:
 *
 * - LOSSLESS ROUND-TRIP. For every visibility/surface combination —
 *   canonical, aliased, cased, punctuated, or partially supplied —
 *   `detectAuditLogClassifiers(auditLogClassificationMetadata(input))` equals
 *   the independently normalized `{ visibility, surface }`. Nothing is added
 *   and nothing is dropped, so a facet built from metadata agrees with a facet
 *   built from the caller's raw labels.
 * - CLASSIFICATION IS METADATA, NOT PROTOCOL. The writer emits only the
 *   `logVisibility` / `logSurface` metadata keys. Visibility and surface never
 *   become core event fields, so hosted filters can exist without widening the
 *   protocol.
 * - UNKNOWN LABELS FAIL CLOSED. `normalizeAuditLogVisibility` and
 *   `normalizeAuditLogSurface` return `undefined` for unrecognized strings and
 *   for non-strings, and the writer then omits the key entirely rather than
 *   passing an uncontrolled label through into evidence metadata.
 *
 * A final section shows that detection also reads common host aliases
 * (`audience`, `client.type`, nested `auditLog`), which is what lets the same
 * detector classify historic rows that predate the normalized keys. That
 * direction is deliberately one-way: only the normalized keys are written.
 *
 * Every input label is a literal, so the printed output is byte-stable.
 */

/** One round-trip case: raw caller labels plus a human-readable reason. */
interface RoundTripCase {
  readonly label: string
  readonly input: AuditLogClassificationInput
}

const roundTripCases: RoundTripCase[] = [
  {
    label: 'canonical values pass through unchanged',
    input: { visibility: 'internal', surface: 'api' },
  },
  {
    label: 'aliases with casing and punctuation collapse to canonical values',
    input: { visibility: 'User-Facing', surface: 'GraphQL' },
  },
  {
    label: 'partner and worker aliases',
    input: { visibility: 'Third Party', surface: 'cron' },
  },
  {
    label: 'system and webhook aliases',
    input: { visibility: 'automation', surface: 'callback' },
  },
  {
    label: 'visibility only — surface key is omitted, not emitted as null',
    input: { visibility: 'staff' },
  },
  {
    label: 'surface only — visibility key is omitted, not emitted as null',
    input: { surface: 'terminal' },
  },
  {
    label: 'unrecognized labels are dropped on both sides',
    input: { visibility: 'confidential', surface: 'sms' },
  },
]

/**
 * Normalizes the caller's raw labels independently of the metadata writer, so
 * the round-trip comparison is a real cross-check rather than the detector
 * agreeing with itself.
 */
function expectedClassifiers(input: AuditLogClassificationInput): AuditLogClassifiers {
  const visibility = normalizeAuditLogVisibility(input.visibility)
  const surface = normalizeAuditLogSurface(input.surface)
  return {
    ...(visibility ? { visibility } : {}),
    ...(surface ? { surface } : {}),
  }
}

/**
 * Compares two classifier bags key-by-key rather than by object identity, so a
 * present-but-undefined key would be reported as a mismatch instead of being
 * silently treated as equal.
 */
function classifiersMatch(left: AuditLogClassifiers, right: AuditLogClassifiers): boolean {
  return (
    left.visibility === right.visibility &&
    left.surface === right.surface &&
    Object.keys(left).sort().join(',') === Object.keys(right).sort().join(',')
  )
}

/**
 * Runs one case end to end: write metadata, read classifiers back, and report
 * both sides next to the lossless verdict the documentation page cites.
 */
function runRoundTrip(testCase: RoundTripCase): Record<string, unknown> {
  const metadata = auditLogClassificationMetadata(testCase.input)
  const detected = detectAuditLogClassifiers(metadata)
  const expected = expectedClassifiers(testCase.input)
  return {
    case: testCase.label,
    input: testCase.input,
    metadata,
    // Only the two normalized keys are ever written — classification stays in
    // metadata and never becomes a core protocol field.
    metadataKeys: Object.keys(metadata).sort(),
    detected,
    expected,
    lossless: classifiersMatch(detected, expected),
  }
}

/** Values that must never normalize to a classifier, including non-strings. */
const rejectedVisibilityInputs: readonly unknown[] = [
  'confidential',
  'restricted',
  '',
  '   ',
  42,
  null,
  undefined,
  ['internal'],
]

const rejectedSurfaceInputs: readonly unknown[] = [
  'sms',
  'fax',
  'kiosk',
  '',
  7,
  null,
  undefined,
  { surface: 'api' },
]

/**
 * Renders a rejection probe as JSON-safe text. `undefined` and non-plain values
 * would otherwise vanish from `JSON.stringify`, hiding the non-string cases the
 * fail-closed rule exists for.
 */
function describeInput(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (value === undefined) {
    return 'undefined'
  }
  if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
    return JSON.stringify(value)
  }
  return String(value)
}

/**
 * Probes one normalizer with a value that must not classify, and reports the
 * writer's behavior for the same value: an unrecognized label produces no
 * metadata key at all.
 */
function runRejection(
  field: 'visibility' | 'surface',
  value: unknown,
): Record<string, unknown> {
  const normalized =
    field === 'visibility'
      ? normalizeAuditLogVisibility(value)
      : normalizeAuditLogSurface(value)
  const metadata = auditLogClassificationMetadata(
    field === 'visibility'
      ? { visibility: typeof value === 'string' ? value : null }
      : { surface: typeof value === 'string' ? value : null },
  )
  return {
    field,
    input: describeInput(value),
    normalized: normalized ?? null,
    rejected: normalized === undefined,
    metadataKeys: Object.keys(metadata),
  }
}

/**
 * Legacy metadata shapes the detector still classifies. These are read-only
 * aliases: the writer never emits them, so this direction is not part of the
 * round-trip guarantee above.
 */
const hostAliasSamples: readonly { label: string; metadata: Record<string, unknown> }[] = [
  {
    label: 'flat host aliases (audience / channel)',
    metadata: { audience: 'customer', channel: 'browser' },
  },
  {
    label: 'nested auditLog bag',
    metadata: { auditLog: { visibility: 'vendor', channel: 'hook' } },
  },
  {
    label: 'client descriptor from a request logger',
    metadata: { client: { type: 'cli' }, exposure: 'ops' },
  },
  {
    label: 'metadata with no classifier hints at all',
    metadata: { role: 'viewer', requestId: 'req_7c2a' },
  },
]

if (import.meta.main) {
  const roundTrips = roundTripCases.map(runRoundTrip)
  const rejections = [
    ...rejectedVisibilityInputs.map((value) => runRejection('visibility', value)),
    ...rejectedSurfaceInputs.map((value) => runRejection('surface', value)),
  ]

  const output = {
    vocabulary: {
      visibility: auditLogVisibilityValues,
      surface: auditLogSurfaceValues,
    },
    roundTrips,
    allRoundTripsLossless: roundTrips.every((result) => result.lossless === true),
    rejections,
    allUnknownValuesRejected: rejections.every((result) => result.rejected === true),
    hostAliasDetection: hostAliasSamples.map((sample) => ({
      case: sample.label,
      metadata: sample.metadata,
      detected: detectAuditLogClassifiers(sample.metadata),
    })),
    undefinedMetadataDetectsNothing: detectAuditLogClassifiers(undefined),
  }

  console.log(JSON.stringify(output, null, 2))
}
