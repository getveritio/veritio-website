---
title: Veritio Cloud overview
description: Compare the optional managed project, key, ingest, evidence-view, and export surfaces with the complete local open-source path.
audience: [newcomer, developer, operator]
kind: overview
searchIntent: Decide whether optional Veritio Cloud or a self-hosted OSS evidence boundary fits your operating model.
questions:
  - What does Veritio Cloud manage?
  - Is a Cloud account required to use Veritio?
  - Which responsibilities remain with my application?
lastUpdated: 2026-08-23
verifiedAgainst: ['Veritio Cloud public claims · 2026-08-09', '@veritio/core@0.4.7']
sourceRefs:
  - https://getveritio.com/claims.json
  - https://github.com/getveritio/veritio/tree/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967
claimRefs: [cloud-managed-path, cloud-projects-keys-ingest, cloud-evidence-views, cloud-export-requests]
---

Veritio Cloud is the optional managed operating path. The OSS SDK, file store, database adapters, local verifier, and export-bundle format do not require a Cloud account. Choose Cloud when you want Veritio to operate the project, scoped-key, ingest, evidence-view, and export-request surfaces.

## Responsibility split

| Concern | Your application | Veritio Cloud | Portable OSS contract |
| --- | --- | --- | --- |
| Authenticate the actor | Yes | No | Principal shape |
| Resolve tenant/project intent | Yes | Authorizes hosted project | Evidence scope |
| Minimize event metadata | Yes | Revalidates/re-redacts ingest | Event schema and redaction rules |
| Store ingest secret | Yes, server-side | Issues/revokes scoped key | No hosted key in protocol |
| Order hosted records | No | Yes | AuditRecord invariants |
| Browse hosted evidence | No | Yes | Event and graph semantics |
| Request hosted export | Initiates | Builds/status/download | `vevb-1` bundle format |
| Verify downloaded bytes | Yes | May report status | Independent OSS verifier |

Cloud does not make authorization, source-event truthfulness, data minimization, retention choices, or legal interpretation disappear. It changes who operates the hosted boundary.

## Implemented managed path

The public-safe claims registry confirms, as of its displayed verification date:

- projects and scoped ingest keys;
- project-scoped ingest;
- tenant-scoped record, agent-session, activity-episode, and governed-change views;
- export requests, terminal job status, and download surfaces.

Those claims are intentionally expressed as public capabilities. Private repository paths, infrastructure topology, and roadmap material are not documentation inputs.

## Smallest production-shaped flow

1. Create an organization/project in the console.
2. Issue the narrowest ingest-scoped key and copy its provided ingest URL once.
3. Store URL and key in a server-side secret boundary.
4. Build and redact a public Veritio event in your application.
5. Send with a bounded timeout and a durable outbox if evidence loss matters.
6. Match the event ID, action, target, and project in the evidence view.
7. Request an export, download it, and run the OSS verifier offline.
8. Revoke the test key when the integration test is complete.

The console-provided URL is authoritative for your environment. This public guide does not invent an endpoint hostname or expose a private API layout.

## Choose Cloud when

- your team does not want to operate authoritative evidence storage;
- a shared console and hosted export workflow are useful;
- the verified public feature set matches your requirements;
- your security and procurement review accepts the managed boundary.

Choose [self-hosting](/docs/storage/self-hosting/) when storage location, network isolation, database operations, or custom recovery ownership must remain entirely with your team.

Continue with the concrete [Cloud getting started](/docs/cloud/getting-started/) acceptance flow.
