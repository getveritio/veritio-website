# Veritio End-to-End Documentation and Discovery Design

**Status:** Approved direction, implementation contract  
**Date:** 2026-08-09  
**Repository owner:** `veritio-website`, with missing OSS behavior routed to `veritio` and hosted behavior routed to `veritio-cloud`

## 1. Problem

The current rebuild establishes a technically sound Astro/Starlight shell, but most documentation pages repeat the same eight headings with short, interchangeable prose. The result looks complete in a sitemap while failing the developer's real task: installing Veritio, recording evidence, understanding what was stored, detecting tampering, and operating the system safely.

The active documentation sidebar also renders a second rounded green border inside a group that already has a continuous grey guide rail. This creates a visually noisy, generated-looking selection treatment.

The rebuild must therefore treat documentation quality, product truth, implementation completeness, human search, and agent discovery as one system. Search-optimized pages that do not solve a task are not acceptable.

## 2. Goals

1. Let a developer complete a meaningful local Veritio workflow from a clean checkout without guessing omitted steps.
2. Make every published example executable, version-pinned, and verified against the owning public implementation.
3. Replace one universal page template with page archetypes suited to tutorials, tasks, concepts, reference, and troubleshooting.
4. Close required OSS implementation gaps in `veritio` before documenting the behavior; do not simulate missing APIs in website-only fixtures.
5. Preserve a clear OSS-first path while accurately separating optional Veritio Cloud behavior.
6. Give traditional search engines and AI agents faithful, structured, source-backed representations of the same human content.
7. Preserve stable URLs, localized marketing coverage, privacy constraints, and public-claims enforcement.

## 3. Non-goals

- Do not create protocol fields, SDK semantics, Cloud APIs, or billing behavior inside the website repository.
- Do not claim automatic legal or regulatory compliance.
- Do not claim TypeScript, Python, and Go feature parity where the public packages do not provide it.
- Do not publish private Cloud repository paths, commits, operational details, or roadmap promises.
- Do not create agent-only claims or alternate prose that can drift from the human documentation.
- Do not add client JavaScript beyond the approved interaction set.

## 4. Chosen Approach

Use a **product-truth curriculum** built around one canonical TypeScript reference workflow, followed by task guides and language-specific SDK paths.

TypeScript is the complete executable teaching path because the checked public package includes the authoritative store and record-chain verifier used by the tutorial. Python and Go pages teach their real normalized-event, canonicalization, hashing, graph, governed-change, and risk-scoring capabilities. Where a workflow is not available in those SDKs, the page states the boundary and links to the relevant TypeScript or protocol reference rather than presenting pseudo-parity.

The existing 32-topic route set remains stable unless a redirect is explicitly defined. Content within those routes is rewritten around distinct user intent.

## 5. Learning Journey

The primary journey begins at `/docs/` and proceeds through a coherent application scenario:

1. Choose local OSS or optional Cloud.
2. Install an exact verified release.
3. Define an event and deterministic redaction policy.
4. Normalize and record the first event.
5. Inspect the canonical event and stored audit record.
6. Record a second event and explain the tenant-local hash chain.
7. Modify a stored field and observe deterministic verification failure.
8. Query tenant-scoped records and relate evidence with graph edges.
9. Apply retention and data-subject workflow concepts to the stored evidence.
10. Produce and independently verify an export bundle.
11. Integrate with an actual supported framework.
12. Connect an agent capture path without exposing secrets or making the adapter authoritative.
13. Move from the local file store to an authoritative database-backed store or self-hosted boundary.
14. Evaluate optional Cloud only after the local model is understood.

Each step must retain the output of the prior step or clearly identify itself as an independent task.

## 6. Content Archetypes

### 6.1 Tutorial

Tutorials are chronological and outcome-led. Required elements:

- a specific result the developer will produce;
- exact prerequisites and supported versions;
- complete commands from a clean environment;
- imported executable source, not retyped snippets;
- captured or asserted output;
- a checkpoint that proves the current state;
- a deliberate failure or tampering exercise when it teaches a core invariant;
- the next tutorial step.

