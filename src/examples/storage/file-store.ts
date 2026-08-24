import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFileEvidenceStore } from '@veritio/storage'

/**
 * Proves that the published file store persists two tenant-scoped events across
 * independent store instances and re-verifies all three local evidence chains.
 */
export async function persistReopenAndVerify() {
  const directory = await mkdtemp(join(tmpdir(), 'veritio-file-store-'))

  try {
    const writer = createFileEvidenceStore(directory)
    await writer.recordEvent({
      id: 'evt_invoice_created_01',
      occurredAt: '2026-08-09T12:00:00.000Z',
      actor: { type: 'service', id: 'billing_api' },
      action: 'invoice.created',
      target: { type: 'invoice', id: 'inv_123' },
      scope: { tenantId: 'org_acme', environment: 'test' },
      metadata: { currency: 'USD' },
    })
    await writer.recordEvent({
      id: 'evt_invoice_sent_01',
      occurredAt: '2026-08-09T12:01:00.000Z',
      actor: { type: 'service', id: 'billing_api' },
      action: 'invoice.sent',
      target: { type: 'invoice', id: 'inv_123' },
      scope: { tenantId: 'org_acme', environment: 'test' },
      metadata: { channel: 'email' },
    })

    const readerAfterRestart = createFileEvidenceStore(directory)
    const events = await readerAfterRestart.listEvents()
    const verification = await readerAfterRestart.verify()

    return {
      eventSequences: events.map((record) => record.sequence),
      reopenedEventCount: events.length,
      verification,
    }
  } finally {
    await rm(directory, { recursive: true })
  }
}

if (import.meta.main) {
  console.log(JSON.stringify(await persistReopenAndVerify(), null, 2))
}
