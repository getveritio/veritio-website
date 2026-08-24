---
title: Self-hosting
description: Assemble the source-backed Node server, an authoritative store, authentication, backups, and recovery verification without a Cloud dependency.
audience: [operator, developer]
kind: guide
searchIntent: Assemble and operate a self-hosted Veritio evidence boundary from implemented public modules.
questions:
  - Which Veritio server and storage modules are available for self-hosting?
  - Is the Node server a published production distribution?
  - How should I test backup restore and tenant isolation?
lastUpdated: 2026-08-23
verifiedAgainst: ['OSS server source at veritio@c4100ee', '@veritio/storage@0.4.7']
sourceRefs:
  - https://github.com/getveritio/veritio/tree/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/server/node
  - https://github.com/getveritio/veritio/tree/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/storage
claimRefs: []
---

Self-hosting means operating the evidence boundary as part of your own service architecture. The public repository contains a Node Workbench/server module for integration proof and public storage factories for production host wiring. It does **not** ship a turnkey hardened appliance.

## What is implemented

At the pinned revision, `server/node` provides event and edge ingestion, chain verification, graph query, a local scenario, export preview, a browser Workbench, and an MCP JSON-RPC handler. The package is marked `private: true`, so build it from the OSS checkout; do not claim an npm installation path.

```sh
git clone https://github.com/getveritio/veritio.git
git -C veritio checkout c4100ee7b678d0c6b227c67ae6ea1d8a1f373967
cd veritio
bun install --frozen-lockfile
bun run --cwd server/node build
bun run --cwd server/node test
```

For a local-only Workbench:

```ts
import { startWorkbenchServer } from '@veritio/server'

const server = await startWorkbenchServer({
  host: '127.0.0.1',
  port: 4983,
  allowWriteTools: false,
})

console.log(server.url)
```

Keep it on `127.0.0.1` unless you have added an authenticated network boundary. Read-only MCP tools are the default; enabling write tools materially changes the trust surface.

## Production architecture

```text
authenticated application request
  -> server-owned authorization and tenant resolution
  -> deterministic normalization and redaction
  -> authoritative AuditStore transaction
  -> optional outbox-backed derived projections
  -> independently retained verification report
```

The public server module is a reference integration surface. A production host must provide:

- TLS termination and authenticated caller identity;
- tenant authorization on every ingest and query;
- a transaction-capable authoritative store;
- request-size, rate, timeout, and concurrency limits;
- durable outbox handling where evidence loss matters;
- secret management, log redaction, monitoring, and incident response;
- backups, isolated restore drills, and upgrade rollback;
- explicit retention execution for authoritative and derived copies.

## Recovery exercise

1. Record a known two-event canary and retain its event IDs and last hash outside the database.
2. Take the same backup type you will use in production.
3. Restore it into an isolated environment with outbound access disabled.
4. Read every restored tenant chain through the authoritative adapter so hashes are revalidated.
5. Run `verifyAuditRecords` for the full ordered chain and compare the canary tip.
6. Verify derived archives separately; do not let them mask an invalid authority.
7. Record the restore duration and failed invariants as release evidence.

## Security tests that block release

- Tenant A cannot append, list, verify, export, or graph-query Tenant B.
- A conflicting idempotency replay is rejected, not silently deduplicated.
- Concurrent appends remain gapless and correctly linked.
- Corrupted persisted bytes fail on read and in the verifier.
- A failed authoritative append is never reported as delivered.
- Read-only MCP configuration cannot invoke mutation tools.
- Withdrawal or deletion workflows cover every configured derived copy.

Veritio provides evidence support; your deployment still owns authorization, availability, recovery, and regulatory interpretation. If you prefer an optional managed boundary, compare [Veritio Cloud](/docs/cloud/overview/) after completing the OSS path.