Tutorials must not interrupt the flow with exhaustive API reference material.

### 6.2 How-to guide

How-to guides solve one named task. Their structure is chosen by the task and normally includes:

- the situation in which the task is needed;
- the shortest complete procedure;
- configuration and security boundaries;
- verification and rollback or recovery;
- links to the relevant concept and reference pages.

### 6.3 Concept

Concept pages explain a model, not an installation procedure. They use concrete records, diagrams or tables where these improve understanding, edge cases, design tradeoffs, and consequences. A concept page may include a small executable demonstration but must not pretend that a fragment is a complete application.

### 6.4 Reference

Reference pages are exhaustive within their declared scope. They define fields, types, defaults, invariants, error conditions, compatibility, canonicalization labels, and source ownership. They use tables and exact examples instead of introductory filler.

### 6.5 Troubleshooting

Troubleshooting content starts with observable symptoms. Each entry provides likely causes, a safe diagnostic, the expected diagnostic output, and a tested fix. Failure modes found while running examples are added here rather than buried in generic warning boxes.

## 7. Route-by-Route Intent

### Start Here

- `/docs/`: orientation, capability matrix, three honest language entry points, complete TypeScript quickstart, secondary Cloud path.
- `/docs/start/choose-your-path/`: decision table for local library, self-hosting, agent capture, framework integration, and Cloud.
- `/docs/start/installation/`: exact package and source installation paths with version verification commands.
- `/docs/start/record-first-event/`: first continuous tutorial step using the checked fixture.
- `/docs/start/verify-a-chain/`: second tutorial step, including a real tamper exercise and diagnostic output.

### Core Concepts

- `/docs/concepts/audit-events/`: input event versus stored record, required and optional fields, normalization examples, invalid inputs.
- `/docs/concepts/hash-chain/`: byte-level canonicalization-to-hash walkthrough, tenant-local sequence, mutation and deletion detection, limitations.
- `/docs/concepts/evidence-graph/`: edge semantics, entity relationships, traversal examples, and what the graph does not prove.
- `/docs/concepts/redaction/`: normalization order, deterministic key matching, before/after structures, failure-closed boundaries, minimization guidance.
- `/docs/concepts/retention/`: policy versus evidence, deletion/expiry workflow, chain implications, and authoritative versus derived storage.

### SDKs and Tools

- `/docs/sdks/typescript/`: complete public API map and the canonical executable path.
- `/docs/sdks/python/`: actual Python capabilities, exact source revision installation, complete runnable event/hash example, known boundaries.
- `/docs/sdks/go/`: actual Go capabilities, complete runnable event/hash example, known boundaries.
- `/docs/sdks/cli/`: only commands that exist; include help output, inputs, outputs, exit codes, and failure cases.

### Frameworks

- `/docs/frameworks/better-auth/`: actual event capture lifecycle, server boundary, redaction, idempotency, and tested application reference.
- `/docs/frameworks/nextjs/`: complete integration from server setup through observed evidence using the public example.
- `/docs/frameworks/hono/`: complete integration using the public adapter or server module that actually exists.
- `/docs/frameworks/fastapi/`: complete integration using the tested FastAPI governed CRUD example.

Framework pages must identify what the adapter captures, what the host must inject, and what remains protocol-authoritative.

### Storage and Self-hosting

- `/docs/storage/overview/`: authoritative versus derived capability matrix and selection guidance.
- `/docs/storage/file-store/`: complete local setup, persisted shape, restart behavior, integrity checks, concurrency limits.
- `/docs/storage/postgres/`: schema, initialization, injected client, transaction invariants, conformance and live-test procedure.
- `/docs/storage/self-hosting/`: deployable process boundary, configuration, health, persistence, backups, secrets, verification, and failure recovery using only implemented modules.

### AI and Agents

