import {
  type ExportBundleInput,
  MemoryAuditStore,
  buildExportBundle,
  consentGrantedTemplate,
  consentRevokedTemplate,
  createAuditEvent,
  dataSubjectRequestCreatedTemplate,
  parseExportBundle,
  serializeExportBundle,
  verifyExportBundle,
} from '@veritio/core'

const scope = { tenantId: 'org_acme', environment: 'production' } as const
const subjectId = 'dsub_1001'

/**
 * Proves what a data-subject export can and cannot claim in the published SDK.
 *
 * `dataSubjectRequestCreatedTemplate` gives the DSAR intake event a fixed
 * action, target type, purpose, lawful basis, and retention class, so the
 * request itself is evidence on the same tenant hash chain as the consent
 * records it is about. Selecting only one subject's records out of that chain
 * leaves interior gaps, so the bundle MUST declare `chainScope: 'filtered'`:
 * the second build here claims the same subset as a full chain and the verifier
 * fails it closed, which is the invariant that stops a subject-scoped extract
 * from being passed off as a complete chain.
 *
 * Honest boundary: the SDK templates the DSAR *event* and the bundle format.
 * Selecting which records belong to a subject is host logic — vevb-1
 * `manifest.filters` can only declare `workspaceId` / `actionPrefixes`, so a
 * subject predicate is not expressible in the manifest and is declared here as
 * an empty (but present) filters object. Fulfilment, identity proof, deadlines,
 * and delivery are the host's to implement.
 *
 * Record hashes, `rootHash`, and `appendedAt` are omitted from the output on
 * purpose: `MemoryAuditStore` stamps `appendedAt` from the wall clock, so those
 * values are not reproducible byte-for-byte.
 */
export async function buildSubjectBundle() {
  const store = new MemoryAuditStore()

  const consentGranted = createAuditEvent(
    consentGrantedTemplate({
      id: 'evt_consent_granted_01',
      occurredAt: '2026-08-09T09:00:00.000Z',
      scope,
      actor: { type: 'user', id: 'usr_1001' },
      consentId: 'con_1001',
      subjectId,
      purposeId: 'product_analytics',
    }),
  )

  const otherSubjectConsent = createAuditEvent(
    consentGrantedTemplate({
      id: 'evt_consent_granted_02',
      occurredAt: '2026-08-09T09:05:00.000Z',
      scope,
      actor: { type: 'user', id: 'usr_2002' },
      consentId: 'con_2002',
      subjectId: 'dsub_2002',
      purposeId: 'product_analytics',
    }),
  )

  const subjectRequest = createAuditEvent(
    dataSubjectRequestCreatedTemplate({
      id: 'evt_subject_request_01',
      occurredAt: '2026-08-09T09:10:00.000Z',
      scope,
      actor: { type: 'user', id: 'usr_1001' },
      subjectRequestId: 'dsr_0007',
      requestType: 'access',
      subjectId,
    }),
  )

  const otherSubjectRevocation = createAuditEvent(
    consentRevokedTemplate({
      id: 'evt_consent_revoked_01',
      occurredAt: '2026-08-09T09:15:00.000Z',
      scope,
      actor: { type: 'user', id: 'usr_2002' },
      consentId: 'con_2002',
      subjectId: 'dsub_2002',
      purposeId: 'product_analytics',
    }),
  )

  await store.append(consentGranted, { idempotencyKey: 'consent:con_1001:granted' })
  await store.append(otherSubjectConsent, { idempotencyKey: 'consent:con_2002:granted' })
  await store.append(subjectRequest, { idempotencyKey: 'subject-request:dsr_0007' })
  await store.append(otherSubjectRevocation, { idempotencyKey: 'consent:con_2002:revoked' })

  const chain = await store.list(scope)
  const subjectRecords = chain.filter((record) => record.event.metadata.subjectId === subjectId)

  const bundleInput: ExportBundleInput = {
    scope: { tenantId: scope.tenantId, environment: scope.environment },
    range: { from: '2026-08-09T09:00:00.000Z', to: '2026-08-09T09:10:00.000Z' },
    producer: {
      authority: 'self-hosted-example',
      kind: 'principal',
      type: 'service',
      id: 'dsar_worker',
    },
    createdAt: '2026-08-09T09:20:00.000Z',
    events: subjectRecords,
    edges: [],
    commits: [],
  }

  const bundle = await buildExportBundle({
    ...bundleInput,
    chainScope: 'filtered',
    filters: {},
  })
  const parsed = parseExportBundle(serializeExportBundle(bundle))
  const verification = await verifyExportBundle(parsed)

  const overclaimed = await buildExportBundle(bundleInput)
  const overclaimedReport = await verifyExportBundle(overclaimed)

  return {
    requestEvent: subjectRequest,
    chain: {
      sequences: chain.map((record) => record.sequence),
      subjectSequences: subjectRecords.map((record) => record.sequence),
      subjectActions: subjectRecords.map((record) => record.event.action),
    },
    manifest: {
      bundleVersion: parsed.manifest.bundleVersion,
      createdAt: parsed.manifest.createdAt,
      scope: parsed.manifest.scope,
      range: parsed.manifest.range,
      chainScope: parsed.manifest.chainScope,
      filters: parsed.manifest.filters,
      files: parsed.manifest.files.map((file) => ({ path: file.path, records: file.records })),
    },
    containerRoundTrip: parsed.manifest.rootHash === bundle.manifest.rootHash,
    verification,
    sameSubsetClaimedAsFullChain: {
      valid: overclaimedReport.valid,
      chains: overclaimedReport.checks.chains,
      chainScope: overclaimedReport.chainScope,
      issues: overclaimedReport.issues,
    },
  }
}

if (import.meta.main) {
  console.log(JSON.stringify(await buildSubjectBundle(), null, 2))
}
