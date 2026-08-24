import {
  type AuditEvent,
  type AuditRecord,
  type AuditStore,
  type AuditStoreAppendOptions,
  type AuditStoreListOptions,
  type EvidenceScope,
  HASH_ALGORITHM,
  canonicalJson,
  hashAuditRecord,
  hashIdempotencyKey,
} from '@veritio/core'
import {
  type AuditStoreConformanceCorruption,
  createAuditStoreConformanceTests,
} from '@veritio/storage/conformance'

/**
 * Proves that a custom `AuditStore` — one this file implements, not one Veritio
 * ships — can be validated against the same published conformance suite the
 * Postgres, MySQL, MariaDB, and Mongo adapters must pass.
 *
 * `createAuditStoreConformanceTests` is the whole contract for authoritative
 * evidence storage, expressed as executable checks. A store only counts as
 * authoritative when it satisfies every one of them:
 *
 * - gapless, tenant-local sequences and previous-hash linkage, with one
 *   tenant's chain never visible from another tenant's scope;
 * - idempotent replay by key, and a fail-closed `idempotency conflict` when the
 *   same key is reused for different event bytes;
 * - fail-closed rejection of a missing `scope.tenantId` and of a stale
 *   `expectedPreviousHash` compare-and-append;
 * - cloned reads, so a caller mutating a returned record cannot reach stored
 *   evidence;
 * - re-verification on read: the suite corrupts a stored record behind the
 *   store's back through `mutateStoredRecord`, and the store must refuse to
 *   hand it out rather than return tampered evidence.
 *
 * That last check is why the store below serializes each record to a JSON
 * string in its row map: the corruption seam is the stored bytes, exactly as it
 * would be in a real database column, and every read re-hashes those bytes with
 * `hashAuditRecord` before the record escapes.
 *
 * The appended-at timestamp is pinned so the printed result is byte-stable
 * across runs.
 */
const PINNED_APPENDED_AT = '2026-08-09T10:00:00.000Z'

/** One serialized evidence row, standing in for a database row. */
type StoredRow = {
  tenantId: string
  sequence: number
  idempotencyKeyHash: string
  eventCanonical: string
  recordJson: string
}

/**
 * A custom store plus the raw rows behind it. The conformance target needs the
 * row handle to simulate out-of-band tampering; application code never does.
 */
export type SerializedAuditStore = AuditStore & { rows: StoredRow[] }

/**
 * Extracts the tenant id an append must be scoped to, failing closed before any
 * write when scope is missing. Tenant scope is what keeps one tenant's chain
 * from ever being appended to or read by another.
 */
function requireTenantId(event: AuditEvent): string {
  const tenantId = event.scope?.tenantId
  if (typeof tenantId !== 'string' || tenantId.length === 0) {
    throw new TypeError('scope.tenantId is required')
  }
  return tenantId
}

/**
 * Parses a stored row back into a record and re-verifies it before returning
 * it. Integrity is checked on every read, not only at append time, so a record
 * edited directly in the backing store fails closed instead of being served as
 * evidence. Parsing also makes the returned record a clone, so callers can
 * never mutate stored bytes through a reference.
 */
function readStoredRow(row: StoredRow, expectedTenantId: string): AuditRecord {
  const record = JSON.parse(row.recordJson) as AuditRecord
  if (record.event.scope?.tenantId !== expectedTenantId) {
    throw new TypeError('stored audit record tenant mismatch')
  }
  if (hashAuditRecord(record) !== record.hash) {
    throw new TypeError('stored audit record integrity check failed')
  }
  return record
}

/**
 * Builds the in-process custom `AuditStore` under test. It owns tenant-local
 * sequencing, idempotency uniqueness, and compare-and-append against the tenant
 * chain tip; hashing itself is never reimplemented, only delegated to
 * `hashAuditRecord` / `hashIdempotencyKey` from `@veritio/core`.
 */
