---
title: Better Auth
description: Map Better Auth lifecycle hooks into portable Veritio events with stable IDs, minimized metadata, and a host-injected server recorder.
audience: [developer]
kind: guide
searchIntent: Record Better Auth user, session, organization, and membership events through Veritio.
questions:
  - How do I connect Better Auth to Veritio?
  - Which Better Auth events can the adapter record?
  - What configuration remains owned by the host application?
lastUpdated: 2026-08-23
verifiedAgainst: ['@veritio/better-auth@0.0.4', '@veritio/core@0.4.7']
sourceRefs:
  - https://github.com/getveritio/veritio/tree/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/adapters/better-auth
claimRefs: []
---

`@veritio/better-auth` maps Better Auth lifecycle hooks into portable Veritio event inputs or records. The host owns Better Auth configuration, tenant resolution, storage, and the decision about which authentication context is necessary to retain.

## Install and create the adapter

```sh
npm install @veritio/better-auth@0.0.4 @veritio/core@0.4.7
```

```ts
import { createAuditRecorder, MemoryAuditStore } from '@veritio/core'
import { createBetterAuthVeritioAdapter } from '@veritio/better-auth'

const recorder = createAuditRecorder({ store: new MemoryAuditStore() })
export const veritioAuth = createBetterAuthVeritioAdapter({
  recorder,
  environment: 'production',
})
```

Replace `MemoryAuditStore` with an authoritative durable store before production.

## Record user creation from a server hook

```ts
databaseHooks: {
  user: {
    create: {
      after: async (user) => {
        await veritioAuth.recordUserCreated({
          user: { id: user.id },
          tenantId: resolveTenantId(user),
        })
      },
    },
  },
}
```

The adapter also records session creation/revocation, organization creation, invitations, membership changes, and role changes through explicit methods. Every call requires stable IDs needed for tenant scope, target identity, and deterministic idempotency material.

## Authentication security context

When the application intentionally retains sign-in security context, pass only allowlisted derived values:

```ts
await veritioAuth.recordSessionCreated({
  user: { id: session.userId },
  session: { id: session.id },
  tenantId: await resolveTenantId(session.userId),
  requestId,
  securityContext: {
    ipAddressHash: await hashIpAddress(session.ipAddress),
    userAgentHash: await hashUserAgent(session.userAgent),
    location: { country: 'DE', region: 'BE' },
  },
})
```

Do not pass passwords, bearer or reset tokens, authorization headers, cookies, raw email addresses, IP addresses, precise locations, or full user-agent strings.

## Deterministic defaults

The verified adapter records authentication lifecycle events with purpose `access_management`, lawful basis `contract`, and retention label `security_1y`. Those are product defaults in this adapter, not universal legal conclusions. A host that cannot support them should choose an explicit mapper or policy boundary instead of silently accepting them.

Idempotency keys are derived from the event type, tenant, and stable resource ID. Replaying the same hook returns the original record; a conflicting payload with the same key fails closed in a conforming store.

## Pure mappers for queues and outboxes

When delivery is owned by a queue, outbox, or hosted client, use a pure builder such as `buildBetterAuthSessionCreatedAuditEventInput`. It returns the same portable `AuditEventInput` without performing storage I/O. The delivery boundary then owns idempotency, retries, and persistence.

## Run an end-to-end application

The repository includes runnable Next.js, React, Vue, SvelteKit, and TanStack Start examples. The Next.js reference exercises Better Auth hooks, governed CRUD, a local evidence feed, and optional server-to-server dispatch:

```sh
git clone https://github.com/getveritio/veritio.git
git -C veritio checkout c4100ee7b678d0c6b227c67ae6ea1d8a1f373967
cd veritio
bun install --frozen-lockfile
bun run verify:examples
```

Inspect the produced record's tenant scope, actor, target, action, governance labels, and idempotency replay. Then change a payload while reusing its idempotency key and confirm the store rejects the conflict.

Use the [Next.js integration](/docs/frameworks/nextjs/) for the full server boundary and [Deterministic redaction](/docs/concepts/redaction/) for the metadata rules.
