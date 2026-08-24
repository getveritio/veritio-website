import {
  type AuditEvent,
  type CaptureMode,
  type EvidenceCommitInput,
  type EvidenceRef,
  type ExportBundle,
  type ExportBundleInput,
  type GovernedActionDraftInput,
  type GovernedEntity,
  MemoryAuditStore,
  buildExportBundle,
  canonicalJson,
  createAuditEvent,
  createEvidenceCommit,
  createGovernedActionDraft,
  defineEntity,
  mergeVeritioMetadata,
  parseExportBundle,
  verifyExportBundle,
} from '@veritio/core'

/**
 * Proves that every documented fail-closed guard in `@veritio/core` 0.4.7 still
 * throws, and pins the exact message each one throws.
 *
 * The single invariant under test is that Veritio never degrades quietly: an
 * input that would produce weaker, unattributable, or unverifiable evidence
 * raises before any record, hash, draft, commit, or bundle exists. This fixture
 * walks that guard set once — event creation, canonical JSON / hashing, chain
 * append, governed change, evidence commits, and export bundles — and prints a
 * stable case name next to the caught error verbatim, so the troubleshooting
 * page quotes strings a host application will actually see rather than
 * paraphrases.
 *
 * A case that does NOT throw is reported as `accepted`, not skipped: a guard
 * that stops firing is a silent-degradation regression and must show up in the
 * byte diff instead of vanishing from the output. Every id, timestamp, digest,
 * and key is literal, so the output is byte-stable for CI comparison.
 */

const SCOPE = { tenantId: 'org_acme', environment: 'production' } as const

/** A syntactically valid `sha256:<64 hex>` digest, so digest-shape guards are the only thing under test. */
const VALID_DIGEST = 'sha256:0000000000000000000000000000000000000000000000000000000000000001'

/**
 * One guard probe. `run` is lazy and may be async so a rejected promise is
 * caught by the same runner as a synchronous throw; the runner never inspects
 * the returned value, only whether the guard fired.
 */
interface GuardCase {
  readonly surface: string
  readonly name: string
  readonly run: () => unknown
}

/**
 * Builds a valid audit event for the chain-append probes. The event carries no
 * scope by default so the tenant guard can be exercised without touching any
 * other required field.
 */
function probeEvent(id: string, scoped: boolean): AuditEvent {
  return createAuditEvent({
    id,
    occurredAt: '2026-08-09T10:00:00.000Z',
    actor: { type: 'user', id: 'usr_owner' },
    action: 'organization.member.invited',
    target: { type: 'organization', id: 'org_acme' },
    scope: scoped ? SCOPE : undefined,
    metadata: { role: 'viewer' },
  })
}

/** Row shape for the governed-change probes: one governed field whose value type each probe varies. */
interface ProbeRow extends Record<string, unknown> {
  id: string
  value: unknown
}

/**
 * Declares a governed entity whose single governed field uses `capture`. Only
 * the capture mode and the field value differ between governed probes, so a
 * thrown error is attributable to exactly one broken guarantee.
 */
function probeEntity(capture: CaptureMode): GovernedEntity<ProbeRow> {
  return defineEntity<ProbeRow>({
    authority: 'acme.example',
    type: 'billing_plan',
    schemaRef: 'acme.billing_plan.v1',
    fieldSetRef: 'acme.billing_plan.governed.v1',
    identity: (row) => row.id,
    fields: { value: { capture } },
  })
}

const principal: EvidenceRef = {
  authority: 'acme.example',
  kind: 'principal',
  type: 'user',
  id: 'usr_owner',
}

/**
 * Returns an otherwise-valid governed action input for the given entity and new
 * field value, so the capture mode or the value is the only variable.
 */
