import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProvenanceRecorder } from '@veritio/core'
import { createFileEvidenceStore } from '@veritio/storage'

/**
 * Proves the recorder convention that makes an agent session readable as one
 * unit of work:
 *
 * - One `createProvenanceRecorder` session drives the whole delivery path —
 *   `startSession`, then `recordPrompt`, `recordToolCall`, `recordFileChange`,
 *   `recordReview`, `recordCiRun`, and `recordDeployment` — and every call emits
 *   its family event in the order it was recorded.
 * - EVERY event the session emits carries `metadata.sessionId` and
 *   `metadata.activityEpisodeId` equal to the session's own ids. These are
 *   recorder conventions, not event-schema fields: the downstream change/review/
 *   ci/deploy events target shared entities (source_tree, pull_request, ci_run,
 *   deployment) that no other event attributes back to this session, so a reader
 *   groups the session with a metadata group-by instead of a graph traversal.
 * - Neither stamp can be shadowed. Both are applied AFTER caller-supplied
 *   metadata, so the forged `sessionId`/`activityEpisodeId` this fixture passes
 *   into `startSession` and `recordPrompt` never reach the recorded event — and
 *   because the stamp lands before `createAuditEvent` hashes the record, the
 *   attribution is inside the hash chain rather than beside it.
 * - Neither key matches the metadata redaction pattern, so both survive
 *   redaction intact; both are non-PII stable ids by construction.
 *
 * Every id, hash, and timestamp is pinned, and the temporary evidence directory
 * is discarded, so the printed output is byte-stable across runs.
 */
export const provenanceScope = { tenantId: 'org_acme', environment: 'production' } as const

const SESSION_ID = 'session_release_42'
const ACTIVITY_EPISODE_ID = 'episode_release_42'

/** Forged attribution a caller passes in; the recorder must overwrite both. */
const FORGED_ATTRIBUTION = {
  sessionId: 'session_forged_by_caller',
  activityEpisodeId: 'episode_forged_by_caller',
} as const

/**
 * Runs the pinned end-to-end session against a durable file-backed evidence
 * store and returns the attribution proof the documentation page renders. The
 * store is the host-injected `ProvenanceSinks` implementation — the recorder
 * itself owns no storage — and the directory is removed by the caller so no
 * absolute path ever reaches the output.
 */
