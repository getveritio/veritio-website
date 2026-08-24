import {
  type AuditRecord,
  type AuditRecorder,
  type AuditStore,
  type EvidenceScope,
  type Principal,
  MemoryAuditStore,
  createAuditRecorder,
  verifyAuditRecords,
} from '@veritio/core'

/**
 * Proves the adapter boundary contract that every Veritio framework adapter
 * (better-auth, next, tanstack-start, sveltekit, react, vue, svelte) is written
 * against, using ONLY `@veritio/core`. No adapter package is imported on
 * purpose: the host application owns configuration, so the boundary is provable
 * without any of them installed.
 *
 * The invariants this fixture pins:
 *
 * - The host constructs the `AuditStore` at its own server process boundary and
 *   wraps it with `createAuditRecorder`. Storage credentials are arguments to
 *   that construction and to nothing downstream.
 * - What crosses into a thin adapter is exactly three values — a configured
 *   `AuditRecorder`, the tenant `EvidenceScope`, and the authenticated
 *   `Principal`. A deep key scan of that payload contains zero credential-shaped
 *   keys, so an adapter cannot forward a secret it was never handed.
 * - `AuditRecorder` is a one-method capability (`record`). It exposes no `store`
 *   and no `list`, so an adapter can append evidence but can neither read
 *   another tenant's chain nor reconfigure storage.
 * - Redaction is the last line of defence at that boundary: an adapter that
 *   forwards raw request headers still cannot write a bearer token into
 *   evidence, because `createAuditEvent` redacts sensitive keys deterministically
 *   BEFORE canonical JSON and hashing.
 *
 * Every id, timestamp, and key is pinned. Record hashes and `appendedAt` are
 * deliberately NOT printed: `MemoryAuditStore` stamps `appendedAt` from the wall
 * clock and folds it into the record hash, so only chain-shape facts and the
 * verifier result are byte-stable.
 */

export const boundaryScope = {
  tenantId: 'org_acme',
  environment: 'production',
} as const satisfies EvidenceScope & { tenantId: string }

/**
 * Server-only storage configuration. In a real host this is read once at the
 * process boundary (`process.env`, a secrets manager, a Worker binding) and is
 * the sole input to the store constructor. It is declared here so the fixture
 * can prove, by key scan, that none of these names reach the adapter payload.
 * Only the key NAMES are ever printed; the placeholder values never are.
 */
const serverOnlyStorageConfig = {
  driver: 'postgres',
  connectionString: 'postgresql://evidence@db.internal:5432/evidence',
  databasePassword: 'placeholder-not-a-real-password',
  archiveBucket: 'acme-evidence-archive',
  archiveAccessKeyId: 'PLACEHOLDER-NOT-A-REAL-KEY',
  archiveSecretAccessKey: 'placeholder-not-a-real-secret',
  ingestApiKey: 'placeholder-not-a-real-api-key',
} as const

/**
 * Builds the recorder the host injects into adapters. In production the store is
 * `createPostgresAuditStore({ ... })` (or any conforming `AuditStore`) built
 * HERE from `serverOnlyStorageConfig`; `MemoryAuditStore` keeps this fixture
 * runnable without a database while honouring the identical `AuditStore`
 * contract. The config object is intentionally not threaded any further: the
 * recorder closes over the store, and the store closes over the credentials.
 */
function createServerRecorder(): AuditRecorder {
  const store: AuditStore = new MemoryAuditStore()
  return createAuditRecorder({ store })
}

/**
 * The whole surface a thin framework adapter is allowed to receive. Adapters
 * translate framework requests into recorder calls; they never own protocol,
 * storage, tenancy, or credential semantics.
 */
export interface AdapterContext {
  recorder: AuditRecorder
  scope: EvidenceScope & { tenantId: string }
  principal: Principal
}

/**
 * Stand-in for the request shape a framework hands an adapter. `headers` carries
 * a deliberately credential-shaped entry so the fixture can prove core redaction
 * catches it; the placeholder value is not a real token and is never printed.
 */
interface AdapterRequest {
  requestId: string
  occurredAt: string
  sessionId: string
  headers: Record<string, string>
}

/**
 * Models what a thin adapter is permitted to do: map one framework request onto
 * one `recorder.record` call. It reads no environment variable, holds no store
 * handle, and picks no tenant of its own — scope and principal arrive from the
 * host. The idempotency key is derived from the host's session id so a retried
 * request replays the same record instead of forking the chain.
 */