function probeDraftInput(entity: GovernedEntity<ProbeRow>, value: unknown): GovernedActionDraftInput<ProbeRow> {
  return {
    scope: SCOPE,
    entity,
    before: { id: 'plan_9001', value: 'team' },
    after: { id: 'plan_9001', value },
    actionType: 'billing.plan.upgraded',
    activityType: 'billing.plan.upgrade',
    initiatedBy: principal,
    performedBy: principal,
    producer: { ...principal, type: 'service', id: 'svc_billing_api' },
    occurredAt: '2026-08-09T10:00:00.000Z',
    idempotencyKey: 'billing:plan_9001:upgrade:1',
  }
}

/**
 * Returns an otherwise-valid evidence-commit input. Each commit probe overrides
 * exactly one field of this control so the member-manifest guards can be
 * attributed individually.
 */
function probeCommitInput(): EvidenceCommitInput {
  return {
    commitId: 'cmt_0001',
    streamId: 'org_acme:production',
    sequence: 1,
    previousCommitHash: null,
    members: [{ index: 0, recordType: 'audit.record', recordId: 'evt_01', recordHash: VALID_DIGEST }],
    committedAt: '2026-08-09T10:02:00.000Z',
  }
}

/**
 * Returns an otherwise-valid export-bundle input. Bundle probes override the
 * scope-claim or annex fields only, so the builder's fail-closed declarations
 * are the sole cause of any throw.
 */
function probeBundleInput(): ExportBundleInput {
  return {
    scope: { tenantId: 'org_acme', environment: 'production' },
    range: { from: '2026-08-09T10:00:00.000Z', to: '2026-08-09T10:01:00.000Z' },
    producer: { authority: 'self-hosted-example', kind: 'principal', type: 'service', id: 'export_worker' },
    createdAt: '2026-08-09T10:02:00.000Z',
    events: [],
    edges: [],
  }
}

