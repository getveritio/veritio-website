---
title: Retention labels
description: Treat retention as explicit evidence metadata while keeping enforcement in the storage or hosted boundary that actually owns deletion.
audience: [developer, operator, governance]
kind: concept
searchIntent: Use Veritio retention labels without confusing policy evidence with physical record deletion.
questions:
  - What does a Veritio retention label do?
  - Does setting retention automatically delete evidence?
  - How does deletion interact with hash-chain verification?
lastUpdated: 2026-08-23
verifiedAgainst: ['@veritio/core@0.4.7']
sourceRefs:
  - https://github.com/getveritio/veritio/blob/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/spec/event.schema.json
  - https://github.com/getveritio/veritio/blob/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/sdks/typescript/src/index.ts
claimRefs: []
---

`retention` is a portable label recorded inside an audit event. It tells a reader which policy the producer assigned; it does not schedule deletion, prove that deletion occurred, or define a universal duration.

## Policy evidence on an event

```json
{
  "id": "evt_session_revoked_01",
  "action": "security.session.revoked",
  "retention": "security_1y",
  "metadata": {
    "policyVersion": "security-retention.v3"
  }
}
```

The SDK preserves the label in the normalized event and therefore in the record hash. A later silent edit from `security_1y` to another label produces a verification failure.

## Enforcement belongs to the operating boundary

The system that owns the authoritative records must map the label to lifecycle behavior. A complete policy defines:

- the policy version and effective date;
- which record and derived-data classes it covers;
- the time origin used to calculate eligibility;
- legal hold or suspension behavior;
- deletion or anonymization mechanics;
- the evidence produced when the policy runs;
- backup, archive, and projection handling;
- verification behavior across the removed range.

Do not publish a number of days or years unless the operating implementation applies that duration and the claim has current evidence.

## Deletion changes what can be verified

Removing an interior record from a complete chain creates a sequence or previous-hash gap. That is correct for an undeclared deletion: the verifier should not pretend the original full chain is intact.

An intentional retention boundary therefore needs an explicit verification design. Depending on the implemented system, that may be a scoped export manifest, retained evidence commit, tombstone or policy-run record, or a new verifiable segment. The website must not invent one of these behaviors when the owning repository has not implemented it.

## Authoritative and derived data

Deleting from a derived archive or analytics projection does not delete the authoritative record. Conversely, removing an authoritative record does not guarantee that backups, caches, exports, or downstream processors have applied the same policy. The operating contract must name every copy and its owner.

## Review a retention implementation

Trace one policy label from event creation to policy resolution, eligibility calculation, authoritative mutation, derived-tier propagation, and a post-operation verification artifact. If any transition lacks an observable result or failure path, the retention workflow is incomplete.

Continue with [Storage overview](/docs/storage/overview/) and the [export format](/docs/reference/export-format/).
