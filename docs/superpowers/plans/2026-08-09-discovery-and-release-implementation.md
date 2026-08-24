# Veritio Search, GEO, Agent Discovery, and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the complete public site technically discoverable, machine-readable, source-backed, and release-ready without creating parallel agent-only content.

**Architecture:** Canonical Astro content and rendered marketing pages generate HTML, JSON-LD, Pagefind documents, per-page Markdown, `llms.txt`, and a bounded consolidated agent corpus. Built-output tests validate URL identity, metadata, structured data, link graphs, retrieval quality, and indexing controls.

**Tech Stack:** Astro Sitemap, Starlight Pagefind, Turndown, JSON-LD, Bun tests, Cloudflare static headers and redirects, Lighthouse, axe

## Global Constraints

- HTML is canonical; Markdown representations use `noindex, follow` and remain outside XML sitemaps and Pagefind.
- All URLs use the trailing-slash policy across HTML, metadata, structured data, redirects, and internal links.
- Agent-readable output derives from the same rendered content and public claims registry.
- Do not add invisible text, keyword stuffing, fabricated citations, FAQ schema without matching visible content, or speculative claims.
- Preserve cookieless Umami and consent-gated GA4 behavior.
- Do not commit, push, or deploy unless the user asks.

---

### Task 1: Establish technical SEO and metadata contracts

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/docs/DocsHead.astro`
- Modify: `src/content.config.ts`
- Modify: `tests/build-output.test.ts`
- Create: `src/lib/structured-data.ts`

**Interfaces:**
- `canonicalizePath(path: string): string` returns `/` or a lower-case trailing-slash path.
- `buildTechArticleJsonLd(input: TechArticleInput): Record<string, unknown>` returns source-backed documentation schema.
- `buildBreadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, unknown>` returns canonical breadcrumb URLs.

- [ ] **Step 1: Add failing built-output metadata tests**

For every canonical HTML page, assert one title, one meta description, one canonical, no `noindex`, and valid JSON-LD. Assert title and description uniqueness except intentional localized equivalents. For documentation, assert `TechArticle` with `headline`, `description`, `dateModified`, `inLanguage: "en"`, canonical `mainEntityOfPage`, and public source citation URLs.

- [ ] **Step 2: Run the built tests and confirm failure**

Run: `bun run build && bun test tests/build-output.test.ts`

Expected: documentation schema and route-wide uniqueness checks fail before implementation.

- [ ] **Step 3: Implement shared structured-data builders**

Create typed pure builders. Reject non-HTTPS external citations and non-canonical internal URLs. Serialize through Astro with JSON escaping and never interpolate untrusted HTML.

- [ ] **Step 4: Add documentation JSON-LD through `DocsHead.astro`**

Read validated content metadata from `Astro.locals.starlightRoute.entry.data`, derive the canonical URL from `Astro.url.pathname`, and emit `TechArticle` plus `BreadcrumbList`. Keep global Organization and WebSite schema on marketing pages without duplicating incompatible identifiers.

- [ ] **Step 5: Run technical SEO tests**

Run: `bun run check && bun run build && bun test tests/build-output.test.ts`

Expected: canonical, metadata, JSON-LD, and hreflang contracts pass.

### Task 2: Build the internal-link and topical-cluster graph

**Files:**
- Modify: `tests/build-output.test.ts`
- Modify: `astro.config.mjs`
- Modify: documentation pages under `src/content/docs/docs/`
- Modify: relevant marketing pages under `src/pages/`

**Interfaces:**
- Produces a built route graph where every canonical page has inbound navigation and documentation hubs link to their spokes.

- [ ] **Step 1: Add a built graph test**

Parse canonical HTML links into `Map<string, Set<string>>`. Exclude external, asset, mail, fragment-only, Markdown, and redirect routes. Assert every canonical page except `/` has at least one inbound link, every documentation section is reachable from `/docs/`, and key routes are reachable from `/` within three edges.

- [ ] **Step 2: Run the graph test and inspect exact orphan paths**

Run: `bun run build && bun test tests/build-output.test.ts -t "link graph"`

Expected: the test prints any orphan or over-buried canonical URL.

- [ ] **Step 3: Add contextual cluster links**

Connect tutorial steps to concepts and reference; concepts to tasks; framework guides to storage and verification; storage to self-hosting; agent pages to redaction and event schema; Cloud to OSS verification. Use descriptive anchor text that names the target task or concept.

- [ ] **Step 4: Verify the graph**

Run: `bun test tests/build-output.test.ts -t "link graph"`

Expected: no orphan pages and all priority routes pass the three-edge check.

### Task 3: Generate faithful agent-readable surfaces

**Files:**
- Modify: `scripts/build-agent-docs.ts`
- Modify: `public/llms.txt`
- Modify: `public/_headers`
- Modify: `tests/build-output.test.ts`
- Create during build: `dist/llms-full.txt`
- Create during build: `dist/agent-index.json`

**Interfaces:**
- `renderedPageToMarkdown(html: string): string` remains the only HTML-to-Markdown converter.
- `agent-index.json` contains `url`, `markdownUrl`, `title`, `description`, `kind`, `questions`, `lastUpdated`, `verifiedAgainst`, `sourceRefs`, and approved `claimRefs` for each public page.

- [ ] **Step 1: Add failing agent-output tests**

Assert every canonical page has faithful Markdown, all internal Markdown links resolve, no output contains unresolved Astro/MDX tags or imported-fixture placeholders, and `agent-index.json` has one entry per canonical page. Assert `llms-full.txt` is generated from per-page Markdown in canonical route order and stays below a documented byte ceiling.

- [ ] **Step 2: Run the built tests and confirm failure**

Run: `bun run build && bun test tests/build-output.test.ts -t "agent"`

Expected: failure because the consolidated corpus and machine-readable index do not yet exist.

- [ ] **Step 3: Generate the index and bounded corpus**

Extract canonical metadata from rendered HTML data attributes or a build-time content manifest. Do not scrape private provenance. Concatenate route title, canonical URL, last-updated metadata, and faithful Markdown. Fail when the byte ceiling is exceeded instead of silently truncating pages.

- [ ] **Step 4: Rewrite `llms.txt` as a concise navigation manifest**

Link the documentation home, Start Here sequence, concept/reference hubs, examples, changelog, per-page Markdown convention, `llms-full.txt`, `agent-index.json`, and public claims registry. State the OSS/Cloud boundary and that Veritio provides evidence support rather than legal advice.

- [ ] **Step 5: Protect alternate representations from indexing**

Extend `_headers` so `.md`, `llms-full.txt`, and `agent-index.json` return correct content types where supported and `X-Robots-Tag: noindex, follow`. Keep `llms.txt` crawlable as a navigational file while excluding it from XML sitemap entries.

- [ ] **Step 6: Run the agent-output gate**

Run: `bun run build && bun test tests/build-output.test.ts`

Expected: all agent-readable files exist, contain canonical content, expose no private provenance, and satisfy indexing rules.

### Task 4: Add search and answer-retrieval evaluations

**Files:**
- Modify: `tests/build-output.test.ts`
- Create: `tests/fixtures/discovery-queries.json`

**Interfaces:**
- Each query fixture contains `query`, `expectedRoute`, `mustContain`, and `mustNotClaim`.
- Pagefind and agent index evaluations consume the same fixture set.

- [ ] **Step 1: Create the discovery query corpus**

Include exact cases for hash chain, FastAPI, deterministic redaction, Cloud exports, tamper detection, authoritative stores, Python verifier availability, first event recording, evidence graph, retention deletion boundary, and agent secret handling.

- [ ] **Step 2: Add failing Pagefind and agent-answer tests**

For Pagefind, require the intended route in the first five results. For the agent index, tokenize the query and rank title, questions, description, and Markdown headings with deterministic weights; require the intended route first and assert `mustContain` phrases occur in its Markdown while `mustNotClaim` phrases do not.

- [ ] **Step 3: Run the tests and improve content rather than hardcoding rankings**

Run: `bun run build && bun test tests/build-output.test.ts -t "discovery"`

Expected: failures identify ambiguous titles, headings, or missing answers. Fix the canonical page content or metadata; do not special-case individual queries in ranking code.

- [ ] **Step 4: Run the complete discovery suite**

Run: `bun test tests/build-output.test.ts`

Expected: every representative human and agent query retrieves its intended source-backed page.

### Task 5: Verify search-engine directives and Cloudflare output

**Files:**
- Modify: `public/robots.txt`
- Modify: `public/_headers`
- Modify: `public/_redirects`
- Modify: `tests/build-output.test.ts`

**Interfaces:**
- Produces built Cloudflare static configuration aligned with canonical route policy.

- [ ] **Step 1: Add directive and redirect tests**

Assert the production sitemap URL, crawl allowance for canonical HTML, no blanket AI-crawler blocks, no `.md` sitemap entries, permanent legacy redirects without chains, security headers, and noindex headers on alternate representations.

- [ ] **Step 2: Run the build-output tests**

Run: `bun run build && bun test tests/build-output.test.ts`

Expected: any disagreement between source configuration and built output is reported.

- [ ] **Step 3: Serve the built site with Wrangler**

Run `bunx wrangler dev --local --port 8788` against the configured `dist` asset directory. Request representative HTML, Markdown, `llms.txt`, `llms-full.txt`, `agent-index.json`, and both legacy redirects. Record status, location, content type, cache, and robots headers.

- [ ] **Step 4: Add regression assertions for observed preview behavior**

Encode only deterministic Cloudflare behavior in tests; keep ports and local hostnames out of canonical metadata assertions.

### Task 6: Complete browser, accessibility, performance, and review gates

**Files:**
- Modify only files implicated by observed failures.
- Record final evidence in: `design-qa.md`

**Interfaces:**
- Produces final release evidence without deploying.

- [ ] **Step 1: Run the full automated suite**

Run: `bun run verify && bun run verify:split`

Expected: all repository and cross-repository checks pass.

- [ ] **Step 2: Browser-test representative marketing and documentation routes**

Use the user's in-app browser at desktop and mobile widths. Verify keyboard order, skip links, one-rail sidebar selection, drawer, outline, command search, theme persistence, synchronized language tabs, code copy, reduced motion, consent grant/withdrawal, and zero horizontal overflow.

- [ ] **Step 3: Run accessibility and performance measurements**

Require zero serious or critical axe findings, Lighthouse accessibility at least 95, performance at least 90, and CLS below 0.1 on `/`, `/docs/`, `/docs/start/record-first-event/`, `/docs/concepts/hash-chain/`, and `/docs/frameworks/fastapi/`.

- [ ] **Step 4: Run domain reviewers**

Run Astro site, public claims, repository routing, and SDK parity reviews. Fix validated findings in their owning repository and rerun the affected automated and browser gates.

- [ ] **Step 5: Write final evidence**

Record commands, results, inspected routes/viewports, search queries, accessibility findings, performance values, and any intentionally unavailable capability in `design-qa.md`. Do not claim production validation because deployment is outside scope.