const cases: GuardCase[] = [
  // --- core event creation -------------------------------------------------
  {
    surface: 'createAuditEvent',
    name: 'actor id is blank',
    run: () =>
      createAuditEvent({
        occurredAt: '2026-08-09T10:00:00.000Z',
        actor: { type: 'user', id: '   ' },
        action: 'organization.member.invited',
        target: { type: 'organization', id: 'org_acme' },
        scope: SCOPE,
      }),
  },
  {
    surface: 'createAuditEvent',
    name: 'target id is missing',
    run: () =>
      createAuditEvent({
        occurredAt: '2026-08-09T10:00:00.000Z',
        actor: { type: 'user', id: 'usr_owner' },
        action: 'organization.member.invited',
        target: { type: 'organization', id: '' },
        scope: SCOPE,
      }),
  },
  {
    surface: 'createAuditEvent',
    name: 'action is not dotted lowercase',
    run: () =>
      createAuditEvent({
        occurredAt: '2026-08-09T10:00:00.000Z',
        actor: { type: 'user', id: 'usr_owner' },
        action: 'Member Invited',
        target: { type: 'organization', id: 'org_acme' },
        scope: SCOPE,
      }),
  },
  {
    surface: 'createAuditEvent',
    name: 'occurredAt is not a parsable date',
    run: () =>
      createAuditEvent({
        occurredAt: 'yesterday',
        actor: { type: 'user', id: 'usr_owner' },
        action: 'organization.member.invited',
        target: { type: 'organization', id: 'org_acme' },
        scope: SCOPE,
      }),
  },
  {
    surface: 'createAuditEvent',
    name: 'metadata carries a non-finite number',
    run: () =>
      createAuditEvent({
        occurredAt: '2026-08-09T10:00:00.000Z',
        actor: { type: 'user', id: 'usr_owner' },
        action: 'organization.member.invited',
        target: { type: 'organization', id: 'org_acme' },
        scope: SCOPE,
        metadata: { retries: Number.POSITIVE_INFINITY },
      }),
  },

  // --- canonical JSON / hashing inputs -------------------------------------
  {
    surface: 'canonicalJson',
    name: 'NaN in the hash input',
    run: () => canonicalJson({ score: Number.NaN }),
  },
  {
    surface: 'canonicalJson',
    name: 'bigint has no canonical JSON form',
    run: () => canonicalJson({ sequence: 1n }),
  },
  {
    surface: 'canonicalJson',
    name: 'function has no canonical JSON form',
    run: () => canonicalJson({ redact: () => 'x' }),
  },

  // --- chain append --------------------------------------------------------
  {
    surface: 'MemoryAuditStore.append',
    name: 'event has no tenant scope',
    run: () => new MemoryAuditStore().append(probeEvent('evt_unscoped_01', false)),
  },
  {
    surface: 'MemoryAuditStore.append',
    name: 'idempotency key replayed with a different payload',
    run: async () => {
      const store = new MemoryAuditStore()
      await store.append(probeEvent('evt_first_01', true), { idempotencyKey: 'invite:inv_123' })
      return store.append(probeEvent('evt_second_01', true), { idempotencyKey: 'invite:inv_123' })
    },
  },
  {
    surface: 'MemoryAuditStore.append',
    name: 'expectedPreviousHash does not match the chain tip',
    run: () =>
      new MemoryAuditStore().append(probeEvent('evt_occ_01', true), {
        idempotencyKey: 'invite:inv_124',
        expectedPreviousHash: VALID_DIGEST,
      }),
  },
  {
    surface: 'MemoryAuditStore.list',
    name: 'negative limit',
    run: () => new MemoryAuditStore().list(SCOPE, { limit: -1 }),
  },
  {
    surface: 'MemoryAuditStore.list',
    name: 'fractional afterSequence',
    run: () => new MemoryAuditStore().list(SCOPE, { afterSequence: 1.5 }),
  },

  // --- governed change -----------------------------------------------------
  {
    surface: 'mergeVeritioMetadata',
    name: 'caller shadows a reserved context key',
    run: () => mergeVeritioMetadata({ changeId: 'chg_caller_supplied' }, { changeId: 'chg_sdk_owned' }),
  },
  {
    surface: 'createGovernedActionDraft',
    name: 'keyed_digest field without a digest key',
    run: () => createGovernedActionDraft(probeDraftInput(probeEntity('keyed_digest'), 'enterprise')),
  },
  {
    surface: 'createGovernedActionDraft',
    name: 'reserved capture mode randomized_digest',
    run: () => createGovernedActionDraft(probeDraftInput(probeEntity('randomized_digest'), 'enterprise')),
  },
  {
    surface: 'createGovernedActionDraft',
    name: 'governed field value is non-finite',
    run: () => createGovernedActionDraft(probeDraftInput(probeEntity('full'), Number.POSITIVE_INFINITY)),
  },
  {
    surface: 'createGovernedActionDraft',
    name: 'governed field value is a bigint',
    run: () => createGovernedActionDraft(probeDraftInput(probeEntity('full'), 25n)),
  },

  // --- evidence commits ----------------------------------------------------
  {
    surface: 'createEvidenceCommit',
    name: 'sequence is not a positive integer',
    run: () => createEvidenceCommit({ ...probeCommitInput(), sequence: 0 }),
  },
  {
    surface: 'createEvidenceCommit',
    name: 'previousCommitHash is not a sha256 digest',
    run: () => createEvidenceCommit({ ...probeCommitInput(), previousCommitHash: 'deadbeef' }),
  },
  {
    surface: 'createEvidenceCommit',
    name: 'member manifest is empty',
    run: () => createEvidenceCommit({ ...probeCommitInput(), members: [] }),
  },
  {
    surface: 'createEvidenceCommit',
    name: 'member indices skip zero',
    run: () =>
      createEvidenceCommit({
        ...probeCommitInput(),
        members: [{ index: 1, recordType: 'audit.record', recordId: 'evt_01', recordHash: VALID_DIGEST }],
      }),
  },
  {
    surface: 'createEvidenceCommit',
    name: 'the same record is committed twice',
    run: () =>
      createEvidenceCommit({
        ...probeCommitInput(),
        members: [
          { index: 0, recordType: 'audit.record', recordId: 'evt_01', recordHash: VALID_DIGEST },
          { index: 1, recordType: 'audit.record', recordId: 'evt_01', recordHash: VALID_DIGEST },
        ],
      }),
  },
  {
    surface: 'createEvidenceCommit',
    name: 'member recordType is outside the protocol vocabulary',
    run: () =>
      createEvidenceCommit({
        ...probeCommitInput(),
        members: [
          {
            index: 0,
            recordType: 'billing.invoice' as EvidenceCommitInput['members'][number]['recordType'],
            recordId: 'inv_01',
            recordHash: VALID_DIGEST,
          },
        ],
      }),
  },
  {
    surface: 'createEvidenceCommit',
    name: 'member recordHash is not a sha256 digest',
    run: () =>
      createEvidenceCommit({
        ...probeCommitInput(),
        members: [{ index: 0, recordType: 'audit.record', recordId: 'evt_01', recordHash: 'abc123' }],
      }),
  },

  // --- export bundles ------------------------------------------------------
  {
    surface: 'buildExportBundle',
    name: 'filters declared without the filtered chain scope',
    run: () => buildExportBundle({ ...probeBundleInput(), filters: { workspaceId: 'ws_eu' } }),
  },
  {
    surface: 'buildExportBundle',
    name: 'filtered chain scope without a filters declaration',
    run: () => buildExportBundle({ ...probeBundleInput(), chainScope: 'filtered' }),
  },
  {
    surface: 'buildExportBundle',
    name: 'commits carried by a scoped bundle',
    run: () => buildExportBundle({ ...probeBundleInput(), chainScope: 'windowed', commits: [{}] }),
  },
  {
    surface: 'buildExportBundle',
    name: 'annex packId is not printable ASCII',
    run: () =>
      buildExportBundle({
        ...probeBundleInput(),
        annex: [{ packId: 'packé', version: '1', entries: [{ dutyId: 'duty_1', recordIds: ['evt_01'] }] }],
      }),
  },
  {
    surface: 'buildExportBundle',
    name: 'two annex packs share one packId',
    run: () =>
      buildExportBundle({
        ...probeBundleInput(),
        annex: [
          { packId: 'gdpr_core', version: '1', entries: [{ dutyId: 'duty_1', recordIds: ['evt_01'] }] },
          { packId: 'gdpr_core', version: '2', entries: [{ dutyId: 'duty_2', recordIds: ['evt_02'] }] },
        ],
      }),
  },
  {
    surface: 'parseExportBundle',
    name: 'container text is not JSON',
    run: () => parseExportBundle('{'),
  },
  {
    surface: 'parseExportBundle',
    name: 'container is a JSON string, not an object',
    run: () => parseExportBundle('"vevb-1"'),
  },
  {
    surface: 'parseExportBundle',
    name: 'unsupported bundleVersion',
    run: () => parseExportBundle('{"bundleVersion":"vevb-9"}'),
  },
  {
    surface: 'parseExportBundle',
    name: 'container has no manifest or files',
    run: () => parseExportBundle('{"bundleVersion":"vevb-1"}'),
  },
  {
    surface: 'verifyExportBundle',
    name: 'verifier handed a non-object',
    run: () => verifyExportBundle(null as unknown as ExportBundle),
  },
]

/**
 * Runs one probe and reduces it to a serializable verdict. `await` covers both
 * synchronous throws and rejected promises; a non-`Error` throw is reported by
 * its runtime type rather than being rethrown, so the catalogue always prints a
 * complete table.
 */
async function runCase(probe: GuardCase): Promise<Record<string, unknown>> {
  try {
    await probe.run()
    return { surface: probe.surface, case: probe.name, outcome: 'accepted' }
  } catch (error) {
    return {
      surface: probe.surface,
      case: probe.name,
      outcome: 'rejected',
      errorName: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

if (import.meta.main) {
  const guards: Record<string, unknown>[] = []
  for (const probe of cases) {
    guards.push(await runCase(probe))
  }
  const output = {
    guardCount: guards.length,
    surfaces: [...new Set(cases.map((probe) => probe.surface))],
    allFailClosed: guards.every((guard) => guard.outcome === 'rejected'),
    guards,
  }
  console.log(JSON.stringify(output, null, 2))
}
