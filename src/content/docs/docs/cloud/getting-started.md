---
title: Cloud getting started
description: Create a hosted project and scoped ingest key, send one server-side event, verify its evidence view, and test revocation behavior.
audience: [developer, operator]
kind: tutorial
searchIntent: Create a Veritio Cloud project and scoped key, then validate one minimized server-side ingest end to end.
questions:
  - How do I create a Veritio Cloud project and ingest key?
  - Where should the ingest key be stored?
  - How do I prove delivery and key revocation?
lastUpdated: 2026-08-23
verifiedAgainst: ['Veritio Cloud public claims · 2026-08-09', '@veritio/core@0.4.7']
sourceRefs:
  - https://getveritio.com/claims.json
  - https://github.com/getveritio/veritio/blob/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/sdks/typescript/src/index.ts
claimRefs: [cloud-projects-keys-ingest, cloud-evidence-views]
---

This tutorial validates the managed boundary with one non-sensitive canary event. Use the exact ingest URL and secret shown by your console; do not infer or hard-code an undocumented route.

## 1. Create the project

Sign in to the Cloud console, create or select the organization, and create a project dedicated to the environment you are testing. Record the public project identifier in normal configuration. Do not put the secret key in source control.

Before continuing, confirm your account can see the project and that switching to another project changes the visible evidence boundary.

## 2. Issue an ingest-scoped key

Create a key limited to ingest for that project. Copy the secret once into your server-side secret manager and store the console-provided ingest URL beside it.

Use two process variables at the host boundary:

```sh
VERITIO_INGEST_URL='paste-the-console-provided-url'
VERITIO_INGEST_KEY='paste-the-ingest-scoped-secret'
```

Never expose either value through browser bundles, public logs, exception text, or client-visible environment prefixes.

## 3. Create a known event

Use the [record-first-event fixture](/docs/start/record-first-event/) or your SDK's equivalent to create a normalized event with:

- a new stable canary event ID;
- the intended application tenant/workspace scope;
- a non-sensitive target ID;
- minimized metadata such as `{ "source": "cloud_canary" }`;
- a stable idempotency identity reused only for retries of this exact event.

The host—not a browser request body—must choose the Cloud project credential and trusted tenant mapping.

## 4. Deliver with a bounded failure policy

Send the SDK-created event through the documented ingest client or the exact console-provided endpoint. Apply a request timeout. Treat success only as a transport/ingest acknowledgement; retain the canary ID for the read-back check.

For evidence that must not be lost, write a durable outbox entry in the same application transaction as the business mutation. Retry `429` and transient server/network failures with bounded exponential backoff and jitter. Route permanent authorization, scope, or validation failures to an operator-visible dead-letter state rather than retrying forever.

## 5. Read back the evidence

Open the selected project's evidence view and locate the canary by event ID. Confirm all of the following:

| Check | Expected |
| --- | --- |
| Project | Exactly the selected project |
| Event ID | Exact canary ID |
| Action and target | Match the sent normalized event |
| Metadata | Only the allowlisted canary metadata |
| Duplicate retry | One logical record, not two |

If the event appears under another project or contains unexpected metadata, stop the integration and rotate the key.

## 6. Prove revocation

Revoke the test key in the console. A later request using that secret must fail authorization and must not create a record. Confirm the original canary remains readable according to your account and project permissions.

## Production gate

Do not launch until your integration test covers valid ingest, identical retry, conflicting retry, invalid project/key, revoked key, timeout, server failure, outbox replay, and read-back. Keep the public [claims registry](https://getveritio.com/claims.json) verification date with your release evidence.

Next, request and independently verify a [Cloud export](/docs/cloud/exports/).
