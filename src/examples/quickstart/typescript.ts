import { MemoryAuditStore, createAuditEvent, hashAuditEvent, verifyAuditRecords } from '@veritio/core'

const store = new MemoryAuditStore()
const scope = { tenantId: 'org_acme', environment: 'production' }

const event = createAuditEvent({
  id: 'evt_member_invited_01',
  occurredAt: '2026-08-09T10:00:00.000Z',
  actor: { type: 'user', id: 'usr_123' },
  action: 'organization.member.invited',
  target: { type: 'organization', id: 'org_acme' },
  scope,
  purpose: 'access_management',
  lawfulBasis: 'contract',
  retention: 'security_1y',
  metadata: { role: 'viewer' },
})

const record = await store.append(event, { idempotencyKey: 'invite:inv_123' })
const records = await store.list(scope)
const verification = verifyAuditRecords(records)

console.log({ sequence: record.sequence, verification, hashPrefix: hashAuditEvent(event).slice(0, 12) })
