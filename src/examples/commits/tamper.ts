import {
  type AuditRecord,
  type EvidenceCommit,
  type EvidenceCommitMember,
  type EvidenceCommitVerificationResult,
  HASH_ALGORITHM,
  createAuditEvent,
  createEvidenceCommit,
  hashAuditRecord,
  hashIdempotencyKey,
  verifyAuditRecords,
  verifyEvidenceCommits,
} from '@veritio/core'

export const commitTamperScope = { tenantId: 'org_acme', environment: 'production' } as const

const STREAM_ID = 'org_acme:production'

/**
 * Builds the four pinned audit records the commit ledger below binds.
 *
 * `MemoryAuditStore` stamps `appendedAt` from the wall clock, which would make
 * every record hash — and therefore every Merkle root and commit hash — differ
 * per run. This mirrors the store's envelope construction exactly
 * (`hashIdempotencyKey` for the tenant-scoped idempotency hash, previous-hash
 * linkage, `hashAuditRecord` over the envelope minus `hash`) with `appendedAt`
 * pinned, so the documented digests stay byte-stable. `verifyAuditRecords`
 * below proves the hand-pinned chain is a real, conforming chain.
 */
export function buildCommitEvidence(): AuditRecord[] {
  const inputs = [
    {
      id: 'evt_member_invited_01',
      occurredAt: '2026-08-09T10:00:00.000Z',
      actor: { type: 'user', id: 'usr_owner' },
      action: 'organization.member.invited',
      idempotencyKey: 'invitation:inv_123',
      appendedAt: '2026-08-09T10:00:01.000Z',
    },
    {
      id: 'evt_member_joined_01',
      occurredAt: '2026-08-09T10:01:00.000Z',
      actor: { type: 'user', id: 'usr_member' },
      action: 'organization.member.joined',
      idempotencyKey: 'membership:mem_123',
      appendedAt: '2026-08-09T10:01:01.000Z',
    },
    {
      id: 'evt_member_promoted_01',
      occurredAt: '2026-08-09T10:02:00.000Z',
      actor: { type: 'user', id: 'usr_owner' },
      action: 'organization.member.promoted',
      idempotencyKey: 'promotion:mem_123',
      appendedAt: '2026-08-09T10:02:01.000Z',
    },
    {
      id: 'evt_member_removed_01',
      occurredAt: '2026-08-09T10:03:00.000Z',
      actor: { type: 'user', id: 'usr_owner' },
      action: 'organization.member.removed',
      idempotencyKey: 'removal:mem_123',
      appendedAt: '2026-08-09T10:03:01.000Z',
    },
  ] as const

  const records: AuditRecord[] = []
  for (const input of inputs) {
    const event = createAuditEvent({
      id: input.id,
      occurredAt: input.occurredAt,
      actor: input.actor,
      action: input.action,
      target: { type: 'organization', id: 'org_acme' },
      scope: commitTamperScope,
      purpose: 'access_management',
      lawfulBasis: 'contract',
      retention: 'security_1y',
      metadata: { role: 'viewer' },
    })
    const envelope = {
      event,
      sequence: records.length + 1,
      previousHash: records[records.length - 1]?.hash ?? null,
      hashAlgorithm: HASH_ALGORITHM,
      canonicalization: 'veritio-json-v1',
      appendedAt: input.appendedAt,
      idempotencyKeyHash: hashIdempotencyKey(commitTamperScope.tenantId, input.idempotencyKey),
    } satisfies Omit<AuditRecord, 'hash'>
    records.push({ ...envelope, hash: hashAuditRecord(envelope) })
  }
  return records
}

/**
 * Projects persisted audit records into commit members. `recordHash` must be
 * the algorithm-qualified `sha256:<hex>` form even though v1 audit record
 * hashes are stored as bare hex, and `index` is contiguous from zero.
 */
function membersFor(records: readonly AuditRecord[]): EvidenceCommitMember[] {
  return records.map((record, position) => ({
    index: position,
    recordType: 'audit.record' as const,
    recordId: record.event.id,
    recordHash: `sha256:${record.hash}`,
  }))
}

/**
 * Builds the honest two-commit ledger for one stream: commit 1 binds the first
 * three records, commit 2 binds the fourth and links back through
 * `previousCommitHash`. Commit ids and `committedAt` are pinned so both Merkle
 * roots and commit hashes are reproducible.
 */
export function buildCommitLedger(records: readonly AuditRecord[]): EvidenceCommit[] {
  const members = membersFor(records)

  const first = createEvidenceCommit({
    commitId: 'cmt_membership_01',
    streamId: STREAM_ID,
    sequence: 1,
    previousCommitHash: null,
    members: members.slice(0, 3),
    committedAt: '2026-08-09T10:05:00.000Z',
  })

  const second = createEvidenceCommit({
    commitId: 'cmt_membership_02',
    streamId: STREAM_ID,
    sequence: 2,
    previousCommitHash: first.hash,
    members: [{ ...members[3], index: 0 }],
    committedAt: '2026-08-09T10:06:00.000Z',
  })

  return [first, second]
}