- `/docs/ai/agent-events/`: what an agent event represents, minimum metadata, redaction, actor identity, session relationships, and a verified capture example.
- `/docs/ai/claude-code/`: exact public package path, configuration boundary, local capture, optional Cloud posting, and verification.
- `/docs/ai/codex/`: only implemented integration behavior; otherwise clearly present a protocol-level capture recipe rather than suggesting a nonexistent product integration.

### Cloud

- `/docs/cloud/overview/`: public-safe division between OSS and managed responsibilities.
- `/docs/cloud/getting-started/`: verified public onboarding and ingest flow only.
- `/docs/cloud/exports/`: verified request, production, download, and independent verification behavior, including plan or availability constraints where approved.

### Reference

- `/docs/reference/event-schema/`: complete field table, valid and invalid records, schema URL, compatibility rules.
- `/docs/reference/export-format/`: bundle tree, manifest fields, canonical bytes, signatures when supported, verification errors.
- `/docs/reference/verifier/`: interface, result types, error taxonomy, trust boundaries, and runnable invocation.
- `/docs/reference/glossary/`: precise definitions linked back to owning concept and reference pages.

## 8. Executable Example System

1. Website examples live as standalone fixtures under `src/examples/` only when they are website-specific teaching fixtures.
2. Full application examples remain owned by `veritio/examples/` and are referenced at an exact public revision.
3. MDX imports exact fixture regions through a shared code component. Prose never duplicates executable code.
4. A manifest records language, source path, public revision, content hash, command, expected output, semantics identifier, and owning route.
5. TypeScript fixtures type-check against the website's exact `@veritio/core` dependency.
6. Python fixtures syntax-check and run against the exact public source revision or published package documented on the page.
7. Go fixtures format, vet or compile, and run against the documented module revision.
8. Cross-language examples assert the same normalized event semantics before any language-specific capability diverges.
9. Expected output is stored as test data or produced during verification; manually invented output is prohibited.
10. A missing required API creates an upstream implementation task. The website build must not create a local imitation of that API.

## 9. Documentation UI

### Sidebar selection

- Keep the existing continuous neutral group rail.
- Remove the selected link's independent `border-inline-start`, oversized rounded background edge, and competing left offset.
- Render a short accent segment directly over the group rail, aligned to the active row.
- Retain sufficient contrast in both themes without depending on color alone; selected text weight and color remain secondary indicators.
- Validate nested groups, long wrapped labels, keyboard focus, narrow desktop, and mobile drawer states.

### Reading experience

- Use the existing Geist and Geist Mono families.
- Maintain a restrained content width and readable line length.
- Reduce decorative containers. Use borders, cards, and callouts only when they communicate hierarchy or risk.
- Prefer normal document flow, tables, diagrams, terminal output, and code over repeated promotional panels.
- Keep right-hand page outline and previous/next navigation, but make headings specific enough to be useful.

## 10. SEO, GEO, AEO, and Agent Search Optimization

### 10.1 One source of truth

Human HTML, static Markdown, Pagefind, structured data, `llms.txt`, and any consolidated agent index are derived from the same content entries and verified example manifest. No surface may contain an unsupported claim or code variant absent from the canonical page.

### 10.2 Technical SEO

- One canonical trailing-slash URL for every indexable HTML page.
- Matching internal links, canonical tags, hreflang, sitemap entries, JSON-LD identifiers, redirects, and generated Markdown links.
- Self-referencing canonical and valid language alternates only for pages that actually exist.
- `.md` representations excluded from XML sitemaps and search indexing and served with `X-Robots-Tag: noindex, follow`.
- Correct titles, unique descriptions, Open Graph and Twitter metadata, crawl directives, status codes, and redirect chains.
- Breadcrumb, Organization, WebSite, TechArticle or SoftwareSourceCode, FAQ only when visible qualifying content exists, and other justified schema types.
- No broken links, anchors, orphan pages, duplicate slugs, or accidental localized documentation fallbacks.
- Performance, accessibility, and stable layout remain ranking and usability gates.

