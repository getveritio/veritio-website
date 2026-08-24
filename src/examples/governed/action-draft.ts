import {
  type GovernedChangeDraft,
  createGovernedActionDraft,
  defineEntity,
} from '@veritio/core'

/**
 * Proves the governed-action draft invariants a host application depends on at
 * its mutation boundary:
 *
 * - `defineEntity` is the only place field capture is decided: an `omit` field
 *   can never reach the state commitment, and a `content_digest` field is
 *   committed as a digest rather than a raw value, so the outbox never becomes
 *   a copy of the application row.
 * - `createGovernedActionDraft` derives the change id and the activity id from
 *   ONE seed — sha256(`tenantId:idempotencyKey`) — so a replayed mutation
 *   reproduces the same change/activity pair instead of forking the graph.
 * - Changed paths are inferred only from governed fields, and the draft emits
 *   three event actions plus four edge relations.
 * - The draft is INPUT ONLY. It carries no store-assigned sequence and no
 *   record hash; nothing exists as evidence until a conforming `AuditStore`
 *   appends it.
 *
 * Every id, timestamp, and idempotency key is pinned so the printed output is
 * byte-stable across runs and across the TS/Python/Go SDKs.
 */
type SubscriptionRow = {
  id: string
  accountEmail: string
  plan: string
  seatCount: number
  status: string
  internalNotes: string
}

export const governedScope = { tenantId: 'org_acme', environment: 'production' } as const

const subscription = defineEntity<SubscriptionRow>({
  authority: 'acme-billing',
  type: 'subscription',
  schemaRef: 'acme://schemas/subscription@3',
  fieldSetRef: 'acme://fieldsets/subscription-governed@1',
  identity: (row) => row.id,
  fields: {
    id: { capture: 'full' },
    plan: { capture: 'full' },
    seatCount: { capture: 'full' },
    status: { capture: 'full' },
    // PII stays out of evidence as a value; only its digest is committed.
    accountEmail: { capture: 'content_digest' },
    // Ungoverned operator prose never enters the commitment or changed paths.
    internalNotes: { capture: 'omit' },
  },
})

const before: SubscriptionRow = {
  id: 'sub_9f31',
  accountEmail: 'billing@acme.example',
  plan: 'team',
  seatCount: 12,
  status: 'active',
  internalNotes: 'renewal call scheduled',
}

const after: SubscriptionRow = {
  ...before,
  plan: 'enterprise',
  seatCount: 25,
  internalNotes: 'upgrade approved on the renewal call',
}

/**
 * Builds the pinned upgrade draft shared by the documentation page and this
 * fixture's byte-compared output. Kept as an exported function so the docs can
 * show one call site while CI re-runs the identical derivation.
 */
export function buildSubscriptionUpgradeDraft(): GovernedChangeDraft {
  return createGovernedActionDraft({
    scope: governedScope,
    entity: subscription,
    before,
    after,
    actionType: 'subscription.upgraded',
    activityType: 'billing.plan_change',
    initiatedBy: { authority: 'acme-billing', kind: 'principal', type: 'user', id: 'usr_owner' },
    performedBy: { authority: 'acme-billing', kind: 'principal', type: 'service', id: 'svc_billing_api' },
    producer: { authority: 'acme-billing', kind: 'principal', type: 'service', id: 'svc_billing_api' },
    occurredAt: '2026-08-09T10:00:00.000Z',
    idempotencyKey: 'subscription.upgraded:sub_9f31:req_7c2a',
    mutationBinding: 'same_transaction',
  })
}

if (import.meta.main) {
  const draft = buildSubscriptionUpgradeDraft()
  const idSeed = draft.changeRef.id.slice(draft.changeRef.id.lastIndexOf('_') + 1)

  const output = {
    derivedIds: {
      changeId: draft.changeRef.id,
      activityId: draft.activityRef.id,
      entityId: draft.entityRef.id,
      revisionId: draft.revision.ref.id,
      idSeed,
      // Both ids are `<prefix>_<entityType>_<entityId>_<seed>` off the same
      // sha256(tenantId:idempotencyKey) seed, so replay is idempotent.
      changeAndActivityShareOneSeed:
        draft.changeRef.id === `chg_subscription_${draft.entityRef.id}_${idSeed}` &&
        draft.activityRef.id === `act_subscription_${draft.entityRef.id}_${idSeed}`,
    },
    changedPaths: draft.revision.changedPaths,
    stateCommitment: {
      algorithm: draft.revision.stateCommitment.algorithm,
      canonicalization: draft.revision.stateCommitment.canonicalization,
      schemaRef: draft.revision.stateCommitment.schemaRef,
      fieldSetRef: draft.revision.stateCommitment.fieldSetRef,
      digest: draft.revision.stateCommitment.digest,
      committedFields: Object.keys(draft.revision.stateCommitment.fields).sort(),
      // `internalNotes` is declared `omit`, so it is absent from the commitment
      // and can never become a governed changed path.
      omittedFieldPresent: 'internalNotes' in draft.revision.stateCommitment.fields,
      accountEmailCommitment: draft.revision.stateCommitment.fields.accountEmail,
    },
    eventActions: draft.events.map((event) => event.action),
    edgeRelations: draft.edges.map((edge) => edge.relation),
    draftIsInputOnly: {
      note: 'createGovernedActionDraft returns evidence INPUTS, not persisted records. Append draft.outboxEntry through a conforming AuditStore inside the same mutation to make it evidence.',
      eventsCarryStoreAssignedSequence: draft.events.some((event) => 'sequence' in event),
      eventsCarryRecordHash: draft.events.some((event) => 'hash' in event),
      outboxMutationBinding: draft.outboxEntry.mutationBinding,
      outboxSchemaVersion: draft.outboxEntry.schemaVersion,
    },
  }

  console.log(JSON.stringify(output, null, 2))
}
