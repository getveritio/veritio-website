# Veritio Documentation Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the templated documentation shell with an archetype-aware, executable learning foundation and correct the active sidebar rail.

**Architecture:** Starlight remains the responsive documentation shell. Astro content metadata identifies each page's intent, a verified fixture manifest binds displayed examples to commands and output assertions, and the Start Here sequence imports those fixtures into a continuous TypeScript tutorial.

**Tech Stack:** Astro 7, Starlight 0.41.7, MDX, TypeScript 6, Bun tests, `@veritio/core` 0.4.4, Python 3, Go 1.22+

## Global Constraints

- Work directly in the existing `main` checkout and preserve all unrelated uncommitted changes.
- Do not commit, push, deploy, or change external state unless the user asks.
- Keep TypeScript as the complete canonical tutorial; describe Python and Go capabilities truthfully without simulated parity.
- Keep one canonical content source for rendered HTML, Markdown, search, and agent discovery.
- Route missing OSS behavior to `../veritio`; do not implement protocol or SDK semantics in the website.
- Keep Cloud behavior behind approved public claim references.
- Do not use automatic-compliance language.

---

### Task 1: Replace the universal guide-template contract with page-archetype contracts

**Files:**
- Modify: `src/content.config.ts`
- Modify: `tests/site-contract.test.ts`
- Modify: all files under `src/content/docs/docs/`

**Interfaces:**
- Produces frontmatter fields `kind`, `searchIntent`, and `questions` for discovery and page-specific validation.
- Produces allowed `kind` values `overview | tutorial | guide | concept | reference | troubleshooting`.

- [ ] **Step 1: Write the failing metadata test**

Replace the test that demands the same headings from every guide with assertions equivalent to:

