import {
  type EvidenceRef,
  type GovernedChangeDraft,
  createGovernedActionDraft,
  defineEntity,
  governedRevisionId,
  refKey,
} from '@veritio/core'

/**
 * Proves the counter-intuitive `governedRevisionId` invariant: the revision id
 * is content-addressed by the state digest AND scoped by the change that
 * produced it, so restoring a byte-identical earlier state (a rollback) yields
 * a DISTINCT revision id, while replaying the SAME change stays idempotent.
 *
 * A purely content-addressed id would silently merge the original revision and
 * its rollback into one lineage node, erasing the fact that a human reverted
 * the flag. The change-scoped suffix keeps the two apart while still letting
 * the shared state digest prove the states are identical.
 *
 * Every id, timestamp, and idempotency key below is pinned so the printed
 * output is byte-reproducible in CI.
 */

/** Governed row shape for the release flag whose lineage this fixture walks. */
type ReleaseFlagRow = {
  flagId: string
  enabled: boolean
  rolloutPercent: number
}

const scope = { tenantId: 'org_acme', environment: 'production' } as const

const producer: EvidenceRef = {
  authority: 'self-hosted-example',
  kind: 'principal',
  type: 'service',
  id: 'release_service',
}

const operator: EvidenceRef = {
  authority: 'self-hosted-example',
  kind: 'principal',
  type: 'user',
  id: 'usr_release_manager',
}

/**
 * Declares the governed entity. Only fields listed here can become governed
 * changed paths or enter the state commitment, so the fixture output can never
 * become a raw copy of an application row.
 */
const releaseFlag = defineEntity<ReleaseFlagRow>({
  authority: 'self-hosted-example',
  type: 'release_flag',
  schemaRef: 'release_flag@1',
  fieldSetRef: 'release_flag.governed@1',
  identity: (row) => row.flagId,
  fields: {
    flagId: { capture: 'full' },
    enabled: { capture: 'full' },
    rolloutPercent: { capture: 'full' },
  },
})

const stateV1: ReleaseFlagRow = { flagId: 'flag_checkout', enabled: false, rolloutPercent: 0 }
const stateV2: ReleaseFlagRow = { flagId: 'flag_checkout', enabled: true, rolloutPercent: 25 }
// Byte-identical to stateV1: this is the rollback the id must still tell apart.
const stateV3: ReleaseFlagRow = { flagId: 'flag_checkout', enabled: false, rolloutPercent: 0 }

/**
 * Builds one governed-change draft at the host mutation boundary. The pinned
 * `idempotencyKey` is what makes the change id (and therefore the revision id)
 * reproducible: the helper derives `chg_...` from `tenantId:idempotencyKey`.
 */
function draftStep(
  before: ReleaseFlagRow | undefined,
  after: ReleaseFlagRow,
  actionType: string,
  idempotencyKey: string,
  occurredAt: string,
  expectedParentRevisionRef?: EvidenceRef,
): GovernedChangeDraft {
  return createGovernedActionDraft<ReleaseFlagRow>({
    scope,
    entity: releaseFlag,
    ...(before ? { before } : {}),
    after,
    actionType,
    activityType: 'release.flag.operator_action',
    initiatedBy: operator,
    performedBy: operator,
    producer,
    occurredAt,
    idempotencyKey,
    ...(expectedParentRevisionRef ? { expectedParentRevisionRef } : {}),
    mutationBinding: 'same_transaction',
  })
}

/**
 * Splits a derived revision id back into its two hash components. The format is
 * `rev_<entityType>_<entityId>_<digest12>_<change8>`; both entity type and id
 * may contain underscores, so the components are read from the end.
 */
function revisionIdParts(revisionId: string): { stateDigest12: string; changeScope8: string } {
  const segments = revisionId.split('_')
  return {
    stateDigest12: segments[segments.length - 2] ?? '',
    changeScope8: segments[segments.length - 1] ?? '',
  }
}

/**
 * Renders one lineage step as the side-by-side derivation row the docs page
 * shows: the four inputs `governedRevisionId` consumes, plus the id it returns.
 */
