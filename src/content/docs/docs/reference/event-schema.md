---
title: Event schema reference
description: Look up every portable audit-event field, nested actor, target, scope, and metadata rule, plus normalization and storage boundaries.
audience: [developer, governance]
kind: reference
searchIntent: Look up every portable Veritio audit-event field, nested shape, requirement, and validation rule.
questions:
  - Which fields are required in a normalized Veritio audit event?
  - What shapes do actor, target, scope, and metadata accept?
  - Which fields exist only on a stored AuditRecord?
lastUpdated: 2026-08-23
verifiedAgainst: ['schema 2026-06-10', '@veritio/core@0.4.7']
sourceRefs:
  - https://github.com/getveritio/veritio/blob/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/spec/event.schema.json
  - https://github.com/getveritio/veritio/blob/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/spec/audit-record.schema.json
claimRefs: []
---

The normative contract is the language-neutral JSON Schema. SDK input helpers may make `id`, `occurredAt`, and `metadata` convenient to omit, but the resulting normalized `AuditEvent` always contains them.

## Normalized event fields

| Field | Required | Type / constraint | Ownership |
| --- | --- | --- | --- |
| `id` | Yes | non-empty string | Host or SDK-generated |
| `schemaVersion` | Yes | exactly `2026-06-10` | SDK normalization |
| `occurredAt` | Yes | RFC 3339 date-time string | Host or SDK clock |
| `actor` | Yes | principal object | Host authentication boundary |
| `action` | Yes | dotted lower-case action name | Application vocabulary |
| `target` | Yes | resource object | Application vocabulary |
| `scope` | No in event schema | tenant/workspace/environment strings | Host authorization boundary |
| `requestId` | No | string | Host request context |
| `purpose` | No | string | Application governance label |
| `lawfulBasis` | No | fixed enum | Application-declared claim |
| `dataCategories` | No | unique string array | Application-declared categories |
| `retention` | No | policy-key string | Application policy label |
| `metadata` | Yes | JSON object | Minimized application context |

Authoritative storage requires `scope.tenantId` even though the portable event schema permits an event without scope. This allows normalization in generic contexts while preventing a tenantless record from entering a stored chain.

## Actor

```json
{
  "type": "user",
  "id": "usr_reviewer",
  "display": "Optional human-readable label"
}
```

`type` is one of `user`, `system`, `service`, `ai_agent`, or `anonymous`. `id` is required; `display` is optional and is not automatically redacted. Prefer a stable internal identifier over an email address or personal name.

## Target

```json
{
  "type": "invoice",
  "id": "inv_123"
}
```

Target `type` and `id` are application-defined strings. Keep them stable across display-name changes. The optional `display` field has the same minimization responsibility as actor display.

## Scope

```json
{
  "tenantId": "org_acme",
  "workspaceId": "workspace_finance",
  "environment": "production"
}
```

Scope values must come from trusted server context. Never let an untrusted request choose another tenant's scope merely because the JSON shape validates.

## Action naming

Actions match `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$`. Use a stable resource-first or domain-first vocabulary such as `invoice.approved` or `organization.member.invited`. A single word, uppercase segment, hyphen, or whitespace is invalid.

Changing an action name changes query and governance semantics. Treat vocabulary changes like API changes and document migrations rather than silently renaming historical meaning.

## Metadata JSON domain

Metadata values may be null, boolean, finite number, string, array, or nested object. Functions, symbols, `BigInt`, non-finite numbers, circular references, and arbitrary class instances are not portable JSON values. Undefined object properties are omitted during normalization; arrays preserve position.

Apply an allowlist and deterministic redaction before append. Valid JSON is not automatically safe evidence.

## Event versus record

An `AuditRecord` wraps the normalized event and adds authoritative storage fields: `sequence`, `previousHash`, `hash`, `hashAlgorithm`, `canonicalization`, `appendedAt`, and `idempotencyKeyHash`. Applications must not pre-assign those store-owned fields.

Validate fixtures against the public schema and run the same semantic fixture in TypeScript, Python, and Go. Continue to [Audit events](/docs/concepts/audit-events/) for the ownership model or [Verifier](/docs/reference/verifier/) for stored-record failures.
