"""Cross-language parity twin of ``src/examples/commits/merkle-root.ts``.

The invariant this fixture proves: an EvidenceCommit's ``recordsRoot`` and
``hash`` are protocol values, not TypeScript implementation details. Given the
SAME pinned audit events, the SAME pinned envelope fields, and the SAME
manifest, the Python SDK must produce byte-identical digests to the TypeScript
SDK — because ``veritio-merkle-v1`` leaf/node hashing and ``veritio-commit-v1``
commit hashing both run over canonical JSON, and canonical JSON is a
cross-language byte contract.

Three things have to line up for the printed roots to agree, and each is a real
place the two SDKs could drift:

* ``hash_audit_record`` must canonicalize the record envelope exactly like
  ``hashAuditRecord``, or ``member.recordHash`` diverges before the tree is
  even built. The record hashes are printed for that reason: they localize a
  divergence to the record layer instead of the tree layer.
* ``create_evidence_commit`` must sort members by ``index`` rather than trusting
  the caller's array order. This fixture hands it the same two deliberately
  shuffled orderings the TypeScript fixture uses, so caller-order sensitivity
  would surface as ``orderIndependent: false`` here.
* ``_compute_records_root`` must duplicate the odd leaf at each level the same
  way. Three members is the smallest manifest that exercises that odd-leaf
  promotion, which is why the pinned manifest has three and not two or four.

Deliberate difference from the TypeScript expected output: there is NO
``recordChainVerification`` key. ``verifyAuditRecords`` is TypeScript-only —
the Python SDK exports ``verify_evidence_commits`` but no audit-record chain
verifier — so faking that field would assert a capability this SDK does not
have. Everything else is emitted under the same key names in the same order, so
the two expected files diff to exactly that one missing key.

Determinism: every id, timestamp, idempotency key and sequence is a literal.
``appendedAt`` in particular is pinned because a real conforming store stamps it
from wall-clock time, which would move every record hash — and therefore the
Merkle root — between runs.

Run with the sibling SDK on the path:

    PYTHONPATH=../veritio/sdks/python/src python3 src/examples/commits/parity.py
"""

import json
from typing import Any

from veritio import (
    create_audit_event,
    create_evidence_commit,
    hash_audit_record,
    hash_evidence_commit,
    hash_idempotency_key,
    verify_evidence_commits,
)

# Pinned verbatim from src/examples/commits/merkle-root.ts. These values exist
# only to be the same bytes the TypeScript fixture hashes; changing any of them
# invalidates the comparison even if both sides stay internally consistent.
COMMIT_SCOPE = {"tenantId": "org_acme", "environment": "production"}

MEMBERSHIP_EVENTS: list[dict[str, Any]] = [
    {
        "event": {
            "id": "evt_member_invited_01",
            "occurredAt": "2026-08-09T10:00:00.000Z",
            "actor": {"type": "user", "id": "usr_owner"},
            "action": "organization.member.invited",
            "target": {"type": "organization", "id": "org_acme"},
            "scope": COMMIT_SCOPE,
            "purpose": "access_management",
            "lawfulBasis": "contract",
            "retention": "security_1y",
            "metadata": {"role": "viewer"},
        },
        "idempotencyKey": "invitation:inv_123",
    },
    {
        "event": {
            "id": "evt_member_joined_01",
            "occurredAt": "2026-08-09T10:01:00.000Z",
            "actor": {"type": "user", "id": "usr_member"},
            "action": "organization.member.joined",
            "target": {"type": "organization", "id": "org_acme"},
            "scope": COMMIT_SCOPE,
            "purpose": "access_management",
            "lawfulBasis": "contract",
            "retention": "security_1y",
            "metadata": {"role": "viewer"},
        },
        "idempotencyKey": "membership:mem_123",
    },
    {
        "event": {
            "id": "evt_member_promoted_01",
            "occurredAt": "2026-08-09T10:02:00.000Z",
            "actor": {"type": "user", "id": "usr_owner"},
            "action": "organization.member.promoted",
            "target": {"type": "organization", "id": "org_acme"},
            "scope": COMMIT_SCOPE,
            "purpose": "access_management",
            "lawfulBasis": "contract",
            "retention": "security_1y",
            "metadata": {"role": "admin"},
        },
        "idempotencyKey": "promotion:mem_123",
    },
]

