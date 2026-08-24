import {
  type EvidenceEdge,
  type EvidenceEdgeRecord,
  createEvidenceEdge,
  hashEvidenceEdge,
  hashEvidenceEdgeRecord,
  hashIdempotencyKey,
  verifyEvidenceEdgeRecords,
} from '@veritio/core'

/**
 * Proves the evidence-graph edge invariants that let a lineage graph be audited
 * with the same rigour as an audit-event chain:
 *
 * - `createEvidenceEdge` normalizes an edge input into the language-neutral edge
 *   contract: it stamps `schemaVersion`, normalizes `occurredAt` to a UTC
 *   instant, validates the entity types and the relation against the protocol
 *   vocabulary, and redacts metadata deterministically. Graph vocabulary is
 *   owned by the protocol, not by a host framework.
 * - `hashEvidenceEdge(edge, previousHash)` is the EDGE-level link — sha256 over
 *   canonical JSON of `{ edge, previousHash }`. It is the cross-language link
 *   pinned by conformance fixtures.
 * - `hashEvidenceEdgeRecord(record)` is the ENVELOPE hash — sha256 over the
 *   canonical record with the stored `hash` field excluded. It therefore commits
 *   to the edge AND to `sequence`, `previousHash`, `appendedAt`, and
 *   `idempotencyKeyHash`, so reordering or re-stamping a stored edge is
 *   detectable, not just editing its payload.
 * - `verifyEvidenceEdgeRecords` walks the records per tenant and fails closed on
 *   the ENVELOPE hash. Edge chains are verified separately from audit-event
 *   chains: a tenant's edge sequence starts at 1 with `previousHash: null` and
 *   each later record points at the previous record's envelope hash.
 *
 * Honest boundary: the verifier checks the envelope hash, not
 * `hashEvidenceEdge`. Both are printed below so the difference is visible rather
 * than implied.
 *
 * `@veritio/core` ships no edge store, so this fixture chains the records the
 * way `MemoryAuditStore` chains audit records — envelope hash as the tip. Every
 * edge id, `occurredAt`, `appendedAt`, and idempotency key is pinned, so the
 * printed digests are byte-stable across runs.
 */
export const graphScope = { tenantId: 'org_acme', environment: 'production' } as const

/** Pinned append instant per edge; a real store would use its own clock. */
const APPENDED_AT = '2026-08-09T10:05:00.000Z'

/**
 * Appends one edge onto a tenant-local edge chain exactly as a conforming store
 * would: sequence increments by one, `previousHash` is the previous record's
 * ENVELOPE hash, and the envelope hash is computed last over everything else.
 * Kept local because the SDK intentionally ships no edge store — the point is
 * that the chain rule, not the storage engine, is the protocol.
 */
function appendEdgeRecord(
  chain: EvidenceEdgeRecord[],
  edge: EvidenceEdge,
  idempotencyKey: string,
): EvidenceEdgeRecord {
  const previous = chain.at(-1) ?? null
  const recordWithoutHash: Omit<EvidenceEdgeRecord, 'hash'> = {
    edge,
    sequence: (previous?.sequence ?? 0) + 1,
    previousHash: previous?.hash ?? null,
    hashAlgorithm: 'sha256',
    canonicalization: 'veritio-json-v1',
    appendedAt: APPENDED_AT,
    idempotencyKeyHash: hashIdempotencyKey(graphScope.tenantId, idempotencyKey),
  }
  const record: EvidenceEdgeRecord = {
    ...recordWithoutHash,
    hash: hashEvidenceEdgeRecord(recordWithoutHash),
  }
  chain.push(record)
  return record
}

/**
 * Builds the pinned three-edge lineage set shared by the documentation page and
 * this fixture's byte-compared output: one governed change, placed inside its
 * activity, touching one file, reviewed by one principal.
 */