export async function recordSignInFromAdapter(
  context: AdapterContext,
  request: AdapterRequest,
): Promise<AuditRecord> {
  return context.recorder.record(
    {
      id: `evt_${request.requestId}`,
      occurredAt: request.occurredAt,
      actor: context.principal,
      action: 'auth.session.created',
      target: { type: 'session', id: request.sessionId },
      scope: context.scope,
      requestId: request.requestId,
      purpose: 'access_management',
      lawfulBasis: 'contract',
      retention: 'security_1y',
      metadata: {
        method: 'password',
        // An adapter that forwards request context verbatim is the realistic
        // leak path. Core redaction, not adapter discipline, is what makes it
        // safe: this value never reaches canonical JSON or the record hash.
        authorization: request.headers.authorization,
      },
    },
    { idempotencyKey: `auth.session.created:${request.sessionId}` },
  )
}

const CREDENTIAL_KEY_PATTERN =
  /(password|secret|token|api[_-]?key|authorization|credential|connection[_-]?string|access[_-]?key)/i

/**
 * Collects every property name reachable from a value through plain objects and
 * arrays. Function-valued properties are recorded by name but not descended
 * into, which is what makes the recorder's one-method surface visible in the
 * scan instead of hidden behind a closure.
 */
function collectKeys(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, into)
    return into
  }
  if (value === null || typeof value !== 'object') return into
  for (const key of Object.keys(value as Record<string, unknown>)) {
    into.add(key)
    collectKeys((value as Record<string, unknown>)[key], into)
  }
  return into
}

if (import.meta.main) {
  const recorder = createServerRecorder()

  const context: AdapterContext = {
    recorder,
    scope: boundaryScope,
    principal: { type: 'user', id: 'usr_owner' },
  }

  const record = await recordSignInFromAdapter(context, {
    requestId: 'req_7c2a',
    occurredAt: '2026-08-09T10:00:00.000Z',
    sessionId: 'sess_4b81',
    headers: { authorization: 'Bearer placeholder-not-a-real-token' },
  })

  const keysCrossingIntoAdapter = [...collectKeys(context)].sort()

  const output = {
    hostOwnedWiring: {
      note: 'The host builds the AuditStore at its own process boundary and injects a recorder. @veritio/core never reads environment variables or framework globals.',
      serverOnlyConfigKeys: Object.keys(serverOnlyStorageConfig).sort(),
      scope: boundaryScope,
      principal: context.principal,
    },
    adapterContract: {
      contextKeys: Object.keys(context).sort(),
      recorderMethods: Object.keys(recorder).sort(),
      recorderExposesStore: 'store' in recorder,
      recorderCanListOtherChains: 'list' in recorder,
      keysCrossingIntoAdapter,
      credentialShapedKeysCrossing: keysCrossingIntoAdapter.filter((key) =>
        CREDENTIAL_KEY_PATTERN.test(key),
      ),
    },
    adapterCall: {
      action: record.event.action,
      sequence: record.sequence,
      previousHash: record.previousHash,
      requestId: record.event.requestId,
      tenantId: record.event.scope?.tenantId,
      environment: record.event.scope?.environment,
      actor: record.event.actor,
      target: record.event.target,
      retention: record.event.retention,
      verification: verifyAuditRecords([record]),
    },
    requestContextGuard: {
      note: 'createAuditEvent redacts sensitive metadata keys before canonical JSON and hashing, so a forwarded Authorization header cannot become evidence.',
      metadata: record.event.metadata,
      forwardedHeaderStored: record.event.metadata.authorization,
    },
    neverCrossesIntoBrowser: [
      'AuditStore instances and their driver connections',
      'database connection strings and passwords',
      'object-archive bucket names, access key ids, and secret access keys',
      'hosted-provider ingest API keys and export signing keys',
      'raw Authorization headers, cookies, and bearer tokens',
      'any @veritio/storage import (it is a server-only package)',
    ],
    safeInBrowser: [
      'action names and target types rendered in a UI',
      'tenant-scoped ids the viewer is already authorised to see',
      'record sequence numbers and record hashes for display',
      'risk math imported from the crypto-free @veritio/core/risk-score subpath',
    ],
  }

  console.log(JSON.stringify(output, null, 2))
}
