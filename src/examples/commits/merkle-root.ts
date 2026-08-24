import {
  type AuditEvent,
  type AuditRecord,
  type EvidenceCommit,
  type EvidenceCommitMember,
  createAuditEvent,
  createEvidenceCommit,
  hashAuditRecord,
  hashIdempotencyKey,
  verifyAuditRecords,
  hashEvidenceCommit,
  verifyEvidenceCommits,
} from '@veritio/core'

export const commitScope = { tenantId: 'org_acme', environment: 'production' } as const

const membershipEvents: readonly { event: AuditEvent; idempotencyKey: string }[] = [
  {
    event: createAuditEvent({
      id: 'evt_member_invited_01',
      occurredAt: '2026-08-09T10:00:00.000Z',
      actor: { type: 'user', id: 'usr_owner' },
      action: 'organization.member.invited',
      target: { type: 'organization', id: 'org_acme' },
      scope: commitScope,
      purpose: 'access_management',
      lawfulBasis: 'contract',
      retention: 'security_1y',
      metadata: { role: 'viewer' },
    }),
    idempotencyKey: 'invitation:inv_123',
  },
  {
    event: createAuditEvent({
      id: 'evt_member_joined_01',
      occurredAt: '2026-08-09T10:01:00.000Z',
      actor: { type: 'user', id: 'usr_member' },
      action: 'organization.member.joined',
      target: { type: 'organization', id: 'org_acme' },
      scope: commitScope,
      purpose: 'access_management',
      lawfulBasis: 'contract',
      retention: 'security_1y',
      metadata: { role: 'viewer' },
    }),
    idempotencyKey: 'membership:mem_123',
  },
  {
    event: createAuditEvent({
      id: 'evt_member_promoted_01',
      occurredAt: '2026-08-09T10:02:00.000Z',
      actor: { type: 'user', id: 'usr_owner' },
      action: 'organization.member.promoted',
      target: { type: 'organization', id: 'org_acme' },
      scope: commitScope,
      purpose: 'access_management',
      lawfulBasis: 'contract',
      retention: 'security_1y',
      metadata: { role: 'admin' },
    }),
    idempotencyKey: 'promotion:mem_123',
  },
]

/**
 * Builds the three audit records the commit manifest binds. A real store stamps
 * `appendedAt` from wall-clock time, which would move every record hash between
 * runs, so this fixture pins that field and derives the envelope hashes with the
 * protocol helper instead. The chain (sequence, previousHash) is still built the
 * way a conforming store builds it, so `member.recordHash` references genuine
 * record digests rather than placeholder bytes.
 */
export function pinnedMembershipRecords(): AuditRecord[] {
  const records: AuditRecord[] = []
  let previousHash: string | null = null

  for (const [position, entry] of membershipEvents.entries()) {
    const recordWithoutHash = {
      event: entry.event,
      sequence: position + 1,
      previousHash,
      hashAlgorithm: 'sha256',
      canonicalization: 'veritio-json-v1',
      appendedAt: '2026-08-09T10:03:00.000Z',
      idempotencyKeyHash: hashIdempotencyKey(commitScope.tenantId, entry.idempotencyKey),
    } satisfies Omit<AuditRecord, 'hash'>

    const record: AuditRecord = { ...recordWithoutHash, hash: hashAuditRecord(recordWithoutHash) }
    records.push(record)
    previousHash = record.hash
  }

  return records
}

/**
 * Projects persisted records into a commit manifest. `recordHash` must be the
 * algorithm-qualified form (`sha256:<hex>`) even though v1 audit record hashes
 * are stored as bare hex, and `index` — not array position — is the field the
 * protocol canonicalizes on.
 */
export function commitMembersFor(records: readonly AuditRecord[]): EvidenceCommitMember[] {
  return records.map((record, position) => ({
    index: position,
    recordType: 'audit.record' as const,
    recordId: record.event.id,
    recordHash: `sha256:${record.hash}`,
  }))
}

/**
 * Commits a manifest in whatever array order the caller happens to hold it. The
 * commit id, stream, sequence, and `committedAt` are pinned so the Merkle root
 * and commit hash are reproducible across runs and languages.
 */
export function commitOf(members: readonly EvidenceCommitMember[]): EvidenceCommit {
  return createEvidenceCommit({
    commitId: 'cmt_membership_01',
    streamId: 'org_acme:production',
    sequence: 1,
    previousCommitHash: null,
    members: [...members],
    committedAt: '2026-08-09T10:05:00.000Z',
  })
}

/**
 * Proves that EvidenceCommit member ordering is protocol-canonical rather than
 * caller-dependent: two callers that hand the same manifest to
 * `createEvidenceCommit` in different array orders get the same sorted
 * `members`, the same `veritio-merkle-v1` `recordsRoot`, and the same commit
 * hash. It also shows `hashEvidenceCommit` recomputing the stored hash from the
 * canonical fields and `verifyEvidenceCommits` accepting the one-commit chain.
 */
if (import.meta.main) {
  const records = pinnedMembershipRecords()
  const members = commitMembersFor(records)

  // Two deliberately different caller orderings of the same three members.
  const shuffled: EvidenceCommitMember[] = [members[2], members[0], members[1]]
  const reversed: EvidenceCommitMember[] = [...members].reverse()

  const commit = commitOf(shuffled)
  const rebuilt = commitOf(reversed)

  console.log(
    JSON.stringify(
      {
        recordChainVerification: verifyAuditRecords(records),
        suppliedOrder: shuffled.map((member) => ({
          index: member.index,
          recordId: member.recordId,
        })),
        canonicalMemberOrder: commit.members.map((member) => ({
          index: member.index,
          recordType: member.recordType,
          recordId: member.recordId,
          recordHash: member.recordHash,
        })),
        recordCount: commit.recordCount,
        treeAlgorithm: commit.treeAlgorithm,
        recordsRoot: commit.recordsRoot,
        commitHash: commit.hash,
        hashSelfConsistent: hashEvidenceCommit(commit) === commit.hash,
        orderIndependent:
          rebuilt.hash === commit.hash && rebuilt.recordsRoot === commit.recordsRoot,
        commitVerification: verifyEvidenceCommits([commit]),
      },
      null,
      2,
    ),
  )
}
