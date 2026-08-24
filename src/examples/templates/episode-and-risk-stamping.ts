import { type AuditEventInput, createAuditEvent, episodeStartedTemplate } from '@veritio/core'
import { type RiskSignals, scoreRiskSignals, withRiskSignals } from '@veritio/core/risk-score'

/**
 * Proves the two invariants that make an activity episode's risk envelope
 * trustworthy evidence rather than a caller-controlled claim:
 *
 * - `episodeStartedTemplate` always emits the canonical action
 *   `activity.episode.started` with the episode id as the target, so read models
 *   never have to guess which event opens a Layer-1 activity episode.
 * - `riskSignals` are stamped through `withRiskSignals` AFTER caller-supplied
 *   metadata. A host that passes its own `metadata.riskSignals` — whether by
 *   accident or to under-report a destructive operation — cannot shadow the
 *   stamped envelope: the template's normalized signals win the merge, and the
 *   stored value is the fully-defaulted, fail-closed shape the scorer reads.
 *   The same ordering protects `metadata.activityEpisodeId`, the key downstream
 *   events group on.
 *
 * The fixture prints the event BEFORE stamping (no `riskSignals` input, so the
 * caller's unnormalized claim survives untouched) and AFTER stamping (the same
 * caller metadata, now overwritten), then scores both to show how much risk the
 * shadow attempt would have hidden.
 *
 * Every id and timestamp is pinned, so the printed output is byte-stable across
 * runs. `withRiskSignals` is non-mutating, so both branches share one caller
 * metadata object without contaminating each other.
 */

export const episodeScope = { tenantId: 'org_acme', environment: 'production' } as const

const ACTIVITY_EPISODE_ID = 'aep_release_2026_08_09_01'

/**
 * Metadata as a host application would hand it in. `riskSignals` here is the
 * hostile/mistaken case: a caller asserting a cheap `read` envelope for what is
 * actually a destructive production release. `activityEpisodeId` is a second
 * shadow attempt against the episode grouping key.
 */
const callerMetadata: Record<string, unknown> = {
  domain: 'release',
  releaseId: 'rel_4471',
  riskSignals: { operationType: 'read' },
  activityEpisodeId: 'aep_caller_supplied',
}

/** The signals the trusted capture boundary actually observed for this episode. */
const observedSignals: RiskSignals = {
  operationType: 'destructive',
  reversibility: 'irreversible',
  envCriticality: 'production',
  fanOut: 3,
}

const releaseBot = { type: 'service', id: 'svc_release_bot' } as const

/**
 * Builds the pinned episode-started event. Passing `riskSignals` switches on the
 * post-caller stamp; omitting it leaves whatever the caller put in metadata,
 * which is exactly the difference this fixture measures.
 */
export function buildEpisodeStarted(riskSignals?: RiskSignals): AuditEventInput {
  return episodeStartedTemplate({
    id: 'evt_episode_started_01',
    occurredAt: '2026-08-09T10:00:00.000Z',
    scope: episodeScope,
    activityEpisodeId: ACTIVITY_EPISODE_ID,
    actor: releaseBot,
    domain: 'release',
    startReason: 'deploy_requested',
    metadata: callerMetadata,
    riskSignals,
  })
}

if (import.meta.main) {
  const before = buildEpisodeStarted()
  const after = buildEpisodeStarted(observedSignals)

  const callerClaim = callerMetadata.riskSignals as RiskSignals
  const stamped = after.metadata?.riskSignals as RiskSignals
  const sealed = createAuditEvent(after)

  const output = {
    beforeStamping: before,
    afterStamping: after,
    proof: {
      // The template owns the action; neither branch can drift off it.
      action: after.action,
      actionIsEpisodeStarted: after.action === 'activity.episode.started',
      targetIsTheEpisode: after.target,
      // Without a stamp the caller's raw, unnormalized claim is simply what the
      // event carries — the template makes no risk assertion of its own.
      callerClaimSurvivesWithoutStamp:
        JSON.stringify(before.metadata?.riskSignals) === JSON.stringify(callerClaim),
      // With a stamp the caller's key is replaced, not merged into.
      stampOverwritesCallerClaim: stamped.operationType === 'destructive',
      callerClaimAbsentAfterStamping: stamped.operationType !== callerClaim.operationType,
      // Non-risk caller keys are preserved: the stamp is targeted, not a wipe.
      unrelatedCallerKeysPreserved: {
        domain: after.metadata?.domain,
        releaseId: after.metadata?.releaseId,
      },
      // Same post-caller ordering protects the episode grouping key.
      activityEpisodeIdUnshadowable: after.metadata?.activityEpisodeId === ACTIVITY_EPISODE_ID,
      // withRiskSignals is the primitive the template uses, and it is non-mutating.
      directStamp: withRiskSignals(callerMetadata, observedSignals).riskSignals,
      callerMetadataUnmutated: (callerMetadata.riskSignals as RiskSignals).operationType,
    },
    riskHiddenByTheShadowAttempt: {
      callerClaimScore: scoreRiskSignals(callerClaim).score,
      callerClaimLevel: scoreRiskSignals(callerClaim).level,
      stampedScore: scoreRiskSignals(stamped).score,
      stampedLevel: scoreRiskSignals(stamped).level,
    },
    sealedEvent: {
      // createAuditEvent normalizes and redacts; the stamped envelope survives
      // intact because riskSignals is a scored classification, never PII.
      schemaVersion: sealed.schemaVersion,
      action: sealed.action,
      riskSignals: sealed.metadata.riskSignals,
      activityEpisodeId: sealed.metadata.activityEpisodeId,
    },
  }

  console.log(JSON.stringify(output, null, 2))
}