/**
 * Clones the ledger and applies one tamper to it. Cloning keeps every case
 * independent so a mutation can never leak into the next scenario, and the
 * verifier always sees a whole chain rather than a shared mutable object.
 */
function tamper(
  ledger: readonly EvidenceCommit[],
  mutate: (copy: EvidenceCommit[]) => void,
): EvidenceCommitVerificationResult {
  const copy = structuredClone(ledger) as EvidenceCommit[]
  mutate(copy)
  return verifyEvidenceCommits(copy)
}

/**
 * Proves that `verifyEvidenceCommits` names the exact structural defect it
 * found in a commit ledger — and documents the edge of that guarantee. The
 * verifier checks the ledger's own consistency: per-stream sequence,
 * `previousCommitHash` linkage, member-manifest shape, the `veritio-merkle-v1`
 * `recordsRoot`, and the commit hash. It deliberately does NOT reconcile
 * `member.recordHash` against the records those hashes claim to describe, so a
 * member substituted and then re-committed verifies `ok` in isolation; only
 * composing the commit ledger with per-record verification (`hashAuditRecord` /
 * `verifyAuditRecords`) catches that class.
 */
if (import.meta.main) {
  const records = buildCommitEvidence()
  const ledger = buildCommitLedger(records)
  const [first, second] = ledger

  const cases = [
    {
      name: 'untampered',
      mutation: 'none — the honest two-commit ledger',
      result: verifyEvidenceCommits(ledger),
    },
    {
      name: 'swapped_member_record_hash',
      mutation: 'commit 1 members[0] and members[1] exchange recordHash',
      result: tamper(ledger, (copy) => {
        const members = copy[0].members
        const held = members[0].recordHash
        members[0].recordHash = members[1].recordHash
        members[1].recordHash = held
      }),
    },
    {
      name: 'dropped_member_tail',
      mutation: 'commit 1 loses its last member; recordCount still claims 3',
      result: tamper(ledger, (copy) => {
        copy[0].members = copy[0].members.slice(0, 2)
      }),
    },
    {
      name: 'dropped_member_middle',
      mutation: 'commit 1 loses members[1], leaving indices [0, 2]',
      result: tamper(ledger, (copy) => {
        copy[0].members = [copy[0].members[0], copy[0].members[2]]
      }),
    },
    {
      name: 'reordered_member_indices',
      mutation: 'commit 1 members[0] and members[1] exchange their index fields',
      result: tamper(ledger, (copy) => {
        const members = copy[0].members
        const held = members[0].index
        members[0].index = members[1].index
        members[1].index = held
      }),
    },
    {
      name: 'reordered_member_array',
      mutation: 'commit 1 members reversed in place, index fields untouched',
      result: tamper(ledger, (copy) => {
        copy[0].members = [...copy[0].members].reverse()
      }),
    },
    {
      name: 'mutated_records_root',
      mutation: "commit 1 recordsRoot replaced with commit 2's root",
      result: tamper(ledger, (copy) => {
        copy[0].recordsRoot = copy[1].recordsRoot
      }),
    },
    {
      name: 'broken_previous_hash_link',
      mutation: 'commit 2 re-parented onto a fabricated previousCommitHash',
      result: tamper(ledger, (copy) => {
        copy[1].previousCommitHash = `sha256:${'0'.repeat(64)}`
      }),
    },
  ]

  // The documented v1 limit: substitute a member's recordHash AND re-commit,
  // and the ledger verifies clean. Reconciliation against the real records is
  // what exposes it.
  const substituted = createEvidenceCommit({
    commitId: 'cmt_membership_01',
    streamId: STREAM_ID,
    sequence: 1,
    previousCommitHash: null,
    members: membersFor(records.slice(0, 3)).map((member) =>
      member.index === 0 ? { ...member, recordHash: `sha256:${records[3].hash}` } : member,
    ),
    committedAt: '2026-08-09T10:05:00.000Z',
  })
  const reconciled = substituted.members.map((member) => {
    const record = records.find((candidate) => candidate.event.id === member.recordId)
    return {
      recordId: member.recordId,
      boundToItsOwnRecord:
        record !== undefined && member.recordHash === `sha256:${hashAuditRecord(record)}`,
    }
  })

  console.log(
    JSON.stringify(
      {
        recordChain: verifyAuditRecords(records),
        ledger: ledger.map((commit) => ({
          commitId: commit.commitId,
          sequence: commit.sequence,
          recordCount: commit.recordCount,
          recordsRoot: commit.recordsRoot,
          previousCommitHash: commit.previousCommitHash,
          hash: commit.hash,
        })),
        previousHashLinked: second.previousCommitHash === first.hash,
        cases: cases.map((entry) => ({
          case: entry.name,
          mutation: entry.mutation,
          ok: entry.result.ok,
          index: entry.result.ok ? null : entry.result.index,
          reason: entry.result.ok ? null : entry.result.reason,
        })),
        ledgerScopeCaveat: {
          note: 'verifyEvidenceCommits proves ledger consistency, not that members describe real records',
          resignedSubstitution: verifyEvidenceCommits([substituted]),
          reconciledAgainstRecords: reconciled,
        },
      },
      null,
      2,
    ),
  )
}