export function createSerializedAuditStore(): SerializedAuditStore {
  const rows: StoredRow[] = []

  return {
    rows,

    /**
     * Appends one event to the tenant-local chain. Replaying an idempotency key
     * with identical event bytes returns the original record; reusing it for
     * different bytes, or appending against a stale chain tip, fails closed.
     */
    async append(event: AuditEvent, options: AuditStoreAppendOptions = {}): Promise<AuditRecord> {
      const tenantId = requireTenantId(event)
      const idempotencyKeyHash = hashIdempotencyKey(tenantId, options.idempotencyKey ?? event.id)
      const eventCanonical = canonicalJson(event)

      const existing = rows.find(
        (row) => row.tenantId === tenantId && row.idempotencyKeyHash === idempotencyKeyHash,
      )
      if (existing) {
        if (existing.eventCanonical !== eventCanonical) {
          throw new TypeError('idempotency conflict')
        }
        return readStoredRow(existing, tenantId)
      }

      const tipRow = rows
        .filter((row) => row.tenantId === tenantId)
        .sort((left, right) => right.sequence - left.sequence)[0]
      const tip = tipRow ? readStoredRow(tipRow, tenantId) : undefined
      const previousHash = tip?.hash ?? null
      if (options.expectedPreviousHash !== undefined && options.expectedPreviousHash !== previousHash) {
        throw new TypeError('expectedPreviousHash does not match tenant chain tip')
      }

      const recordWithoutHash: Omit<AuditRecord, 'hash'> = {
        event,
        sequence: (tip?.sequence ?? 0) + 1,
        previousHash,
        hashAlgorithm: HASH_ALGORITHM,
        canonicalization: 'veritio-json-v1',
        appendedAt: PINNED_APPENDED_AT,
        idempotencyKeyHash,
      }
      const record: AuditRecord = { ...recordWithoutHash, hash: hashAuditRecord(recordWithoutHash) }
      const row: StoredRow = {
        tenantId,
        sequence: record.sequence,
        idempotencyKeyHash,
        eventCanonical,
        recordJson: JSON.stringify(record),
      }
      rows.push(row)
      return readStoredRow(row, tenantId)
    },

    /**
     * Lists one tenant's records in sequence order. Tenant scope is mandatory,
     * and every row is re-verified on the way out.
     */
    async list(
      scope: EvidenceScope & { tenantId: string },
      options: AuditStoreListOptions = {},
    ): Promise<AuditRecord[]> {
      if (typeof scope.tenantId !== 'string' || scope.tenantId.length === 0) {
        throw new TypeError('scope.tenantId is required')
      }
      const afterSequence = options.afterSequence ?? 0
      const matching = rows
        .filter((row) => row.tenantId === scope.tenantId && row.sequence > afterSequence)
        .sort((left, right) => left.sequence - right.sequence)
      const limited = options.limit === undefined ? matching : matching.slice(0, options.limit)
      return limited.map((row) => readStoredRow(row, scope.tenantId))
    },
  }
}

/**
 * Rewrites stored bytes behind the store's back so the suite can prove reads
 * fail closed on tampering. This is a test seam only: it is deliberately not
 * reachable through the `AuditStore` interface.
 */
function mutateStoredRow(store: SerializedAuditStore, corruption: AuditStoreConformanceCorruption): void {
  const index = store.rows.findIndex(
    (row) => row.tenantId === corruption.tenantId && row.sequence === corruption.sequence,
  )
  if (index === -1) {
    throw new TypeError('stored audit record not found')
  }
  const row = store.rows[index]!
  const record = JSON.parse(row.recordJson) as AuditRecord
  const nextRecord = corruption.mutate(record) ?? record
  store.rows[index] = { ...row, recordJson: JSON.stringify(nextRecord) }
}

/** One conformance check name paired with whether the custom store satisfied it. */
export type ConformanceCheckResult = { name: string; ok: boolean; error?: string }

/**
 * Runs every published conformance check against a fresh instance of the custom
 * store and reports each check by name. Each check gets its own target so state
 * from one tenant-chain scenario can never mask a failure in the next.
 */
export async function runStoreConformanceSuite(): Promise<ConformanceCheckResult[]> {
  const checks = createAuditStoreConformanceTests({
    name: 'serialized-in-process-store',
    createTarget() {
      const store = createSerializedAuditStore()
      return {
        store,
        mutateStoredRecord(corruption) {
          mutateStoredRow(store, corruption)
        },
      }
    },
  })

  const results: ConformanceCheckResult[] = []
  for (const check of checks) {
    try {
      await check.run()
      results.push({ name: check.name, ok: true })
    } catch (error) {
      results.push({
        name: check.name,
        ok: false,
        error: (error instanceof Error ? error.message : String(error)).split('\n')[0],
      })
    }
  }
  return results
}

if (import.meta.main) {
  const checks = await runStoreConformanceSuite()
  const output = {
    store: 'serialized-in-process-store',
    checkCount: checks.length,
    checks,
    conformant: checks.every((check) => check.ok),
  }
  console.log(JSON.stringify(output, null, 2))
}
