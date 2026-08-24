---
title: Next.js
description: Record route-handler and server-action evidence through the thin @veritio/next adapter while keeping auth, tenant scope, and storage host-owned.
audience: [developer]
kind: guide
searchIntent: Record and verify Veritio evidence from Next.js route handlers and server actions.
questions:
  - How do I integrate Veritio with Next.js?
  - Where should a Next.js application record audit evidence?
  - How do I verify the resulting records?
lastUpdated: 2026-08-23
verifiedAgainst: ['@veritio/next@0.0.4', '@veritio/core@0.4.7']
sourceRefs:
  - https://github.com/getveritio/veritio/tree/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/adapters/next
  - https://github.com/getveritio/veritio/tree/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/examples/nextjs-better-auth
claimRefs: []
---

Use `@veritio/next` at server boundaries after the application has authenticated the actor, resolved tenant scope, and completed or atomically staged the business mutation. The adapter translates host context; it does not own authentication, storage, or protocol semantics.

## Install the published adapter

```sh
npm install @veritio/next@0.0.4 @veritio/core@0.4.7
```

Create the recorder and adapter in a server-only module:

```ts
import { createAuditRecorder, MemoryAuditStore } from '@veritio/core'
import { createNextVeritioAdapter } from '@veritio/next'

const recorder = createAuditRecorder({ store: new MemoryAuditStore() })

export const veritio = createNextVeritioAdapter({
  recorder,
  environment: 'production',
  resolveContext: async ({ request }) => {
    const session = await readSession(request)
    return {
      tenantId: session.organizationId,
      actor: { type: 'user', id: session.userId },
      requestId: request.headers.get('x-request-id') ?? undefined,
    }
  },
})
```

`resolveContext` runs for each record call. Missing actor or tenant context raises before a scopeless event can be written.

## Route handler: record after success

```ts
export async function POST(request: Request) {
  const entry = await createEntry(request)
  await veritio.recordRouteHandler({
    request,
    action: 'entry.created',
    target: { type: 'entry', id: entry.id },
    metadata: { source: 'api' },
  })
  return Response.json(entry, { status: 201 })
}
```

This ordering is correct only when the application accepts the possibility that the business mutation succeeds and the later evidence append fails. When both outcomes must move together, stage a Veritio outbox entry in the same database transaction as the mutation and dispatch it asynchronously.

## Server action: wrap the completed operation

```ts
export async function renameEntry(id: string, title: string) {
  return veritio.withServerAction(
    { action: 'entry.renamed', target: { type: 'entry', id } },
    () => updateEntryTitle(id, title),
  )
}
```

The wrapper records only when the handler resolves. Business failures must remain failures; do not emit a completed-change event when the mutation rejected.

## Run the full reference application

The public reference contains a Next.js 16 App Router application, Better Auth lifecycle capture, governed mutations, a transactional outbox, agent-session provenance, and optional server-to-server Cloud dispatch.

```sh
git clone https://github.com/getveritio/veritio.git
git -C veritio checkout c4100ee7b678d0c6b227c67ae6ea1d8a1f373967
cd veritio
bun install --frozen-lockfile
cd examples/nextjs-better-auth
bun run typecheck
bun run build
bun run dev
```

Open the local application, edit an entry, run the cost agent, or roll back to a previous revision. The example works local-only without hosted credentials. Its change feed distinguishes local evidence from dispatched evidence.

## Host responsibilities

- Resolve the session, organization membership, actor, and request ID.
- Keep the recorder, database pool, HMAC material, and ingest credentials server-side.
- Choose whether a direct append, queue, or transactional outbox owns delivery.
- Use stable IDs and allowlisted metadata; hash sensitive comparison material before capture.
- Verify records from the authoritative store and handle failures as operational incidents.

The adapter passes per-call idempotency and append options to core. Governance labels such as purpose, lawful basis, data categories, and retention remain explicit host choices.

Continue with [Better Auth](/docs/frameworks/better-auth/) for authentication events or [Postgres storage](/docs/storage/postgres/) for a durable authoritative boundary.
