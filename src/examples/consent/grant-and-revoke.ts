import {
  type AuditRecord,
  MemoryAuditStore,
  consentGrantedTemplate,
  consentRevokedTemplate,
  createAuditEvent,
  verifyAuditRecords,
} from '@veritio/core'

export const consentScope = { tenantId: 'org_acme', environment: 'production' } as const

const consentId = 'cns_marketing_email_01'
const subjectId: string = 'sub_9f2c41'

/**
 * Records a consent grant followed by its revocation on one tenant hash chain.
 *
 * The invariant this proves: both lifecycle events are built by the protocol
 * templates rather than hand-written action strings, so they resolve to the
 * SAME `consent` target resource and carry the same opaque `subjectId` in
 * metadata. That shared resource identity is what lets a consent-history screen
 * group a grant with its revocation, and the append order plus previous-hash
 * linkage is what makes the resulting history tamper-evident evidence instead
 * of prose. Ids and timestamps are pinned so the documented output stays
 * reproducible while the store still owns sequence numbers and chain hashes.
 */
export async function recordConsentHistory(): Promise<AuditRecord[]> {
  const store = new MemoryAuditStore()

  const granted = createAuditEvent(
    consentGrantedTemplate({
      id: 'evt_consent_granted_01',
      occurredAt: '2026-08-09T10:00:00.000Z',
      actor: { type: 'user', id: 'usr_subject_9f2c41' },
      consentId,
      subjectId,
      purposeId: 'purpose_marketing_email',
      scope: consentScope,
    }),
  )

  const revoked = createAuditEvent(
    consentRevokedTemplate({
      id: 'evt_consent_revoked_01',
      occurredAt: '2026-08-14T16:30:00.000Z',
      actor: { type: 'user', id: 'usr_subject_9f2c41' },
      consentId,
      subjectId,
      purposeId: 'purpose_marketing_email',
      scope: consentScope,
    }),
  )

  await store.append(granted, { idempotencyKey: `consent:${consentId}:granted` })
  await store.append(revoked, { idempotencyKey: `consent:${consentId}:revoked` })
  return store.list(consentScope)
}

/**
 * Projects the consent-facing protocol fields a history UI renders. Record
 * hashes and `appendedAt` are deliberately excluded: the store stamps wall-clock
 * append time into the record hash input, so those values are not reproducible
 * in a byte-compared fixture.
 */
function consentView(record: AuditRecord) {
  const { action, target, purpose, lawfulBasis, retention, metadata } = record.event
  return { action, target, purpose, lawfulBasis, retention, metadata }
}

if (import.meta.main) {
  const records = await recordConsentHistory()
  const [granted, revoked] = records

  if (!granted || !revoked) {
    throw new Error('expected a consent grant and a consent revocation')
  }

  const output = {
    granted: consentView(granted),
    revoked: consentView(revoked),
    sameConsentResource:
      granted.event.target.type === revoked.event.target.type &&
      granted.event.target.id === revoked.event.target.id,
    sameSubject: granted.event.metadata.subjectId === revoked.event.metadata.subjectId,
    sequences: records.map((record) => record.sequence),
    previousHashLinked: revoked.previousHash === granted.hash,
    verification: verifyAuditRecords(records),
  }
  console.log(JSON.stringify(output, null, 2))
}