export function buildChangeLineageEdges(): EvidenceEdge[] {
  const change = { type: 'change', id: 'chg_subscription_sub_9f31' } as const
  return [
    createEvidenceEdge({
      id: 'edge_change_part_of_activity',
      occurredAt: '2026-08-09T10:00:00.000Z',
      scope: graphScope,
      from: change,
      relation: 'part_of',
      to: { type: 'activity', id: 'act_subscription_sub_9f31' },
      metadata: { activityType: 'billing.plan_change' },
    }),
    createEvidenceEdge({
      id: 'edge_change_modified_file',
      occurredAt: '2026-08-09T10:00:30.000Z',
      scope: graphScope,
      from: change,
      relation: 'modified',
      to: {
        type: 'file',
        id: 'file_billing_plan_ts',
        // Repository paths enter the graph as a digest, never as a raw path.
        pathHash: 'sha256:6f4b1c0d2a7e5839c1b0f2d3e4a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d',
      },
      metadata: { changedPathCount: 2 },
    }),
    createEvidenceEdge({
      id: 'edge_change_reviewed_by_owner',
      occurredAt: '2026-08-09T10:01:00.000Z',
      scope: graphScope,
      from: change,
      relation: 'reviewed_by',
      to: { type: 'principal', id: 'usr_owner', actorType: 'user' },
      metadata: { decision: 'approved' },
    }),
  ]
}

/**
 * Chains the pinned lineage edges into verifiable edge records. Exported so the
 * docs page and the tamper exercise below share one derivation.
 */
export function buildChangeLineageChain(): EvidenceEdgeRecord[] {
  const edges = buildChangeLineageEdges()
  const chain: EvidenceEdgeRecord[] = []
  appendEdgeRecord(chain, edges[0]!, 'lineage:chg_subscription_sub_9f31:part_of')
  appendEdgeRecord(chain, edges[1]!, 'lineage:chg_subscription_sub_9f31:modified')
  appendEdgeRecord(chain, edges[2]!, 'lineage:chg_subscription_sub_9f31:reviewed_by')
  return chain
}

if (import.meta.main) {
  const records = buildChangeLineageChain()

  // Tamper with the SECOND edge's payload only: the metadata value changes, but
  // the stored envelope hash is left exactly as the chain wrote it.
  const tampered: EvidenceEdgeRecord[] = records.map((record, index) =>
    index === 1
      ? {
          ...record,
          edge: { ...record.edge, metadata: { ...record.edge.metadata, changedPathCount: 1 } },
        }
      : record,
  )
  const tamperedVerification = verifyEvidenceEdgeRecords(tampered)
  const tamperedIndex = tamperedVerification.ok ? -1 : tamperedVerification.index

  const output = {
    edges: records.map((record) => record.edge),
    chain: records.map((record) => ({
      edgeId: record.edge.id,
      sequence: record.sequence,
      previousHash: record.previousHash,
      // Edge-level link: sha256(canonicalJson({ edge, previousHash })).
      edgeHash: hashEvidenceEdge(record.edge, record.previousHash),
      // Envelope hash: what the store persists and what the verifier checks.
      recordHash: record.hash,
      recordHashRecomputes: record.hash === hashEvidenceEdgeRecord(record),
      // The two hashes commit to different inputs and must never be conflated.
      edgeHashDiffersFromRecordHash:
        hashEvidenceEdge(record.edge, record.previousHash) !== record.hash,
      // A tenant edge chain links envelope hash to envelope hash.
      linksToPreviousRecordHash: record.previousHash === (records[record.sequence - 2]?.hash ?? null),
    })),
    verification: verifyEvidenceEdgeRecords(records),
    tamper: {
      what: 'edge[1].metadata.changedPathCount 2 -> 1, stored envelope hash left untouched',
      verification: tamperedVerification,
      failedRecord: {
        edgeId: tampered[tamperedIndex]?.edge.id ?? null,
        storedHash: tampered[tamperedIndex]?.hash ?? null,
        recomputedHash: tampered[tamperedIndex]
          ? hashEvidenceEdgeRecord(tampered[tamperedIndex]!)
          : null,
      },
    },
  }

  console.log(JSON.stringify(output, null, 2))
}
