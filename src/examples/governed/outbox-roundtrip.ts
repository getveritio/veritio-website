import {
  type AuditEventInput,
  type AuditRecord,
  type EvidenceEdgeInput,
  type EvidenceEdgeRecord,
  MemoryAuditStore,
  createAuditEvent,
  createEvidenceEdge,
  createGovernedActionDraft,
  defineEntity,
  hashEvidenceEdgeRecord,
  hashIdempotencyKey,
  verifyAuditRecords,
  verifyEvidenceEdgeRecords,
} from '@veritio/core'
import {
  type OutboxEvidenceTarget,
  type OutboxPayload,
  dispatchOutboxEntry,
  outboxPayloadByteLength,
} from '@veritio/storage'

/**
 * Proves that `draft.outboxEntry` is a self-sufficient transactional handoff:
 * the host commits its own row and the serialized entry together, and a later
 * drain reconstructs the full evidence graph without re-reading application
 * state. The invariant under test is that draining is pure replay — dispatching
 * the same stored entry twice adds no records, because both evidence sinks key
 * on record ids, so an at-least-once queue cannot inflate a tenant chain.
 *
 * Record hashes and `appendedAt` are omitted from the printed output on
 * purpose: `MemoryAuditStore` stamps wall-clock append times into the record
 * envelope it hashes, so only sequences, ordering, and verification results are
 * byte-stable across runs.
 */

const scope = { tenantId: 'org_acme', environment: 'production' } as const

/** Application row shape the host owns; only declared fields reach evidence. */
type InvoiceRow = {
  id: string
  status: string
  amountCents: number
  currency: string
  customerEmail: string
}

const invoiceEntity = defineEntity<InvoiceRow>({
  authority: 'acme-billing',
  type: 'invoice',
  schemaRef: 'acme.billing.invoice.v1',
  fieldSetRef: 'acme.billing.invoice.governed.v1',
  identity: (row) => row.id,
  fields: {
    id: { capture: 'full' },
    status: { capture: 'full' },
    amountCents: { capture: 'full' },
    currency: { capture: 'full' },
    customerEmail: { capture: 'content_digest' },
  },
})

/** One durable queue row: the host stores the payload as opaque bytes. */
type QueuedOutboxRow = {
  id: string
  tenantId: string
  status: 'pending' | 'dispatched'
  payloadJson: string
}

/**
 * Drains one serialized queue row into local evidence sinks. The row is parsed
 * back into an `OutboxPayload` first, proving the handoff survives storage as
 * plain text, then handed to the published `dispatchOutboxEntry` helper so the
 * record/edge ordering stays the SDK's contract rather than this example's.
 */
async function drainRow(row: QueuedOutboxRow, target: OutboxEvidenceTarget): Promise<void> {
  const payload = JSON.parse(row.payloadJson) as OutboxPayload
  await dispatchOutboxEntry(payload, target)
  row.status = 'dispatched'
}

/**
 * Runs the full governed-action roundtrip: draft, transactional enqueue beside
 * the simulated application write, drain, replay, and chain verification.
 */
