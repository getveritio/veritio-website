---
title: Hono
description: Use @veritio/core from a Hono server boundary today while keeping the source-only adapter status and host-owned context explicit.
audience: [developer]
kind: guide
searchIntent: Record Veritio evidence at a Hono server boundary using only publicly available APIs.
questions:
  - How do I use Veritio in a Hono route?
  - Is the Veritio Hono adapter a published package?
  - Which request context must the host provide?
lastUpdated: 2026-08-23
verifiedAgainst: ['@veritio/core@0.4.7', 'Hono adapter source at veritio@c4100ee']
sourceRefs:
  - https://github.com/getveritio/veritio/tree/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/adapters/hono
claimRefs: []
---

There is no published `@veritio/hono` package at the verified revision. The repository package is marked `private`, and its README states intent rather than a stable adapter API. A Hono application can still use public `@veritio/core` APIs at its server boundary.

## Install the public dependency

```sh
bun add @veritio/core@0.4.7 hono
```

Create the recorder at the server composition root:

```ts
import { createAuditRecorder, MemoryAuditStore } from '@veritio/core'

export const recorder = createAuditRecorder({
  store: new MemoryAuditStore(),
})
```

`MemoryAuditStore` is only for the local example. Inject an authoritative durable store for production.

## Record after an authorized mutation

```ts
app.post('/entries', async (c) => {
  const session = c.get('session')
  if (!session?.organizationId) return c.json({ error: 'unauthorized' }, 401)

  const entry = await createEntry(await c.req.json())
  const record = await recorder.record({
    actor: { type: 'user', id: session.userId },
    action: 'entry.created',
    target: { type: 'entry', id: entry.id },
    scope: {
      tenantId: session.organizationId,
      environment: 'production',
    },
    requestId: c.req.header('x-request-id'),
    metadata: { source: 'api' },
  }, { idempotencyKey: `entry-created:${entry.id}` })

  return c.json({ entry, evidenceSequence: record.sequence }, 201)
})
```

The example uses only public core APIs. `c.get('session')` represents host middleware that has already authenticated the request and checked organization membership.

## Decide the failure coupling

The code above records after creating the entry. If the evidence append fails, the business row may already exist. For operations that require recoverable coupling, write a Veritio outbox entry in the same transaction as the row and dispatch it from a bounded worker.

Do not report a successful evidence append if the recorder rejected missing tenant scope, an idempotency conflict, or a stale expected chain tip.

## Edge and Worker constraints

Core reads no environment variables, so Workers, Bun, and Node hosts inject configuration at their own composition boundary. Keep storage clients and credentials out of browser code and untrusted edge clients. Verify that the selected storage adapter is compatible with the runtime's connection and transaction model.

## Verification cases

Exercise all four cases:

1. An authenticated member creates an entry and receives a sequence.
2. An unauthenticated request creates no business row and no evidence.
3. A request for another tenant cannot choose its own `tenantId`.
4. Replaying the same logical request returns the original record; changing its payload under the same key fails.

Use the [TypeScript SDK reference](/docs/sdks/typescript/) for the recorder contract and [Storage overview](/docs/storage/overview/) before replacing the local store.