### 10.3 Content architecture

- Each route owns one primary developer intent and avoids competing with another Veritio route.
- Section indexes act as hubs and link to task, concept, reference, and troubleshooting spokes.
- Important workflows remain reachable within three meaningful navigation actions.
- Every page has descriptive inbound links and contextual next steps based on the actual learning journey.
- Existing comparison pages keep their evidence, dates, and URL equity.

### 10.4 GEO, AEO, and agent discovery

- Lead with a concise, self-contained answer to the page's primary question.
- Use stable descriptive headings and anchors that remain meaningful outside visual context.
- State supported versions, prerequisites, limitations, and verification dates explicitly.
- Attach public source references and claim identifiers without leaking private evidence.
- Keep tables machine-readable and code blocks labeled with language and filename or purpose.
- Generate faithful per-page Markdown without unresolved MDX components, placeholder imports, or missing marketing content.
- Keep `llms.txt` concise and navigational; offer a consolidated index only if it can be generated and size-bounded from canonical pages.
- Make factual assertions quotable in small passages while linking to deeper evidence.
- Do not use invisible agent-only text, keyword stuffing, fabricated citations, or speculative feature claims.

### 10.5 Discovery evaluation

Build-time evaluation must cover at least:

- conventional Pagefind retrieval for `hash chain`, `FastAPI`, `redaction`, `exports`, and `tamper detection`;
- route-level metadata uniqueness and intent alignment;
- agent retrieval questions such as “How do I record and verify my first Veritio event?”, “Which stores are authoritative?”, “What happens if canonical bytes change?”, and “Does Python include the record-chain verifier?”;
- answer completeness: the retrieved page must contain the supported version, exact procedure or answer, limitation, and source evidence;
- Markdown fidelity against the corresponding rendered page.

## 11. Contracts and Build Failures

The build fails when:

- required metadata or provenance is absent;
- a hosted claim is unknown, unapproved, or not covered by the page's declared references;
- an imported fixture, source revision, or content hash drifts;
- an expected output assertion fails;
- language-equivalent examples diverge in event semantics;
- a documentation route is missing from the sidebar or has no inbound link;
- a canonical, redirect, sitemap, hreflang, Markdown, or internal-link rule fails;
- agent Markdown contains unresolved components or placeholder code;
- prohibited automatic-compliance language appears;
- documented CLI commands, error identifiers, schema fields, or exported symbols do not exist at the verified revision.

## 12. Verification and Release

### Automated

- Run website content-contract, example, TypeScript, Python, Go, build-output, Pagefind, metadata, schema, link, anchor, redirect, and claims tests.
- Run `bun run check`, `bun run build`, and the complete website verification script.
- Run `bun run verify:split` when public source verification crosses repositories.
- Run relevant upstream example tests for every referenced application.

### Browser

- Verify the complete learning journey at desktop and mobile widths in the user's selected browser.
- Test keyboard navigation, skip links, active rail, sidebar drawer, page outline, search, theme persistence, code copy, language tabs, consent and withdrawal, reduced motion, and horizontal overflow.
- Compare the active-sidebar implementation directly with the supplied screenshot and the corrected target state.
- Require no serious or critical accessibility findings, Lighthouse accessibility at least 95, performance at least 90, and CLS below 0.1 on representative marketing and documentation pages.

### Review

- Run the Astro site, public claims, repository routing, and SDK parity reviewers.
- Treat any unsupported behavior or claim as a release blocker.
- Release atomically only when the approved sitemap and primary learning journey are complete.

## 13. Acceptance Criteria

The rebuild is complete only when a new developer can follow the documented local path from installation through a verified tamper failure without consulting repository source or guessing a command; every shown example and output is tested; pages have distinct information shapes and user intents; the active sidebar uses one guide rail; public search and agent-readable surfaces retrieve correct, cited answers; and no page claims behavior that the owning repository cannot prove.
