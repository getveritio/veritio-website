import {
  buildExportBundle,
  parseExportBundle,
  serializeExportBundle,
  verifyExportBundle,
} from '@veritio/core'
import { recordTutorialChain } from '../tutorial/record-and-verify'

/**
 * Builds, serializes, parses, and verifies one unsigned full-chain bundle, then
 * changes a copied record file to prove that integrity failure is detected.
 */
export async function buildAndVerifyExport() {
  const records = await recordTutorialChain()
  const bundle = await buildExportBundle({
    scope: { tenantId: 'org_acme', environment: 'production' },
    range: {
      from: '2026-08-09T10:00:00.000Z',
      to: '2026-08-09T10:01:00.000Z',
    },
    producer: {
      authority: 'self-hosted-example',
      kind: 'principal',
      type: 'service',
      id: 'export_worker',
    },
    createdAt: '2026-08-09T10:02:00.000Z',
    events: records,
    edges: [],
    commits: [],
  })

  const parsed = parseExportBundle(serializeExportBundle(bundle))
  const validReport = await verifyExportBundle(parsed)
  const tampered = structuredClone(parsed)
  tampered.files['records/audit-events.jsonl'] = tampered.files['records/audit-events.jsonl'].replace('viewer', 'admin')
  const tamperedReport = await verifyExportBundle(tampered)

  return {
    bundleVersion: parsed.bundleVersion,
    files: parsed.manifest.files.map((file) => file.path),
    valid: validReport,
    tampered: {
      valid: tamperedReport.valid,
      integrity: tamperedReport.checks.integrity,
      issueCount: tamperedReport.issues.length,
    },
  }
}

if (import.meta.main) {
  console.log(JSON.stringify(await buildAndVerifyExport(), null, 2))
}