function derivationRow(label: string, draft: GovernedChangeDraft) {
  const { revision, entityRef, changeRef } = draft
  const parts = revisionIdParts(revision.ref.id)
  return {
    label,
    changedPaths: revision.changedPaths,
    parentRevisionIds: revision.parents.map((parent) => parent.id),
    derivationInputs: {
      entityType: releaseFlag.type,
      entityId: entityRef.id,
      stateDigest: revision.stateCommitment.digest,
      changeId: changeRef.id,
    },
    committedFields: revision.stateCommitment.fields,
    revisionId: revision.ref.id,
    revisionIdParts: parts,
  }
}

/**
 * Walks create -> enable -> rollback -> replay(rollback) and returns the
 * evidence needed to read the invariant off the printed output.
 */
export function walkGovernedLineage() {
  const create = draftStep(
    undefined,
    stateV1,
    'release.flag.created',
    'release-flag:flag_checkout:create',
    '2026-08-09T09:00:00.000Z',
  )

  const enable = draftStep(
    stateV1,
    stateV2,
    'release.flag.enabled',
    'release-flag:flag_checkout:enable-25',
    '2026-08-09T09:15:00.000Z',
    create.revision.ref,
  )

  const rollback = draftStep(
    stateV2,
    stateV3,
    'release.flag.rolled_back',
    'release-flag:flag_checkout:rollback-incident-482',
    '2026-08-09T09:40:00.000Z',
    enable.revision.ref,
  )

  // Same tenant + same idempotency key => same change id => same revision id.
  const rollbackReplay = draftStep(
    stateV2,
    stateV3,
    'release.flag.rolled_back',
    'release-flag:flag_checkout:rollback-incident-482',
    '2026-08-09T09:40:00.000Z',
    enable.revision.ref,
  )

  const createDigest = create.revision.stateCommitment.digest
  const rollbackDigest = rollback.revision.stateCommitment.digest

  return {
    entity: {
      ref: releaseFlag.ref(stateV1),
      refKey: refKey(releaseFlag.ref(stateV1)),
      schemaRef: releaseFlag.schemaRef,
      fieldSetRef: releaseFlag.fieldSetRef,
    },
    lineage: [
      derivationRow('v1 create', create),
      derivationRow('v2 enable at 25%', enable),
      derivationRow('v3 rollback to the v1 state', rollback),
      derivationRow('v3 replay (same change, retried)', rollbackReplay),
    ],
    invariants: {
      // The rollback really did restore byte-identical governed state.
      rollbackStateDigestEqualsCreate: rollbackDigest === createDigest,
      // A digest-only id would therefore have collided...
      contentOnlyIdWouldCollide:
        revisionIdParts(create.revision.ref.id).stateDigest12 ===
        revisionIdParts(rollback.revision.ref.id).stateDigest12,
      // ...but the change-scoped suffix keeps the two lineage nodes distinct.
      rollbackRevisionIdDiffersFromCreate: rollback.revision.ref.id !== create.revision.ref.id,
      changeScopeSuffixDiffers:
        revisionIdParts(create.revision.ref.id).changeScope8 !==
        revisionIdParts(rollback.revision.ref.id).changeScope8,
      // Replaying the SAME change is idempotent: identical change and revision ids.
      replayChangeIdIsStable: rollbackReplay.changeRef.id === rollback.changeRef.id,
      replayRevisionIdIsStable: rollbackReplay.revision.ref.id === rollback.revision.ref.id,
      // Lineage stays linear: each revision names its parent explicitly.
      lineageParents: {
        v1: create.revision.parents.map((parent) => parent.id),
        v2: enable.revision.parents.map((parent) => parent.id),
        v3: rollback.revision.parents.map((parent) => parent.id),
      },
    },
    // The exported helper is the same derivation the draft builder uses, so a
    // host that stores only (entityType, entityId, digest, changeId) can
    // recompute any revision id offline.
    recomputedOffline: {
      v1: governedRevisionId(releaseFlag.type, 'flag_checkout', createDigest, create.changeRef.id),
      v3: governedRevisionId(releaseFlag.type, 'flag_checkout', rollbackDigest, rollback.changeRef.id),
      matchesDraftIds:
        governedRevisionId(releaseFlag.type, 'flag_checkout', createDigest, create.changeRef.id) ===
          create.revision.ref.id &&
        governedRevisionId(releaseFlag.type, 'flag_checkout', rollbackDigest, rollback.changeRef.id) ===
          rollback.revision.ref.id,
    },
  }
}

if (import.meta.main) {
  console.log(JSON.stringify(walkGovernedLineage(), null, 2))
}