PINNED_APPENDED_AT = "2026-08-09T10:03:00.000Z"


def pinned_membership_records() -> list[dict[str, Any]]:
    """Build the three audit records the commit manifest binds.

    Mirrors ``pinnedMembershipRecords`` in the TypeScript fixture field for
    field. The chain (``sequence``, ``previousHash``) is built the way a
    conforming ``AuditStore`` builds it so ``member.recordHash`` references
    genuine envelope digests rather than placeholder bytes, but ``appendedAt``
    is pinned instead of clock-stamped: a moving ``appendedAt`` changes the
    record hash, which changes every Merkle leaf, which would make the parity
    claim unverifiable.
    """
    records: list[dict[str, Any]] = []
    previous_hash: str | None = None

    for position, entry in enumerate(MEMBERSHIP_EVENTS):
        record = {
            "event": create_audit_event(entry["event"]),
            "sequence": position + 1,
            "previousHash": previous_hash,
            "hashAlgorithm": "sha256",
            "canonicalization": "veritio-json-v1",
            "appendedAt": PINNED_APPENDED_AT,
            "idempotencyKeyHash": hash_idempotency_key(
                COMMIT_SCOPE["tenantId"], entry["idempotencyKey"]
            ),
        }
        record["hash"] = hash_audit_record(record)
        records.append(record)
        previous_hash = record["hash"]

    return records


def commit_members_for(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Project persisted records into commit manifest members.

    ``recordHash`` must be the algorithm-qualified ``sha256:<hex>`` form even
    though v1 audit record hashes are stored bare, and ``index`` — not list
    position — is the field ``create_evidence_commit`` canonicalizes and sorts
    on. Both rules are protocol, so both are reproduced here rather than left
    to the commit builder to guess.
    """
    return [
        {
            "index": position,
            "recordType": "audit.record",
            "recordId": record["event"]["id"],
            "recordHash": f"sha256:{record['hash']}",
        }
        for position, record in enumerate(records)
    ]


def commit_of(members: list[dict[str, Any]]) -> dict[str, Any]:
    """Commit a manifest in whatever list order the caller happens to hold it.

    ``commitId``, ``streamId``, ``sequence`` and ``committedAt`` are pinned to
    the TypeScript fixture's values because all four are canonicalized into the
    commit hash; leaving ``committedAt`` to default would stamp the current
    clock and break both determinism and the cross-language comparison.
    """
    return create_evidence_commit(
        {
            "commitId": "cmt_membership_01",
            "streamId": "org_acme:production",
            "sequence": 1,
            "previousCommitHash": None,
            "members": list(members),
            "committedAt": "2026-08-09T10:05:00.000Z",
        }
    )


def main() -> None:
    """Print the commit-parity report for the pinned membership manifest.

    Emits the same key names and nesting as ``merkle-root.ts`` (minus the
    TypeScript-only record-chain verification) so the two expected outputs can
    be diffed directly. Free of clock, randomness, environment and filesystem
    access, so stdout is byte-identical across runs and machines.
    """
    records = pinned_membership_records()
    members = commit_members_for(records)

    # Two deliberately different caller orderings of the same three members,
    # copied from the TypeScript fixture so both languages test the same
    # permutations rather than each picking a convenient one.
    shuffled = [members[2], members[0], members[1]]
    reversed_members = list(reversed(members))

    commit = commit_of(shuffled)
    rebuilt = commit_of(reversed_members)

    print(
        json.dumps(
            {
                "suppliedOrder": [
                    {"index": member["index"], "recordId": member["recordId"]}
                    for member in shuffled
                ],
                "canonicalMemberOrder": [
                    {
                        "index": member["index"],
                        "recordType": member["recordType"],
                        "recordId": member["recordId"],
                        "recordHash": member["recordHash"],
                    }
                    for member in commit["members"]
                ],
                "recordCount": commit["recordCount"],
                "treeAlgorithm": commit["treeAlgorithm"],
                "recordsRoot": commit["recordsRoot"],
                "commitHash": commit["hash"],
                "hashSelfConsistent": hash_evidence_commit(commit) == commit["hash"],
                "orderIndependent": rebuilt["hash"] == commit["hash"]
                and rebuilt["recordsRoot"] == commit["recordsRoot"],
                "commitVerification": verify_evidence_commits([commit]),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
