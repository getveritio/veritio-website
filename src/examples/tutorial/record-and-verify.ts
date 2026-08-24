import {
  type AuditRecord,
  MemoryAuditStore,
  createAuditEvent,
  verifyAuditRecords,
} from '@veritio/core'

export const tutorialScope = { tenantId: 'org_acme', environment: 'production' } as const

/**
 * Records the deterministic two-event chain reused by the opening tutorial and
 * its tamper exercise. Fixed identifiers and timestamps keep the documented
 * output reproducible while the store still assigns the authoritative sequence
 * numbers, previous hashes, and record hashes.
 */
export async function recordTutorialChain(): Promise<AuditRecord[]> {
  const store = new MemoryAuditStore()

  const invitation = createAuditEvent({
    id: 'evt_member_invited_01',
    occurredAt: '2026-08-09T10:00:00.000Z',
    actor: { type: 'user', id: 'usr_owner' },
    action: 'organization.member.invited',
    target: { type: 'organization', id: 'org_acme' },
    scope: tutorialScope,
    purpose: 'access_management',
    lawfulBasis: 'contract',
    retention: 'security_1y',
    metadata: { role: 'viewer' },
  })

  const membership = createAuditEvent({
    id: 'evt_member_joined_01',
    occurredAt: '2026-08-09T10:01:00.000Z',
    actor: { type: 'user', id: 'usr_member' },
    action: 'organization.member.joined',
    target: { type: 'organization', id: 'org_acme' },
    scope: tutorialScope,
    purpose: 'access_management',
    lawfulBasis: 'contract',
    retention: 'security_1y',
    metadata: { role: 'viewer' },
  })

  await store.append(invitation, { idempotencyKey: 'invitation:inv_123' })
  await store.append(membership, { idempotencyKey: 'membership:mem_123' })
  return store.list(tutorialScope)
}

if (import.meta.main) {
  const records = await recordTutorialChain()
  const output = {
    sequences: records.map((record) => record.sequence),
    previousHashLinked: records[1]?.previousHash === records[0]?.hash,
    verification: verifyAuditRecords(records),
  }
  console.log(JSON.stringify(output, null, 2))
}
