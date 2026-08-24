import {
  type CaptureMode,
  type EvidenceRef,
  createGovernedActionDraft,
  defineEntity,
} from '@veritio/core'

/**
 * Proves the per-field capture policy of a governed-change draft: one entity
 * exercises every capture mode implemented in the v1 state-commitment builder
 * (`omit`, `content_digest`, `keyed_digest`, `full`) and the resulting draft is
 * serialized in full to show that the raw `keyed_digest` value, the host-supplied
 * HMAC secret, and the `omit`-ed field value never reach evidence. The reserved
 * modes (`randomized_digest`, `reference`, `redact`, `encrypt`) are shown failing
 * closed at draft time instead of silently degrading the commitment. Every id,
 * timestamp, and key is pinned so the documented output stays reproducible.
 */

/** Host-boundary key material for `keyed_digest` fields. Never persisted in evidence. */
const DIGEST_SECRET = 'example-tenant-digest-secret-do-not-reuse'
const DIGEST_KEY_VERSION = 'billing-2026-01'

/** Values the proofs below assert are absent from the serialized draft. */
const RAW_EMAIL = 'dana.reyes@example.com'
const OMITTED_NOTE = 'internal churn-risk memo, never leaves the application database'

type SubscriberRow = {
  id: string
  plan: string
  email: string
  billingCity: string
  internalNote: string
}

const subscriber = defineEntity<SubscriberRow>({
  authority: 'example-billing',
  type: 'subscriber',
  schemaRef: 'example.billing.subscriber.v1',
  fieldSetRef: 'example.billing.subscriber.governed.v1',
  identity: (row) => row.id,
  fields: {
    plan: { capture: 'full' },
    email: { capture: 'keyed_digest' },
    billingCity: { capture: 'content_digest' },
    internalNote: { capture: 'omit' },
  },
})

const scope = { tenantId: 'org_acme', environment: 'production' } as const

const initiatedBy: EvidenceRef = {
  authority: 'example-billing',
  kind: 'principal',
  type: 'user',
  id: 'usr_support_agent',
}

const performedBy: EvidenceRef = {
  authority: 'example-billing',
  kind: 'principal',
  type: 'service',
  id: 'svc_billing_api',
}

const before: SubscriberRow = {
  id: 'sub_1042',
  plan: 'starter',
  email: 'dana.old@example.com',
  billingCity: 'Berlin',
  internalNote: 'previous note',
}

const after: SubscriberRow = {
  id: 'sub_1042',
  plan: 'growth',
  email: RAW_EMAIL,
  billingCity: 'Hamburg',
  internalNote: OMITTED_NOTE,
}

/**
 * Builds the governed-change draft for the four implemented capture modes and
 * returns the state commitment together with the leak proofs computed over the
 * fully serialized draft (events, edges, revision, and outbox entry).
 */
export function captureModeDraft() {
  const draft = createGovernedActionDraft<SubscriberRow>({
    scope,
    entity: subscriber,
    before,
    after,
    actionType: 'subscriber.plan.upgraded',
    activityType: 'billing.plan_change',
    initiatedBy,
    performedBy,
    producer: performedBy,
    occurredAt: '2026-08-09T12:00:00.000Z',
    idempotencyKey: 'subscriber:sub_1042:upgrade:0001',
    capturePolicyRef: { id: 'example.billing.capture', version: '1' },
    mutationBinding: 'same_transaction',
    digestKeys: {
      keyedDigest: { keyVersion: DIGEST_KEY_VERSION, secret: DIGEST_SECRET },
    },
  })

  const serializedDraft = JSON.stringify(draft)

  return {
    changedPaths: draft.revision.changedPaths,
    stateCommitmentFields: draft.revision.stateCommitment.fields,
    stateCommitmentDigest: draft.revision.stateCommitment.digest,
    leakProofs: {
      rawEmailAppearsInDraft: serializedDraft.includes(RAW_EMAIL),
      digestSecretAppearsInDraft: serializedDraft.includes(DIGEST_SECRET),
      omittedFieldValueAppearsInDraft: serializedDraft.includes(OMITTED_NOTE),
    },
  }
}

type ReservedRow = { id: string; note: string }

/**
 * Attempts a draft with a RESERVED capture mode to show the builder failing
 * closed rather than emitting a weaker commitment. Returns the error message so
 * the documented output records the exact fail-closed contract.
 */
export function reservedCaptureModeFailure(mode: CaptureMode) {
  const reservedEntity = defineEntity<ReservedRow>({
    authority: 'example-billing',
    type: 'subscriber_note',
    schemaRef: 'example.billing.subscriber_note.v1',
    fieldSetRef: 'example.billing.subscriber_note.governed.v1',
    identity: (row) => row.id,
    fields: { note: { capture: mode } },
  })

  try {
    createGovernedActionDraft<ReservedRow>({
      scope,
      entity: reservedEntity,
      after: { id: 'note_1', note: 'anything' },
      actionType: 'subscriber.note.updated',
      activityType: 'billing.note_change',
      initiatedBy,
      performedBy,
      producer: performedBy,
      occurredAt: '2026-08-09T12:00:00.000Z',
      idempotencyKey: 'subscriber_note:note_1:0001',
    })
    return { mode, failedClosed: false, error: null }
  } catch (error) {
    return {
      mode,
      failedClosed: true,
      error: {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

if (import.meta.main) {
  const reservedModes: CaptureMode[] = ['randomized_digest', 'reference', 'redact', 'encrypt']
  console.log(
    JSON.stringify(
      {
        ...captureModeDraft(),
        reservedCaptureModes: reservedModes.map(reservedCaptureModeFailure),
      },
      null,
      2,
    ),
  )
}
