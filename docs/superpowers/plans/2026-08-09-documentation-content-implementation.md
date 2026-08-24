# Veritio Route-by-Route Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite every canonical documentation route into a distinct, source-backed tutorial, task guide, concept, or reference page.

**Architecture:** Each documentation group is a reviewable content unit grounded in exact public source files and runnable examples. Section pages link tasks to concepts and references; shared fixtures are imported, while application-scale examples remain owned by `../veritio/examples/`.

**Tech Stack:** Astro content collections, Starlight MD/MDX, Expressive Code, Bun contract tests, Git object verification against `veritio@787470d77821731228dea01ba1a2044d63145130`

## Global Constraints

- Preserve all 32 canonical documentation routes and the two existing permanent redirects.
- Every page must have a distinct `searchIntent`, one to five answerable `questions`, at least one valid `sourceRef`, and accurate `verifiedAgainst` values.
- Do not repeat the rejected eight-heading template.
- Do not copy Laravel wording, source, branding, or assets.
- Display only tested commands, source excerpts, and outputs.
- Route missing public behavior to `../veritio` before writing the page.
- Do not commit, push, or deploy unless the user asks.

---

### Task 1: Add content-shape and source-symbol verification

**Files:**
- Modify: `tests/site-contract.test.ts`
- Modify: `scripts/verify-examples.ts`

**Interfaces:**
- Produces a route-to-required-evidence map used by every later content task.
- Consumes exact `sourceRefs` revisions and repository paths.

- [ ] **Step 1: Add a route evidence map**

Define explicit requirements for the content groups:

```ts
const contentEvidence = {
  concepts: ['canonical JSON', 'limitation'],
  sdks: ['Supported capabilities', 'Known boundaries'],
  frameworks: ['Host responsibilities', 'Verify the integration'],
  storage: ['Authoritative', 'Failure recovery'],
  ai: ['Secret', 'Redaction'],
  cloud: ['Optional', 'Verified'],
  reference: ['Field', 'Error'],
} as const
```

For each route, assert its group-specific phrases and at least one contextual internal link to a different group.

- [ ] **Step 2: Add public symbol checks**

For backticked exported symbols declared in page frontmatter under `verifiedSymbols`, check the exact pinned source tree with `git grep -F` at the verified revision. Exclude JSON field names and shell commands by reading only the structured frontmatter array.

- [ ] **Step 3: Run the tests and confirm current failures**

Run: `bun test tests/site-contract.test.ts`

Expected: current shallow pages fail group-specific evidence and symbol metadata requirements.

### Task 2: Rewrite Core Concepts as concrete explanatory documents

**Files:**
- Modify: `src/content/docs/docs/concepts/audit-events.md`
- Modify: `src/content/docs/docs/concepts/hash-chain.md`
- Modify: `src/content/docs/docs/concepts/evidence-graph.md`
- Modify: `src/content/docs/docs/concepts/redaction.md`
- Modify: `src/content/docs/docs/concepts/retention.md`

**Interfaces:**
- Consumes protocol schemas, canonical JSON conformance fixtures, SDK redaction code, edge schema, and storage contracts at the pinned revision.
- Produces conceptual anchors used by tutorials, framework guides, storage guides, and reference pages.

- [ ] **Step 1: Rewrite audit events**

Show one host input beside its normalized `AuditEvent` and stored `AuditRecord`; explain which layer adds sequence, previous hash, record hash, canonicalization, append time, and idempotency hash. Include invalid scope and invalid actor examples with actual error behavior.

- [ ] **Step 2: Rewrite hash chains**

Walk one record from normalized event to canonical bytes to SHA-256, then add a second record with its previous hash. Use the tutorial's actual tamper and deletion output. State that verification detects inconsistency but does not prove an event was truthful when recorded.

- [ ] **Step 3: Rewrite evidence graph**

Show source and target entity references, a normalized edge, and a traversal question. Explain authority, edge direction, hashed edge records where implemented, and what a relationship does not prove.

- [ ] **Step 4: Rewrite redaction and retention**

