import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const verifier = join(root, 'scripts/verify-billing-catalog.ts')
const snapshot = join(root, 'src/data/cloud-billing-catalog.json')

function runVerifier(args: string[] = [], env: Record<string, string> = {}) {
  return Bun.spawnSync(['bun', 'run', verifier, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
}

describe('billing catalog drift verifier', () => {
  test('accepts the reviewed website snapshot', () => {
    const result = runVerifier()
    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString()).toContain('billing catalog verified')
  })

  test('rejects a sibling export that differs by one billing fact', () => {
    const directory = mkdtempSync(join(tmpdir(), 'veritio-billing-catalog-'))
    const driftedPath = join(directory, 'drifted.json')
    const drifted = JSON.parse(readFileSync(snapshot, 'utf8'))
    drifted.products[0].amountCents = 3000
    writeFileSync(driftedPath, `${JSON.stringify(drifted, null, 2)}\n`)

    const result = runVerifier(['--source', driftedPath])
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr.toString()).toContain('does not match the reviewed website snapshot')
  })

  test('standard verification compares the snapshot with its checked-in source export', () => {
    const directory = mkdtempSync(join(tmpdir(), 'veritio-billing-source-'))
    const driftedPath = join(directory, 'source.json')
    const drifted = JSON.parse(readFileSync(snapshot, 'utf8'))
    drifted.version = 'drifted-source'
    writeFileSync(driftedPath, `${JSON.stringify(drifted, null, 2)}\n`)

    const result = runVerifier([], { VERITIO_CLOUD_CATALOG_SOURCE: driftedPath })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr.toString()).toContain('does not match the reviewed website snapshot')
  })
})