export async function recordProvenanceGraph(directory: string) {
  const store = createFileEvidenceStore(directory)
  const recorder = createProvenanceRecorder(store)

  const { session } = await recorder.startSession({
    scope: provenanceScope,
    sessionId: SESSION_ID,
    activityEpisodeId: ACTIVITY_EPISODE_ID,
    occurredAt: '2026-08-09T13:00:00.000Z',
    initiatedBy: { type: 'user', id: 'usr_release_owner' },
    agentActor: { type: 'ai_agent', id: 'agent_coding_01' },
    agent: { name: 'coding-agent', version: '1.0.0' },
    model: { provider: 'example', name: 'review-model' },
    repository: { provider: 'github', id: 'repo_public_id' },
    branch: 'release/4.7',
    promptHash: 'sha256:session-brief-hash',
    // A caller cannot claim a different session or episode: both keys are
    // re-stamped after this metadata is spread in.
    metadata: { ...FORGED_ATTRIBUTION, turnBudget: 12 },
  })

  await session.recordPrompt({
    promptHash: 'sha256:prompt-content-hash',
    occurredAt: '2026-08-09T13:00:05.000Z',
    contextHashes: ['sha256:context-a-hash'],
    metadata: { ...FORGED_ATTRIBUTION, turn: 1 },
  })

  await session.recordToolCall({
    toolCallId: 'tool_edit_01',
    occurredAt: '2026-08-09T13:00:10.000Z',
    tool: 'edit_file',
    status: 'succeeded',
    approval: 'auto',
    inputHash: 'sha256:tool-input-hash',
    reads: [{ id: 'file_auth_service', pathHash: 'sha256:auth-path-hash' }],
    modifies: [
      {
        id: 'file_auth_service',
        pathHash: 'sha256:auth-path-hash',
        beforeHash: 'sha256:auth-before-hash',
        afterHash: 'sha256:auth-after-hash',
        action: 'upsert',
      },
    ],
  })

  await session.recordFileChange({
    sourceTreeId: 'tree_main',
    occurredAt: '2026-08-09T13:00:20.000Z',
    baseVersion: 41,
    resultVersion: 42,
    rootHash: 'sha256:tree-root-hash',
    files: [
      {
        id: 'file_auth_service',
        pathHash: 'sha256:auth-path-hash',
        beforeHash: 'sha256:auth-before-hash',
        afterHash: 'sha256:auth-after-hash',
        action: 'upsert',
      },
    ],
  })

  await session.recordReview({
    pullRequestId: 'pr_1042',
    occurredAt: '2026-08-09T13:05:00.000Z',
    reviewer: { type: 'user', id: 'usr_release_owner' },
    proposalId: 'proposal_release_42',
    decision: 'approved',
    approvalHash: 'sha256:approval-hash',
    findingCount: 0,
  })

  await session.recordCiRun({
    ciRunId: 'ci_run_9001',
    occurredAt: '2026-08-09T13:10:00.000Z',
    service: { type: 'service', id: 'svc_ci' },
    status: 'succeeded',
    checks: ['typecheck', 'test'],
    artifactId: 'artifact_build_42',
    artifactHash: 'sha256:artifact-hash',
    derivedFromFiles: [{ id: 'file_auth_service', pathHash: 'sha256:auth-path-hash' }],
  })

  await session.recordDeployment({
    deploymentId: 'deploy_42',
    occurredAt: '2026-08-09T13:15:00.000Z',
    service: { type: 'service', id: 'svc_deployer' },
    artifactId: 'artifact_build_42',
    bundleHash: 'sha256:bundle-hash',
    sourceHash: 'sha256:tree-root-hash',
    policyId: 'policy_release_gate',
    policyRequirements: ['human_review', 'ci_green'],
  })

  const events = await store.listEvents()
  const edges = await store.listEdges()
  const metadatas = events.map((record) => record.event.metadata as Record<string, unknown>)
  const sessionEventMetadata = metadatas[0] ?? {}
  const promptEventMetadata = metadatas[1] ?? {}

  return {
    eventActions: events.map((record) => record.event.action),
    eventIds: events.map((record) => record.event.id),
    attribution: {
      sessionId: session.sessionId,
      activityEpisodeId: ACTIVITY_EPISODE_ID,
      eventCount: events.length,
      // Every emitted event — the session event and all six downstream events —
      // resolves to exactly one sessionId and one activityEpisodeId.
      everyEventCarriesSessionId: metadatas.every((meta) => meta.sessionId === SESSION_ID),
      everyEventCarriesActivityEpisodeId: metadatas.every(
        (meta) => meta.activityEpisodeId === ACTIVITY_EPISODE_ID,
      ),
      distinctSessionIds: [...new Set(metadatas.map((meta) => meta.sessionId))],
      distinctActivityEpisodeIds: [...new Set(metadatas.map((meta) => meta.activityEpisodeId))],
    },
    callerCannotShadow: {
      suppliedSessionId: FORGED_ATTRIBUTION.sessionId,
      suppliedActivityEpisodeId: FORGED_ATTRIBUTION.activityEpisodeId,
      recordedOnSessionEvent: {
        sessionId: sessionEventMetadata.sessionId,
        activityEpisodeId: sessionEventMetadata.activityEpisodeId,
      },
      recordedOnPromptEvent: {
        sessionId: promptEventMetadata.sessionId,
        activityEpisodeId: promptEventMetadata.activityEpisodeId,
      },
      // The forged ids are absent from the persisted chains entirely, so no
      // reader can be misled by them after the fact.
      forgedIdsPresentAnywhere: JSON.stringify({ events, edges }).includes('forged_by_caller'),
      // Non-attribution caller metadata is preserved untouched.
      callerMetadataPreserved: sessionEventMetadata.turnBudget === 12,
    },
    edgeRelations: edges.map((record) => record.edge.relation),
    verification: await store.verify(),
  }
}

if (import.meta.main) {
  const directory = await mkdtemp(join(tmpdir(), 'veritio-provenance-graph-'))
  try {
    console.log(JSON.stringify(await recordProvenanceGraph(directory), null, 2))
  } finally {
    await rm(directory, { recursive: true })
  }
}