Redaction must show before/after nested metadata, normalized-key behavior, deterministic output, and the minimization boundary. Retention must distinguish policy evidence from physical deletion, explain chain consequences, and separate authoritative stores from derived projections.

- [ ] **Step 5: Verify concepts**

Run: `bun test tests/site-contract.test.ts && bun run build && bun test tests/build-output.test.ts`

Expected: the five pages pass metadata, source, link, Markdown, and anchor checks.

### Task 3: Rewrite SDK and tool pages against actual public capabilities

**Files:**
- Modify: `src/content/docs/docs/sdks/typescript.md`
- Modify: `src/content/docs/docs/sdks/python.md`
- Modify: `src/content/docs/docs/sdks/go.md`
- Modify: `src/content/docs/docs/sdks/cli.md`
- Modify: `src/examples/manifest.json`
- Modify or create SDK fixtures under: `src/examples/sdk/`

**Interfaces:**
- Consumes exported symbols from each public SDK and actual CLI help output.
- Produces explicit capability tables and executable language-specific examples.

- [ ] **Step 1: Inventory exported public APIs at the pinned revision**

Inspect `sdks/typescript/src/index.ts`, `sdks/typescript/package.json`, `sdks/python/src/veritio/__init__.py`, `sdks/python/pyproject.toml`, `sdks/go/event.go`, and `sdks/go/go.mod` with `git show 787470d77821731228dea01ba1a2044d63145130:<path>`. Record only exports available through those public package boundaries; do not infer internal modules are supported imports.

- [ ] **Step 2: Rewrite TypeScript**

Document normalized events, redaction, hashing, recorder/store, verification, edges, commits, governed changes, and risk scoring only where publicly exported. Include one runnable composition and link deep behavior to concept/reference pages.

- [ ] **Step 3: Rewrite Python and Go**

Give each language a complete installation and runnable example at the exact revision. Include capability and boundary tables. State explicitly whether record storage and record-chain verification exist instead of implying equality with TypeScript.

- [ ] **Step 4: Rewrite CLI from executable help**

Run the actual CLI entrypoint from the pinned checkout. Document only commands present in `--help`, including argument requirements, exit codes observed in tests, output files, and failure cases. If the CLI is not public or runnable, change the page into a clearly labeled availability/reference boundary without installation fiction.

- [ ] **Step 5: Verify all SDK fixtures and pages**

Run: `bun run verify:examples && bun test tests/site-contract.test.ts && bun run build && bun test tests/build-output.test.ts`

Expected: examples execute, cross-language event hashes agree where semantics are shared, and pages state divergences accurately.

### Task 4: Rewrite framework guides from public application examples

**Files:**
- Modify: `src/content/docs/docs/frameworks/better-auth.md`
- Modify: `src/content/docs/docs/frameworks/nextjs.md`
- Modify: `src/content/docs/docs/frameworks/hono.md`
- Modify: `src/content/docs/docs/frameworks/fastapi.md`

**Interfaces:**
- Consumes `../veritio/examples/nextjs-better-auth`, `fastapi-governed-crud`, and the public adapter entrypoints that exist at the pinned revision.
- Produces full host-boundary integration guides with verification checkpoints.

- [ ] **Step 1: Verify each referenced example from a clean dependency state**

Run the example's documented install, typecheck/build, and test commands. Record the exact command and public revision in the page metadata. Do not reference generated `.next`, `dist`, `.venv`, binary, or cache artifacts.

- [ ] **Step 2: Rewrite Better Auth and Next.js**

Trace request or auth lifecycle through adapter input, host-injected recorder/store, captured event, redaction boundary, idempotency, and record verification. Include the exact source files the reader modifies.

- [ ] **Step 3: Rewrite FastAPI**

Use the governed CRUD example's real endpoint, request, response, recorded evidence, edge, and commit behavior. Include `pytest` verification and distinguish application state from evidence state.

- [ ] **Step 4: Rewrite Hono honestly**

Verify whether the Hono package is public or private at the pinned revision. If private, provide a public server-boundary recipe using exported core APIs and label it as a host integration, not an installable adapter. If public, use its real package name and runnable test.