export async function governedOutboxRoundtrip() {
  const before: InvoiceRow = {
    id: 'inv_123',
    status: 'open',
    amountCents: 48000,
    currency: 'USD',
    customerEmail: 'ap@customer.example',
  }
  const after: InvoiceRow = { ...before, status: 'paid' }

  const draft = createGovernedActionDraft<InvoiceRow>({
    scope,
    entity: invoiceEntity,
    before,
    after,
    actionType: 'invoice.marked_paid',
    activityType: 'billing.settlement',
    initiatedBy: { authority: 'acme-billing', kind: 'principal', type: 'user', id: 'usr_owner' },
    performedBy: { authority: 'acme-billing', kind: 'principal', type: 'service', id: 'billing_api' },
    producer: { authority: 'acme-billing', kind: 'principal', type: 'service', id: 'billing_api' },
    occurredAt: '2026-08-09T10:00:00.000Z',
    idempotencyKey: 'invoice:inv_123:mark_paid',
    mutationBinding: 'same_transaction',
  })

  // The host transaction: the application row and the serialized outbox entry
  // are committed by the same writer, so evidence cannot be lost when the
  // process dies between the business write and the evidence append.
  const invoiceTable = new Map<string, InvoiceRow>([[before.id, before]])
  const outboxTable: QueuedOutboxRow[] = []
  const commitMutationWithEvidence = (row: InvoiceRow, payload: OutboxPayload): void => {
    invoiceTable.set(row.id, row)
    outboxTable.push({
      id: `outbox_${draft.changeRef.id}`,
      tenantId: scope.tenantId,
      status: 'pending',
      payloadJson: JSON.stringify(payload),
    })
  }
  commitMutationWithEvidence(after, draft.outboxEntry)

  const queueBefore = outboxTable.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    status: row.status,
    payloadBytes: outboxPayloadByteLength(JSON.parse(row.payloadJson) as OutboxPayload),
  }))

  // Local evidence sinks. Audit records come from the published in-memory
  // store; the edge chain is built here from the same published hashing
  // primitives because `MemoryAuditStore` covers audit records only.
  const auditStore = new MemoryAuditStore()
  const edgeRecords: EvidenceEdgeRecord[] = []
  const edgeRecordsById = new Map<string, EvidenceEdgeRecord>()

  const target: OutboxEvidenceTarget = {
    /** Idempotent audit append keyed by the draft-assigned event id. */
    async recordEvent(input: AuditEventInput): Promise<AuditRecord> {
      const event = createAuditEvent(input)
      return auditStore.append(event, { idempotencyKey: event.id })
    },
    /** Idempotent edge append keyed by the draft-assigned edge id. */
    async recordEdge(input: EvidenceEdgeInput): Promise<EvidenceEdgeRecord> {
      const edge = createEvidenceEdge(input)
      const replayed = edgeRecordsById.get(edge.id)
      if (replayed) {
        return replayed
      }
      const previous = edgeRecords.at(-1)
      const recordWithoutHash = {
        edge,
        sequence: (previous?.sequence ?? 0) + 1,
        previousHash: previous?.hash ?? null,
        hashAlgorithm: 'sha256' as const,
        canonicalization: 'veritio-json-v1' as const,
        appendedAt: '2026-08-09T10:00:05.000Z',
        idempotencyKeyHash: hashIdempotencyKey(scope.tenantId, edge.id),
      }
      const record: EvidenceEdgeRecord = {
        ...recordWithoutHash,
        hash: hashEvidenceEdgeRecord(recordWithoutHash),
      }
      edgeRecords.push(record)
      edgeRecordsById.set(record.edge.id, record)
      return record
    },
  }

  const pendingRow = outboxTable[0]
  if (!pendingRow) {
    throw new Error('the transactional write must enqueue exactly one outbox row')
  }
  await drainRow(pendingRow, target)

  const auditAfterFirstDrain = await auditStore.list(scope)
  const edgeCountAfterFirstDrain = edgeRecords.length

  // At-least-once delivery: the same durable row is dispatched again.
  await drainRow(pendingRow, target)
  const auditAfterReplay = await auditStore.list(scope)

  return {
    draft: {
      changeId: draft.changeRef.id,
      activityId: draft.activityRef.id,
      entityId: draft.entityRef.id,
      revisionId: draft.revision.ref.id,
      changedPaths: draft.revision.changedPaths,
      stateDigest: draft.revision.stateCommitment.digest,
      stateCommitmentFields: draft.revision.stateCommitment.fields,
    },
    outboxEntry: {
      schemaVersion: draft.outboxEntry.schemaVersion,
      mutationBinding: draft.outboxEntry.mutationBinding,
      recordCount: draft.outboxEntry.records.length,
      edgeCount: draft.outboxEntry.edges.length,
    },
    queueBefore,
    payloadContainsRawEmail: pendingRow.payloadJson.includes(before.customerEmail),
    appliedInvoiceStatus: invoiceTable.get(after.id)?.status,
    queueAfter: outboxTable.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      status: row.status,
    })),
    recordedEvents: auditAfterFirstDrain.map((record) => ({
      sequence: record.sequence,
      action: record.event.action,
      targetType: record.event.target.type,
    })),
    recordedEdges: edgeRecords.map((record) => ({
      sequence: record.sequence,
      relation: record.edge.relation,
      from: record.edge.from.type,
      to: record.edge.to.type,
    })),
    replay: {
      eventsAfterFirstDrain: auditAfterFirstDrain.length,
      eventsAfterReplay: auditAfterReplay.length,
      edgesAfterFirstDrain: edgeCountAfterFirstDrain,
      edgesAfterReplay: edgeRecords.length,
    },
    verification: {
      audit: verifyAuditRecords(auditAfterReplay),
      edges: verifyEvidenceEdgeRecords(edgeRecords),
    },
  }
}

if (import.meta.main) {
  console.log(JSON.stringify(await governedOutboxRoundtrip(), null, 2))
}
