"""Cross-language parity twin of ``src/examples/governed/action-draft.ts``.

The invariant this fixture proves: governed-action derivation is
language-neutral protocol math, not a TypeScript implementation detail. It
drafts the SAME pinned subscription upgrade as the TypeScript fixture — the
same entity definition, the same before/after rows, the same
``occurredAt``/``idempotencyKey`` — and prints the derived identifiers a host
application depends on at its mutation boundary:

* ``create_governed_action_draft`` derives the change id and the activity id
  from ONE seed, sha256(``tenantId``:``idempotencyKey``), so a replayed
  mutation reproduces the same change/activity pair in Python that it does in
  TypeScript and Go instead of forking the graph per SDK.
* ``define_entity`` is the only place field capture is decided: the ``omit``
  field never reaches the state commitment (and so can never become a governed
  changed path), and the ``content_digest`` field is committed as a digest
  rather than a raw value.
* The state-commitment digest and the derived ``revisionId`` are byte-identical
  to the TypeScript ones, which is the real parity claim: canonical JSON,
  sha256 framing and field ordering agree across languages.
* The draft is INPUT ONLY. It carries no store-assigned sequence and no record
  hash; nothing is evidence until a conforming ``AuditStore`` appends it.

The printed JSON deliberately mirrors the TypeScript fixture's structure key
for key, so ``src/examples/governed/expected/action-draft.txt`` and
``src/examples/governed/expected/action-draft-python.txt`` can be diffed
directly. Exactly one line is allowed to differ: the prose ``note``, which
names the language's own entrypoint (``create_governed_action_draft`` vs
``createGovernedActionDraft``). Any diff on an id, digest, changed path, event
action or edge relation is a real cross-language divergence, not formatting.

Deterministic by construction: literal rows, a pinned ``occurredAt``, a pinned
idempotency key, no clock, no randomness, no filesystem. (``occurredAt`` must
stay pinned — ``create_governed_action_draft`` falls back to
``datetime.now(timezone.utc)`` when it is omitted.)

Run with the sibling SDK on the path:

    PYTHONPATH=../veritio/sdks/python/src python3 src/examples/governed/action-draft.py
"""

import json
from typing import Any

from veritio import create_governed_action_draft, define_entity

# Pinned verbatim from src/examples/governed/action-draft.ts. Do not "improve"
# these values: their only job is to be the same inputs the TypeScript fixture
# drafts, so the two expected outputs can be diffed field by field.
GOVERNED_SCOPE = {"tenantId": "org_acme", "environment": "production"}

SUBSCRIPTION = define_entity(
    authority="acme-billing",
    entity_type="subscription",
    schema_ref="acme://schemas/subscription@3",
    field_set_ref="acme://fieldsets/subscription-governed@1",
    identity=lambda row: row["id"],
    fields={
        "id": {"capture": "full"},
        "plan": {"capture": "full"},
        "seatCount": {"capture": "full"},
        "status": {"capture": "full"},
        # PII stays out of evidence as a value; only its digest is committed.
        "accountEmail": {"capture": "content_digest"},
        # Ungoverned operator prose never enters the commitment or changed paths.
        "internalNotes": {"capture": "omit"},
    },
)

BEFORE: dict[str, Any] = {
    "id": "sub_9f31",
    "accountEmail": "billing@acme.example",
    "plan": "team",
    "seatCount": 12,
    "status": "active",
    "internalNotes": "renewal call scheduled",
}

AFTER: dict[str, Any] = {
    **BEFORE,
    "plan": "enterprise",
    "seatCount": 25,
    "internalNotes": "upgrade approved on the renewal call",
}


def build_subscription_upgrade_draft() -> dict[str, Any]:
    """Build the pinned upgrade draft shared by the docs page and this fixture.

    Kept as a named function so the documentation can show one call site while
    CI re-runs the identical derivation. Every argument matches
    ``buildSubscriptionUpgradeDraft`` in the TypeScript twin, including
    ``occurredAt`` and ``idempotencyKey``, because both feed hashed evidence:
    ``occurredAt`` is stamped on every drafted event and edge, and
    ``idempotencyKey`` seeds the change/activity ids and the tenant-scoped
    idempotency hash.
    """
    return create_governed_action_draft(
        {
            "scope": GOVERNED_SCOPE,
            "entity": SUBSCRIPTION,
            "before": BEFORE,
            "after": AFTER,
            "actionType": "subscription.upgraded",
            "activityType": "billing.plan_change",
            "initiatedBy": {
                "authority": "acme-billing",
                "kind": "principal",
                "type": "user",
                "id": "usr_owner",
            },
            "performedBy": {
                "authority": "acme-billing",
                "kind": "principal",
                "type": "service",
                "id": "svc_billing_api",
            },
            "producer": {
                "authority": "acme-billing",
                "kind": "principal",
                "type": "service",
                "id": "svc_billing_api",
            },
            "occurredAt": "2026-08-09T10:00:00.000Z",
            "idempotencyKey": "subscription.upgraded:sub_9f31:req_7c2a",
            "mutationBinding": "same_transaction",
        }
    )


def main() -> None:
    """Print the governed-action parity report for the pinned upgrade.

    Kept free of any ambient input (clock, environment, argv) so the program is
    byte-identical across runs and machines; the documentation pipeline diffs
    this stdout against expected/action-draft-python.txt, and a reviewer diffs
    that file against the TypeScript twin's expected output.
    """
    draft = build_subscription_upgrade_draft()
    change_id = draft["changeRef"]["id"]
    id_seed = change_id[change_id.rfind("_") + 1 :]
    entity_id = draft["entityRef"]["id"]
    commitment = draft["revision"]["stateCommitment"]

    output = {
        "derivedIds": {
            "changeId": change_id,
            "activityId": draft["activityRef"]["id"],
            "entityId": entity_id,
            "revisionId": draft["revision"]["ref"]["id"],
            "idSeed": id_seed,
            # Both ids are `<prefix>_<entityType>_<entityId>_<seed>` off the same
            # sha256(tenantId:idempotencyKey) seed, so replay is idempotent.
            "changeAndActivityShareOneSeed": (
                change_id == f"chg_subscription_{entity_id}_{id_seed}"
                and draft["activityRef"]["id"] == f"act_subscription_{entity_id}_{id_seed}"
            ),
        },
        "changedPaths": draft["revision"]["changedPaths"],
        "stateCommitment": {
            "algorithm": commitment["algorithm"],
            "canonicalization": commitment["canonicalization"],
            "schemaRef": commitment["schemaRef"],
            "fieldSetRef": commitment["fieldSetRef"],
            "digest": commitment["digest"],
            "committedFields": sorted(commitment["fields"].keys()),
            # `internalNotes` is declared `omit`, so it is absent from the
            # commitment and can never become a governed changed path.
            "omittedFieldPresent": "internalNotes" in commitment["fields"],
            "accountEmailCommitment": commitment["fields"]["accountEmail"],
        },
        "eventActions": [event["action"] for event in draft["events"]],
        "edgeRelations": [edge["relation"] for edge in draft["edges"]],
        "draftIsInputOnly": {
            "note": "create_governed_action_draft returns evidence INPUTS, not persisted records. Append draft['outboxEntry'] through a conforming AuditStore inside the same mutation to make it evidence.",
            "eventsCarryStoreAssignedSequence": any(
                "sequence" in event for event in draft["events"]
            ),
            "eventsCarryRecordHash": any("hash" in event for event in draft["events"]),
            "outboxMutationBinding": draft["outboxEntry"]["mutationBinding"],
            "outboxSchemaVersion": draft["outboxEntry"]["schemaVersion"],
        },
    }

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
