import {
  type AuditEventInput,
  type Principal,
  agentToolCalledTemplate,
  changeProposalCreatedTemplate,
  filesChangedTemplate,
} from '@veritio/core'

/**
 * Proves the raw-content guard that `@veritio/core` 0.4.7 applies to the agent
 * and code audit templates: their caller-supplied `metadata` escape hatch fails
 * closed before an event is ever built.
 *
 * Two independent rules are exercised. A key-name rule rejects metadata keys
 * that normally carry raw code, paths, logs, or credential material (`diff`,
 * `filePath`, `stdout`), including nested keys. A value-shape rule rejects
 * strings that look like a git patch or a bearer token even when the key itself
 * is innocuous (`summary`, `note`). Both raise a `TypeError`, so the guard is a
 * hard boundary rather than silent redaction, and the rejected metadata never
 * reaches the hash chain.
 *
 * Every id and timestamp is pinned so the printed messages are byte-stable.
 */

const guardScope = { tenantId: 'org_acme', environment: 'production' } as const
const agentActor: Principal = { type: 'ai_agent', id: 'agt_review_bot' }

interface GuardAttempt {
  readonly label: string
  readonly rule: 'blocked-key' | 'blocked-value-shape'
  readonly build: () => AuditEventInput
}

/**
 * Each attempt passes one deliberately unsafe metadata shape into a template
 * that declares the `block-raw-content` policy. The builders are lazy so the
 * thrown `TypeError` can be caught and reported next to its attempt.
 */
const attempts: GuardAttempt[] = [
  {
    label: "'diff' metadata key on change.proposal.created",
    rule: 'blocked-key',
    build: () =>
      changeProposalCreatedTemplate({
        id: 'evt_guard_diff_key_01',
        occurredAt: '2026-08-09T10:00:00.000Z',
        scope: guardScope,
        proposalId: 'prop_1042',
        actor: agentActor,
        metadata: { diff: 'index.ts | 4 ++--' },
      }),
  },
  {
    label: "'filePath' metadata key on change.files.changed",
    rule: 'blocked-key',
    build: () =>
      filesChangedTemplate({
        id: 'evt_guard_file_path_key_01',
        occurredAt: '2026-08-09T10:01:00.000Z',
        scope: guardScope,
        sourceTreeId: 'tree_5f2a',
        actor: agentActor,
        metadata: { filePath: 'src/billing/invoice.ts' },
      }),
  },
  {
    label: "nested 'stdout' blob on agent.tool.called",
    rule: 'blocked-key',
    build: () =>
      agentToolCalledTemplate({
        id: 'evt_guard_stdout_key_01',
        occurredAt: '2026-08-09T10:02:00.000Z',
        scope: guardScope,
        sessionId: 'ses_agent_01',
        toolCallId: 'tc_0007',
        tool: 'Bash',
        status: 'succeeded',
        agentActor,
        metadata: { result: { stdout: 'installed 412 packages in 9s\n' } },
      }),
  },
  {
    label: "git-diff-shaped value under innocuous key 'summary'",
    rule: 'blocked-value-shape',
    build: () =>
      changeProposalCreatedTemplate({
        id: 'evt_guard_diff_value_01',
        occurredAt: '2026-08-09T10:03:00.000Z',
        scope: guardScope,
        proposalId: 'prop_1043',
        actor: agentActor,
        metadata: { summary: 'diff --git a/src/app.ts b/src/app.ts' },
      }),
  },
  {
    label: "bearer-token-shaped value under innocuous key 'note'",
    rule: 'blocked-value-shape',
    build: () =>
      agentToolCalledTemplate({
        id: 'evt_guard_bearer_value_01',
        occurredAt: '2026-08-09T10:04:00.000Z',
        scope: guardScope,
        sessionId: 'ses_agent_01',
        toolCallId: 'tc_0008',
        tool: 'WebFetch',
        status: 'succeeded',
        agentActor,
        metadata: { note: 'retried with Bearer sk-live-9f2a1c' },
      }),
  },
]

/**
 * Runs one attempt and reduces it to a serializable verdict. A build that does
 * NOT throw is reported as `accepted`, which would be a guard regression rather
 * than a fixture crash — the fixture stays exit-0 and the diff shows it.
 */
function runAttempt(attempt: GuardAttempt): Record<string, unknown> {
  try {
    const event = attempt.build()
    return {
      attempt: attempt.label,
      rule: attempt.rule,
      outcome: 'accepted',
      action: event.action,
    }
  } catch (error) {
    return {
      attempt: attempt.label,
      rule: attempt.rule,
      outcome: 'rejected',
      errorName: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * The minimized counterpart: the same templates accept hashed and counted
 * metadata, so the guard blocks raw content without blocking useful evidence.
 */
function buildAcceptedFilesChanged(): AuditEventInput {
  return filesChangedTemplate({
    id: 'evt_guard_accepted_01',
    occurredAt: '2026-08-09T10:05:00.000Z',
    scope: guardScope,
    sourceTreeId: 'tree_5f2a',
    actor: agentActor,
    fileCount: 2,
    filePathHashes: ['b1946ac92492d234', '591785b794601e21'],
    metadata: { diffHash: 'a7f5f35426b927411fc9231b56382173' },
  })
}

if (import.meta.main) {
  const accepted = buildAcceptedFilesChanged()
  const output = {
    rejections: attempts.map(runAttempt),
    minimizedAlternative: {
      action: accepted.action,
      target: accepted.target,
      metadata: accepted.metadata,
    },
  }
  console.log(JSON.stringify(output, null, 2))
}