```ts
const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
expect(frontmatter, `${file} needs a search intent`).toMatch(/^searchIntent: .{20,160}$/m)
expect(frontmatter, `${file} needs answerable questions`).toMatch(/^questions:\n(?:\s+- .+\n){1,5}/m)
expect(source, `${file} repeats the rejected universal template`).not.toMatch(
  /## Purpose[\s\S]+## Prerequisites[\s\S]+## Smallest working example[\s\S]+## How it works[\s\S]+## Expected output[\s\S]+## Failure and security notes[\s\S]+## Verify[\s\S]+## Next steps/,
)
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `bun test tests/site-contract.test.ts`

Expected: failure because current pages lack `searchIntent` and `questions` and still contain the rejected repeated structure.

- [ ] **Step 3: Extend the content schema**

Add these exact schema entries:

```ts
kind: z.enum(['overview', 'tutorial', 'guide', 'concept', 'reference', 'troubleshooting']),
searchIntent: z.string().min(20).max(160),
questions: z.array(z.string().min(10).max(180)).min(1).max(5),
```

- [ ] **Step 4: Add valid metadata to every existing route**

Give each page one distinct search intent and one to five questions matching its route intent in the approved design. Do not rewrite body content in this step; remove the rejected fixed heading contract only when the owning content task rewrites that page.

- [ ] **Step 5: Run the schema and contract tests**

Run: `bun test tests/site-contract.test.ts`

Expected: all metadata tests pass; any remaining repeated template is reported with its file path for Tasks 4 and the content plan.

### Task 2: Move the active state onto the existing sidebar guide rail

**Files:**
- Modify: `src/styles/docs.css`
- Modify: `tests/site-contract.test.ts`

**Interfaces:**
- Consumes Starlight's `.sidebar-content`, group list, and `a[aria-current='page']` markup.
- Produces a single active accent segment through the active list item's pseudo-element.

- [ ] **Step 1: Add a source contract for the visual regression**

```ts
test('the docs sidebar uses one shared rail for the active item', () => {
  const css = readFileSync(join(root, 'src/styles/docs.css'), 'utf8')
  const activeRule = css.match(/\.sidebar-content a\[aria-current='page'\]\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  expect(activeRule).not.toContain('border-inline-start')
  expect(css).toContain(".sidebar-content li:has(> a[aria-current='page'])::before")
  expect(css).toContain('background: var(--sl-color-accent)')
})
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `bun test tests/site-contract.test.ts -t "sidebar uses one shared rail"`

Expected: failure because the active anchor currently owns a separate border.

- [ ] **Step 3: Implement the shared-rail active segment**

Remove `border-inline-start` from the active anchor. Position the active list item relative and add a narrow absolute `::before` segment over the existing group rail. Use the Starlight spacing visible in built markup, keep the background low-contrast, and retain selected text weight and color.

- [ ] **Step 4: Run the focused test and build**

Run: `bun test tests/site-contract.test.ts -t "sidebar uses one shared rail" && bun run check && bun run build`

Expected: commands pass.

- [ ] **Step 5: Inspect the exact desktop and mobile states in the user's in-app browser**

Inspect `/docs/concepts/hash-chain/` with the relevant Core Concepts group expanded. Confirm there is one continuous neutral rail, one aligned accent segment, no rounded green slab, no text overlap for wrapped links, and a visible keyboard focus ring.

### Task 3: Expand the verified example manifest into an execution contract

**Files:**
- Modify: `src/examples/manifest.json`
- Modify: `scripts/verify-examples.ts`
- Modify: `tests/site-contract.test.ts`
- Create: `src/examples/tutorial/record-and-verify.ts`
- Create: `src/examples/tutorial/tamper.ts`
- Create: `src/examples/tutorial/expected/record-and-verify.txt`
- Create: `src/examples/tutorial/expected/tamper.txt`

**Interfaces:**
- Each manifest example produces `id`, `language`, `path`, `upstreamPath`, `sha256`, `command`, `expectedOutputPath`, `semanticsId`, and `routes`.
- `scripts/verify-examples.ts` executes every declared command and compares normalized stdout with the declared output file.

- [ ] **Step 1: Write failing manifest-contract tests**

```ts
for (const example of examplesManifest.examples) {
  expect(example.id).toMatch(/^[a-z0-9-]+$/)
  expect(example.command.length).toBeGreaterThan(0)
  expect(example.expectedOutputPath).toMatch(/^src\/examples\/.+\.txt$/)
  expect(example.semanticsId).toMatch(/^audit-event@/)
  expect(example.routes.length).toBeGreaterThan(0)
}
expect(new Set(examplesManifest.examples.map((item) => item.id)).size).toBe(examplesManifest.examples.length)
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `bun test tests/site-contract.test.ts -t "fixture manifest"`

Expected: failure on missing execution fields.

- [ ] **Step 3: Add the continuous tutorial fixtures**

`record-and-verify.ts` must append two deterministic events to `MemoryAuditStore`, list them using the tenant scope, run `verifyAuditRecords`, and print stable JSON containing `sequences`, `previousHashLinked`, and `verification`.

`tamper.ts` must clone the returned records, change the second event's metadata without recomputing its record hash, run `verifyAuditRecords`, and print the exact failure object. It must also drop the first record and print the resulting sequence failure.

- [ ] **Step 4: Make verification data-driven**

Parse each `command` into an explicit executable plus arguments without a shell. Normalize line endings only. Compare stdout byte-for-byte with `expectedOutputPath`, and continue checking fixture SHA-256 and the exact upstream revision.

- [ ] **Step 5: Run fixture verification**

Run: `bun run verify:examples`

Expected: TypeScript tutorial outputs match exactly; existing TypeScript, Python, and Go event hashes remain equal.

### Task 4: Build the continuous Start Here tutorial from executable fixtures

**Files:**
- Modify: `src/content/docs/docs/index.mdx`
- Modify: `src/content/docs/docs/start/installation.mdx`
- Modify: `src/content/docs/docs/start/record-first-event.mdx`
- Modify: `src/content/docs/docs/start/verify-a-chain.md`
- Modify: `src/content/docs/docs/start/choose-your-path.md`
- Modify: `tests/site-contract.test.ts`
- Modify: `tests/build-output.test.ts`

**Interfaces:**
- Consumes tutorial fixtures and expected-output files from Task 3 using `?raw` imports.
- Produces one coherent path from install through a verified tamper failure.

- [ ] **Step 1: Add failing tutorial-continuity tests**

Assert the Start Here pages import the tutorial fixtures, link forward and backward using canonical trailing-slash URLs, show exact expected output, and contain these user-visible checkpoints: `Two records, one tenant-local chain`, `Verification passed`, `Tampering detected`, and `Dropped record detected`.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `bun test tests/site-contract.test.ts -t "tutorial"`

Expected: failure because the current pages do not form the specified continuous path.

- [ ] **Step 3: Rewrite the five Start Here pages**

Use chronological tutorial prose, short explanations after code, real terminal output, explicit file names, and clear checkpoints. Keep exhaustive field definitions in Reference. State that TypeScript owns the complete store/verifier path and link Python and Go to their honest SDK pages.

- [ ] **Step 4: Verify HTML and Markdown fidelity**

Run: `bun run build && bun test tests/build-output.test.ts`

Expected: built HTML and Markdown both contain the executable code and expected output; neither contains unresolved MDX component tags or import placeholders.

- [ ] **Step 5: Run the complete foundation gate**

Run: `bun run verify`

Expected: all website checks pass before route-wide content rewriting begins.

