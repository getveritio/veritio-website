---
title: Postgres and Neon
description: Wire the published Postgres AuditStore through a host-owned transaction client and run the live authoritative-store conformance suite.
audience: [developer, operator]
kind: guide
searchIntent: Configure a transactional Postgres or Neon AuditStore and prove it with live conformance tests.
questions:
  - How do I connect Veritio to Postgres or Neon?
  - Which transaction invariants make the store authoritative?
  - How do I run the live Postgres conformance suite?
lastUpdated: 2026-08-23
verifiedAgainst: ['@veritio/storage@0.4.7', 'Postgres example at veritio@c4100ee']
sourceRefs:
  - https://github.com/getveritio/veritio/tree/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/examples/storage-postgres-neon
  - https://github.com/getveritio/veritio/blob/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/storage/src/index.ts
claimRefs: []
---

Use Postgres or Neon when several server instances may append to the same tenant. The published factory owns Veritio's ordering rules; your application owns the database driver, credentials, migrations, pool bounds, and transaction lifecycle.

## 1. Install and apply the schema

```sh
bun add @veritio/core@0.4.7 @veritio/storage@0.4.7 pg
```

Start from `POSTGRES_AUDIT_RECORDS_SCHEMA_SQL` exported by `@veritio/storage`, or review the pinned example's `src/schema.sql`. Treat it as a migration input: assign an owner, review indexes and data types, and deploy it through the same migration system as the rest of your service.

The table needs a tenant-scoped primary key for sequence, tenant-scoped uniqueness for the idempotency-key hash, and the full canonical record payload used for read-time integrity validation.

## 2. Adapt the host transaction

The factory accepts a `SqlAuditExecutor`; it does not accept a connection URL. Adapt your driver so `transaction(callback)` supplies an executor bound to the already-open transaction:

```ts
import { createAuditRecorder } from '@veritio/core'
import { createPostgresAuditStore, type SqlAuditExecutor } from '@veritio/storage'

declare const hostExecutor: SqlAuditExecutor

const store = createPostgresAuditStore({ client: hostExecutor })
const recorder = createAuditRecorder({ store })

await recorder.record({
  id: 'evt_invoice_approved_01',
  occurredAt: '2026-08-09T12:10:00.000Z',
  actor: { type: 'user', id: 'usr_reviewer' },
  action: 'invoice.approved',
  target: { type: 'invoice', id: 'inv_123' },
  scope: { tenantId: 'org_acme', environment: 'production' },
  metadata: { approvalPath: 'standard' },
}, { idempotencyKey: 'invoice:inv_123:approval:v1' })
```

The `declare` line is intentional: connection creation belongs to your server framework. Copying a vendor-specific global client into protocol code would hide transaction ownership and secret handling.

## 3. Prove the exact wiring

Clone the pinned OSS revision and run the executable reference example against a disposable database:

```sh
git clone https://github.com/getveritio/veritio.git
git -C veritio checkout c4100ee7b678d0c6b227c67ae6ea1d8a1f373967
cd veritio
bun install --frozen-lockfile
bun run --cwd storage db:up
VERITIO_POSTGRES_TEST_URL=postgresql://veritio:veritio@127.0.0.1:54391/veritio \
  bun test examples/storage-postgres-neon/src
bun run --cwd storage db:down
```

The conformance suite creates a throwaway table, runs the common authoritative-store contract, deliberately mutates a stored record to prove fail-closed reads, and drops the table. Use a disposable database or Neon branch—never a production schema.

## What must happen in one transaction

An append reads or locks the tenant tip, checks idempotency, checks any expected previous hash, inserts the next record, and commits. If your executor opens a second transaction inside the callback or runs some statements on a pool outside the active transaction, concurrent writers can violate the contract even when TypeScript compiles.

## Operational checklist

- Resolve tenant scope before calling the recorder; never derive it from an untrusted request body alone.
- Use a narrowly privileged database role and bounded pool.
- Alert on unique conflicts that are not valid identical retries.
- Back up schema and data together, then restore into isolation and run chain verification.
- Run the live conformance suite after driver, pool, database, or migration changes.
- Keep object archives and ClickHouse projections downstream of this authority.

For a single-process path, use [File store](/docs/storage/file-store/). To assemble the surrounding server boundary, continue to [Self-hosting](/docs/storage/self-hosting/).
