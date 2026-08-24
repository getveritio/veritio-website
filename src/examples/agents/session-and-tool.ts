import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProvenanceRecorder } from '@veritio/core'
import { createFileEvidenceStore } from '@veritio/storage'

/**
 * Records one agent session and one minimized tool call, then verifies the
 * durable event and edge chains without ever supplying raw prompt text.
 */
export async function recordAgentSession() {
  const directory = await mkdtemp(join(tmpdir(), 'veritio-agent-session-'))

  try {
    const store = createFileEvidenceStore(directory)
    const recorder = createProvenanceRecorder(store)
    const { session } = await recorder.startSession({
      sessionId: 'session_review_01',
      occurredAt: '2026-08-09T13:00:00.000Z',
      scope: { tenantId: 'org_acme', environment: 'test' },
      initiatedBy: { type: 'user', id: 'usr_reviewer' },
      agentActor: { type: 'ai_agent', id: 'agent_coding_01' },
      agent: { name: 'coding-agent', version: '1.0.0' },
      model: { provider: 'example', name: 'review-model' },
      promptHash: 'sha256:prompt-content-hash',
      repository: { provider: 'github', id: 'repo_public_id' },
    })

    await session.recordToolCall({
      toolCallId: 'tool_read_01',
      occurredAt: '2026-08-09T13:00:01.000Z',
      tool: 'read_file',
      status: 'succeeded',
      inputHash: 'sha256:tool-input-hash',
      reads: [{ id: 'file_auth_service', pathHash: 'sha256:path-hash' }],
    })

    const events = await store.listEvents()
    const edges = await store.listEdges()
    const serialized = JSON.stringify({ events, edges })

    return {
      eventActions: events.map((record) => record.event.action),
      edgeRelations: edges.map((record) => record.edge.relation),
      rawPromptStored: serialized.includes('the raw prompt'),
      verification: await store.verify(),
    }
  } finally {
    await rm(directory, { recursive: true })
  }
}

if (import.meta.main) {
  console.log(JSON.stringify(await recordAgentSession(), null, 2))
}