- [ ] **Step 5: Run framework example and website gates**

Run every referenced example test followed by `bun run verify` in the website.

Expected: no page depends on generated artifacts or an unpublished package.

### Task 5: Rewrite storage and self-hosting around authoritative boundaries

**Files:**
- Modify: `src/content/docs/docs/storage/overview.md`
- Modify: `src/content/docs/docs/storage/file-store.md`
- Modify: `src/content/docs/docs/storage/postgres.md`
- Modify: `src/content/docs/docs/storage/self-hosting.md`

**Interfaces:**
- Consumes `@veritio/storage` contracts, conformance suite, file-store implementation, Postgres/Neon example, and implemented server modules.
- Produces deployment and recovery instructions only for implemented public boundaries.

- [ ] **Step 1: Build the storage capability matrix**

For file, Postgres/Neon, MySQL/MariaDB, MongoDB, object archive, ClickHouse, and Redis tip cache, state whether each is authoritative or derived, its ordering role, integrity behavior, concurrency boundary, and verification suitability.

- [ ] **Step 2: Rewrite file and Postgres guides**

Include exact setup, schema or directory shape, injected dependency, append/list/verify procedure, restart behavior, expected failure modes, and conformance command. Use public examples and source refs at the pinned revision.

- [ ] **Step 3: Rewrite self-hosting**

Document only the server modules that exist. Cover configuration injection, health checks, secrets, tenant scope, persistent data, backups, restore verification, shutdown, and failure recovery. If a deployable all-in-one server is absent, say so directly and teach assembly from existing public modules.

- [ ] **Step 4: Run storage source checks and website verification**

Run source-reference tests, available non-container unit tests, and `bun run verify`. Run live database tests only when their documented environment variables and Docker services are available.

Expected: no derived tier is described as authoritative.

### Task 6: Rewrite AI, Cloud, and Reference pages

**Files:**
- Modify: `src/content/docs/docs/ai/agent-events.md`
- Modify: `src/content/docs/docs/ai/claude-code.md`
- Modify: `src/content/docs/docs/ai/codex.md`
- Modify: `src/content/docs/docs/cloud/overview.md`
- Modify: `src/content/docs/docs/cloud/getting-started.md`
- Modify: `src/content/docs/docs/cloud/exports.md`
- Modify: `src/content/docs/docs/reference/event-schema.md`
- Modify: `src/content/docs/docs/reference/export-format.md`
- Modify: `src/content/docs/docs/reference/verifier.md`
- Modify: `src/content/docs/docs/reference/glossary.md`

**Interfaces:**
- Consumes public Claude Code package/example, public protocol schemas, verifier types, export format, and approved hosted-claims registry.
- Produces accurate agent capture, optional Cloud, and exhaustive reference material.

- [ ] **Step 1: Rewrite agent-event and Claude Code guides**

Define actor/session/event relationships, safe metadata, deterministic redaction, secret exclusion, local capture, optional Cloud posting, and local verification using the tested public example.

- [ ] **Step 2: Rewrite Codex without inventing an integration**

Search the pinned public tree for an implemented Codex adapter. If absent, state that no dedicated adapter is published and provide a protocol-level host recipe using exported SDK APIs. Do not label the recipe as a Codex package.

- [ ] **Step 3: Rewrite Cloud pages against approved claims**

Separate local OSS steps from managed project/key/ingest/export steps. Every hosted sentence must map to a declared approved claim reference and verification date. Omit unavailable details rather than weakening an unsupported claim.

- [ ] **Step 4: Rewrite reference pages exhaustively**

Generate field and error tables from the pinned schema and exported verifier types where practical. Include valid and invalid records, bundle tree, canonicalization labels, error meanings, trust boundaries, and cross-links from glossary terms.

- [ ] **Step 5: Run the complete content gate**

Run: `bun run verify && bun run verify:split`

Expected: all 32 canonical pages pass source, claim, link, example, Markdown, build, and cross-repository verification.
