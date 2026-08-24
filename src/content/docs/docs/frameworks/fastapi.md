---
title: FastAPI
description: Use the Python SDK directly at FastAPI mutation boundaries today, with authorization and tenant resolution owned by the application.
audience: [developer]
kind: guide
searchIntent: Record governed application evidence from FastAPI mutation routes with the Python SDK.
questions:
  - How do I integrate Veritio with FastAPI?
  - How does the governed CRUD example record evidence?
  - Which authorization and tenant checks remain host-owned?
lastUpdated: 2026-08-23
verifiedAgainst: ['Python SDK 0.0.1 at veritio@c4100ee', 'fastapi-governed-crud at veritio@c4100ee']
sourceRefs:
  - https://github.com/getveritio/veritio/tree/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/examples/fastapi-governed-crud
  - https://github.com/getveritio/veritio/tree/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/adapters/fastapi
claimRefs: []
---

The public FastAPI example uses the Python SDK directly inside the service boundary that owns authorization, tenant scope, before/after state, and the mutation. The `adapters/fastapi` directory describes future adapter intent; it is not presented here as a finished installable package.

## Run the governed CRUD service

```sh
git clone https://github.com/getveritio/veritio.git
git -C veritio checkout c4100ee7b678d0c6b227c67ae6ea1d8a1f373967
cd veritio/examples/fastapi-governed-crud
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
PYTHONPATH=../../sdks/python/src:. uvicorn app.main:app --reload --port 8010
```

The service uses fixed local identities `tenant_demo` and `user_demo` so it runs without an authentication provider. Those constants are demonstration context, not a production tenant-resolution strategy.

## Create and inspect evidence

```sh
curl -X POST http://localhost:8010/projects \
  -H 'content-type: application/json' \
  -d '{"name":"Retention inbox"}'

curl http://localhost:8010/evidence
```

The mutation creates a governed-action draft, appends its audit and edge inputs to local hash-chained records, and binds the resulting record hashes into an `EvidenceCommit`. The evidence response returns the audit, edge, and commit chains plus verification status for all three.

Project display names are not stored in metadata. The example records a stable `projectNameHash` alongside stable IDs and governed fields.

## Follow a mutation through the code

1. FastAPI validates the request body.
2. The service resolves actor and tenant from server-owned state.
3. It captures the previous project state.
4. `create_governed_action_draft` produces portable event and edge inputs for the before/after change.
5. The application applies the mutation and appends local evidence.
6. It creates an EvidenceCommit over the exact persisted record hashes.
7. `GET /evidence` verifies audit records, edge records, and commit membership.

A production application must decide how steps 5 and 6 become atomic or recoverable. A transactional outbox is appropriate when the business row and evidence delivery cannot be committed in one store operation.

## Run the broader lifecycle

```sh
curl -X POST http://localhost:8010/scenarios/governed-lifecycle
```

This records auth session context, organization and membership events, consent, a data-subject request, export evidence, retention-policy evidence, processor-transfer relationships, and EvidenceCommit membership. It is useful for inspecting how templates and graph edges compose without implying that these records perform the governed workflows themselves.

## Verify with the upstream tests

```sh
cd veritio/examples/fastapi-governed-crud
PYTHONPATH=../../sdks/python/src:. python3 -m unittest discover -s tests
```

The suite covers CRUD, chain verification, commit membership, country/region security context, canonical plan hashing, consent/DSAR/export/retention helpers, and graph relations.

## Production boundary

Do not accept tenant or actor IDs from request bodies without authorization. Do not claim a completed change when the business mutation failed. Replace the in-memory collections with durable application and evidence stores, and define recovery when only one side of the operation commits.

Review the [Python SDK boundaries](/docs/sdks/python/) and [evidence graph model](/docs/concepts/evidence-graph/) before adapting the example.
