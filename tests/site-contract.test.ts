import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import claimsRegistry from '../src/data/public-claims.json'
import examplesManifest from '../src/examples/manifest.json'

const root = join(import.meta.dir, '..')
const docsRoot = join(root, 'src/content/docs/docs')

const marketingRoutes = [
  'src/pages/index.astro',
  'src/pages/product.astro',
  'src/pages/open-source.astro',
  'src/pages/cloud.astro',
  'src/pages/pricing.astro',
  'src/pages/examples.astro',
  'src/pages/alternatives/index.astro',
  'src/pages/changelog.astro',
  'src/pages/legal/imprint.astro',
  'src/pages/legal/privacy.astro',
  'src/pages/legal/terms.astro',
  'src/pages/legal/dpa.astro',
  'src/pages/de/index.astro',
  'src/pages/de/cloud.astro',
  'src/pages/de/pricing.astro',
  'src/pages/ko/index.astro',
  'src/pages/ko/cloud.astro',
  'src/pages/ko/pricing.astro',
]

const docsRoutes = [
  'index.mdx',
  'start/installation.mdx',
  'start/record-first-event.mdx',
  'start/verify-a-chain.mdx',
  'start/choose-your-path.mdx',
  'concepts/audit-events.mdx',
  'concepts/hash-chain.mdx',
  'concepts/evidence-graph.mdx',
  'concepts/evidence-commits.mdx',
  'concepts/governed-changes.mdx',
  'concepts/risk-scoring.mdx',
  'concepts/activity-episodes.mdx',
  'concepts/redaction.mdx',
  'concepts/retention.md',
  'guides/governed-actions.mdx',
  'guides/transactional-outbox.mdx',
  'guides/audit-templates.mdx',
  'guides/consent-history.mdx',
  'guides/dsar-fulfillment.mdx',
  'guides/risk-policy-tuning.mdx',
  'guides/security-risk-assertions.mdx',
  'sdks/typescript.mdx',
  'sdks/python.mdx',
  'sdks/go.mdx',
  'sdks/cli.md',
  'frameworks/nextjs.md',
  'frameworks/fastapi.md',
  'frameworks/hono.md',
  'frameworks/better-auth.md',
  'frameworks/tanstack-start.mdx',
  'frameworks/sveltekit.mdx',
  'frameworks/express.mdx',
  'storage/overview.mdx',
  'storage/postgres.md',
  'storage/file-store.mdx',
  'storage/mysql-mariadb.mdx',
  'storage/mongodb.mdx',
  'storage/outbox.mdx',
  'storage/conformance.mdx',
  'storage/self-hosting.md',
  'ai/agent-events.mdx',
  'ai/provenance-recorder.mdx',
  'ai/risk-signals.mdx',
  'ai/gateway.mdx',
  'ai/claude-code.md',
  'ai/codex.md',
  'cloud/overview.md',
  'cloud/getting-started.md',
  'cloud/exports.mdx',
  'reference/event-schema.md',
  'reference/governed-change-api.mdx',
  'reference/template-catalogue.mdx',
  'reference/risk-policy.mdx',
  'reference/evidence-commit-hashing.mdx',
  'reference/evidence-vocabulary.mdx',
  'reference/parity-matrix.mdx',
  'reference/verifier.mdx',
  'reference/export-format.mdx',
  'reference/troubleshooting.mdx',
  'reference/glossary.mdx',
]

function walk(directory: string): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

describe('approved public sitemap', () => {
  test.each(marketingRoutes)('%s exists', (route) => {
    expect(existsSync(join(root, route))).toBeTrue()
  })

  test.each(docsRoutes)('/docs/%s exists', (route) => {
    expect(existsSync(join(docsRoot, route))).toBeTrue()
  })
})

describe('public repository boundary', () => {
  test('the public checkout excludes internal agent plans and local QA artifacts', () => {
    expect(existsSync(join(root, 'docs/superpowers'))).toBeFalse()
    expect(existsSync(join(root, 'design-qa.md'))).toBeFalse()
    expect(existsSync(join(root, 'design-qa-comparison-desktop.png'))).toBeFalse()
    expect(existsSync(join(root, 'design-qa-implementation-desktop.png'))).toBeFalse()
    expect(existsSync(join(root, 'design-qa-implementation-mobile.png'))).toBeFalse()
  })
})

describe('reviewed Cloud billing catalog', () => {
  test('the website snapshot preserves the six public Cloud products exactly', () => {
    const catalogPath = join(root, 'src/data/cloud-billing-catalog.json')
    expect(existsSync(catalogPath)).toBeTrue()
    if (!existsSync(catalogPath)) return

    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
    expect(catalog).toEqual({
      version: '2026-08-25.v2',
      currency: 'USD',
      trial: { days: 14, cardRequired: true },
      products: [
        { key: 'pro:monthly', planId: 'pro', name: 'Pro', interval: 'monthly', amountCents: 2900, maxProjects: 3, monthlyEvents: 100000, hardMonthlyEventCeiling: 200000, exportBundlesPerMonth: 5, retention: { available: false } },
        { key: 'pro:yearly', planId: 'pro', name: 'Pro', interval: 'yearly', amountCents: 29000, maxProjects: 3, monthlyEvents: 100000, hardMonthlyEventCeiling: 200000, exportBundlesPerMonth: 5, retention: { available: false } },
        { key: 'team:monthly', planId: 'team', name: 'Team', interval: 'monthly', amountCents: 9900, maxProjects: 3, monthlyEvents: 500000, hardMonthlyEventCeiling: 1000000, exportBundlesPerMonth: null, retention: { available: false } },
        { key: 'team:yearly', planId: 'team', name: 'Team', interval: 'yearly', amountCents: 99000, maxProjects: 3, monthlyEvents: 500000, hardMonthlyEventCeiling: 1000000, exportBundlesPerMonth: null, retention: { available: false } },
        { key: 'compliance:monthly', planId: 'compliance', name: 'Compliance', interval: 'monthly', amountCents: 49900, maxProjects: 10, monthlyEvents: 5000000, hardMonthlyEventCeiling: 10000000, exportBundlesPerMonth: null, retention: { available: false } },
        { key: 'compliance:yearly', planId: 'compliance', name: 'Compliance', interval: 'yearly', amountCents: 499000, maxProjects: 10, monthlyEvents: 5000000, hardMonthlyEventCeiling: 10000000, exportBundlesPerMonth: null, retention: { available: false } },
      ],
      enterprise: { contactSales: true },
    })
  })
})

describe('documentation publishing contracts', () => {
  test('every guide declares required provenance metadata', () => {
    const files = walk(docsRoot).filter((file) => /\.mdx?$/.test(file))
    expect(files.length).toBe(docsRoutes.length)

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const field of [
        'title:',
        'description:',
        'audience:',
        'kind:',
        'lastUpdated:',
        'verifiedAgainst:',
        'sourceRefs:',
        'claimRefs:',
      ]) {
        expect(source, `${file} is missing ${field}`).toContain(field)
      }
      const sourceRefs = source.match(/^sourceRefs:\s*(?:\[([^\]]+)\]|\n\s+-\s+(\S+))/m)
      expect(sourceRefs?.[1] || sourceRefs?.[2], `${file} must declare at least one public source reference`).toBeTruthy()
    }
  })

  test('pinned OSS source references resolve at the verified revision', () => {
    const ossRoot = join(root, '..', 'veritio')
    if (!existsSync(join(ossRoot, '.git'))) return

    for (const file of walk(docsRoot).filter((entry) => /\.mdx?$/.test(entry))) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/https:\/\/github\.com\/getveritio\/veritio\/(?:blob|tree)\/([0-9a-f]{40})\/([^\s'"\]]+)/g)) {
        const [, revision, path] = match
        expect(() => execFileSync('git', ['-C', ossRoot, 'cat-file', '-e', `${revision}:${path}`]), `${file} references missing OSS path ${path}`).not.toThrow()
      }
    }
  })

  test('every guide declares distinct search intent and answerable questions', () => {
    const files = walk(docsRoot).filter((file) => /\.mdx?$/.test(file))
    const intents = new Map<string, string>()

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
      const searchIntent = frontmatter.match(/^searchIntent:\s+(.+)$/m)?.[1]?.trim()
      const questions = frontmatter.match(/^questions:\n((?:\s+- .+\n?)+)/m)?.[1]
        ?.split('\n')
        .map((line) => line.replace(/^\s+-\s+/, '').trim())
        .filter(Boolean) ?? []

      expect(searchIntent, `${file} needs a specific search intent`).toBeDefined()
      expect(searchIntent!.length, `${file} needs a specific search intent`).toBeGreaterThanOrEqual(20)
      expect(searchIntent!.length, `${file} search intent is too broad`).toBeLessThanOrEqual(160)
      expect(questions.length, `${file} needs one to five answerable questions`).toBeGreaterThanOrEqual(1)
      expect(questions.length, `${file} has too many answerable questions`).toBeLessThanOrEqual(5)
      for (const question of questions) {
        expect(question.length, `${file} has an underspecified question`).toBeGreaterThanOrEqual(10)
        expect(question.length, `${file} has an overlong question`).toBeLessThanOrEqual(180)
      }

      if (searchIntent) {
        expect(intents.has(searchIntent), `${file} duplicates ${intents.get(searchIntent)}`).toBeFalse()
        intents.set(searchIntent, file)
      }
    }
  })

  test('the explicit sidebar covers every documentation route once', () => {
    const config = readFileSync(join(root, 'astro.config.mjs'), 'utf8')
    const slugs = docsRoutes.map((route) => route === 'index.mdx' ? 'docs' : `docs/${route.replace(/\.(md|mdx)$/, '')}`)
    expect(new Set(slugs).size).toBe(docsRoutes.length)
    for (const slug of slugs) {
      const occurrences = config.split(`slug: '${slug}'`).length - 1
      expect(occurrences, `sidebar entry for ${slug}`).toBe(1)
    }
  })

  test('every hosted claim reference is approved in the public registry', () => {
    const registry = claimsRegistry.claims as Record<string, { status: string; verifiedOn: string }>
    for (const file of walk(docsRoot).filter((entry) => /\.mdx?$/.test(entry))) {
      const source = readFileSync(file, 'utf8')
      const refs = source.match(/^claimRefs: \[(.*)\]$/m)?.[1]
        ?.split(',')
        .map((ref) => ref.trim())
        .filter(Boolean) ?? []
      for (const ref of refs) {
        expect(registry[ref], `${file} references unknown claim ${ref}`).toBeDefined()
        expect(registry[ref]?.status, `${ref} is not approved`).toBe('approved')
        expect(registry[ref]?.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })

  test('public claim approvals never expose private implementation provenance', () => {
    const registry = JSON.stringify(claimsRegistry)
    expect(registry).not.toMatch(/veritio-cloud|github\.com\/getveritio\/veritio-cloud|[0-9a-f]{40}|(?:^|\/)src\//i)
  })

  test('hosted marketing surfaces declare approved claim references', () => {
    const expected: Record<string, string[]> = {
      'src/components/CloudPage.astro': ['cloud-projects-keys-ingest', 'cloud-evidence-views'],
      'src/components/PricingPage.astro': ['cloud-price-catalog'],
      'src/pages/index.astro': ['cloud-managed-path'],
      'src/pages/product.astro': ['cloud-managed-path'],
      'src/pages/open-source.astro': ['cloud-managed-path'],
      'src/pages/changelog.astro': ['cloud-export-requests'],
      'src/pages/de/index.astro': ['cloud-managed-path'],
      'src/pages/ko/index.astro': ['cloud-managed-path'],
      'src/pages/legal/privacy.astro': ['cloud-identity-and-evidence-processing', 'cloud-security-controls', 'cloud-provider-configuration'],
      'src/pages/legal/dpa.astro': ['cloud-identity-and-evidence-processing', 'cloud-security-controls', 'cloud-provider-configuration', 'cloud-export-requests'],
      'src/pages/legal/terms.astro': ['cloud-projects-keys-ingest', 'cloud-security-controls', 'cloud-export-requests', 'cloud-price-catalog'],
    }
    for (const [file, claims] of Object.entries(expected)) {
      const source = readFileSync(join(root, file), 'utf8')
      const layoutStart = source.indexOf('<BaseLayout')
      const layoutOpening = source.slice(layoutStart, source.indexOf('>', layoutStart) + 1)
      expect(layoutOpening, `${file} must pass claimRefs to BaseLayout`).toContain('claimRefs=')
      for (const claim of claims) expect(layoutOpening, file).toContain(claim)
    }
    expect(readFileSync(join(root, 'src/layouts/BaseLayout.astro'), 'utf8')).toContain('Unapproved public claim reference')
  })

  test('legacy docs routes have permanent redirects', () => {
    const redirects = readFileSync(join(root, 'public/_redirects'), 'utf8')
    expect(redirects).toContain('/docs/cloud-getting-started/ /docs/cloud/getting-started/ 301')
    expect(redirects).toContain('/docs/connect-agents/ /docs/ai/agent-events/ 301')
  })

  test('agent-readable Markdown is excluded from indexing', () => {
    const headers = readFileSync(join(root, 'public/_headers'), 'utf8')
    expect(headers).toContain('/*.md')
    expect(headers).toContain('X-Robots-Tag: noindex, follow')
  })

  test('interactive preferences survive Starlight navigation', () => {
    const consent = readFileSync(join(root, 'src/components/CookieBanner.astro'), 'utf8')
    const consentScript = readFileSync(join(root, 'src/components/ConsentScript.astro'), 'utf8')
    const docsIndex = readFileSync(join(root, 'src/content/docs/docs/index.mdx'), 'utf8')
    expect(consent).toContain('.cookie-banner[hidden]')
    expect(consentScript).toContain("window.VeritioConsent =")
    expect(consentScript).toContain("document.addEventListener('astro:page-load', initializeCookieBanner)")
    expect(consentScript).toContain('restoreSettingsFocus()')
    expect(readFileSync(join(root, 'src/components/docs/DocsThemeToggle.astro'), 'utf8')).toContain('updatePickers')
    expect(docsIndex.match(/<Tabs syncKey="language">/g)).toHaveLength(2)
  })

  test('the active docs item reuses its section guide rail', () => {
    const css = readFileSync(join(root, 'src/styles/docs.css'), 'utf8')
    const activeLinkRule = css.match(/\.sidebar-content a\[aria-current='page'\]\s*\{([\s\S]*?)\}/)?.[1] ?? ''
    expect(activeLinkRule).not.toContain('border-inline-start')
    expect(css).toContain(".sidebar-content ul ul li:has(> a[aria-current='page'])")
    expect(css).toContain('border-inline-start-color: var(--sl-color-accent)')
  })

  test('marketing uses the approved client JavaScript boundary', () => {
    const evidencePanel = readFileSync(join(root, 'src/components/EvidenceStreamPanel.astro'), 'utf8')
    expect(evidencePanel).not.toContain('IntersectionObserver')
    expect(evidencePanel).not.toContain('<video')
  })
})

describe('public claims policy', () => {
  test('public source avoids automatic-compliance claims', () => {
    const files = walk(join(root, 'src')).filter((file) => /\.(astro|md|mdx|ts)$/.test(file))
    const prohibited = /(?:guarantees?|ensures?|makes? (?:you|an application|your app)) (?:automatic )?(?:gdpr|ccpa|soc 2|hipaa|dora|nis2|compliance)/i

    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(prohibited)
    }
  })

  test('marketing does not publish unverified retention or region promises', () => {
    const marketing = [
      'src/components/CloudPage.astro',
      'src/components/PricingPage.astro',
      'src/pages/index.astro',
      'src/pages/de/index.astro',
      'src/pages/ko/index.astro',
      'src/pages/legal/privacy.astro',
      'src/pages/legal/dpa.astro',
      'src/pages/legal/terms.astro',
    ].map((file) => readFileSync(join(root, file), 'utf8')).join('\n')
    expect(marketing).not.toMatch(/pick your region|region choice at signup|storage is pinned to|region pinned|EU jurisdiction guarantee|90 days|365 days|5 years|<strong>30 days<\/strong>/i)
  })

  test('public examples render the checked fixtures instead of prose copies', () => {
    const examples = readFileSync(join(root, 'src/pages/examples.astro'), 'utf8')
    const home = readFileSync(join(root, 'src/pages/index.astro'), 'utf8')
    expect(examples).toContain("../examples/quickstart/typescript.ts?raw")
    expect(examples).toContain("../examples/quickstart/python.py?raw")
    expect(examples).toContain("../examples/quickstart/go.go?raw")
    expect(home).toContain("../examples/quickstart/typescript.ts?raw")
    expect(examples).not.toContain('pip install veritio`')
  })
})

describe('checked code fixtures', () => {
  test('fixture manifest defines executable, route-owned evidence', () => {
    const ids: string[] = []
    for (const rawExample of examplesManifest.examples) {
      const example = rawExample as Record<string, unknown>
      expect(example.id, JSON.stringify(example)).toBeDefined()
      expect(String(example.id), JSON.stringify(example)).toMatch(/^[a-z0-9-]+$/)
      expect(example.command, String(example.id)).toBeArray()
      expect((example.command as unknown[]).length, String(example.id)).toBeGreaterThan(0)
      expect(example.expectedOutputPath, String(example.id)).toMatch(/^src\/examples\/.+\.txt$/)
      expect(example.semanticsId, String(example.id)).toMatch(/^[a-z][a-z0-9-]+@\d+$/)
      expect(example.routes, String(example.id)).toBeArray()
      expect((example.routes as unknown[]).length, String(example.id)).toBeGreaterThan(0)
      ids.push(example.id as string)
    }
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('fixture content matches the reviewed manifest hashes', () => {
    for (const example of examplesManifest.examples) {
      const actual = createHash('sha256').update(readFileSync(join(root, example.path))).digest('hex')
      expect(actual, example.path).toBe(example.sha256)
      expect(example.upstreamPath).toBeTruthy()
    }
  })

  test('fixture verification rejects output that differs from the reviewed artifact', () => {
    let failure = ''
    try {
      execFileSync('bun', ['run', 'scripts/verify-examples.ts'], {
        cwd: root,
        env: {
          ...process.env,
          VERITIO_EXAMPLE_MANIFEST: 'tests/fixtures/invalid-example-output.json',
        },
        stdio: 'pipe',
      })
    } catch (error) {
      const commandError = error as Error & { stderr?: Buffer }
      failure = `${commandError.message}\n${commandError.stderr?.toString() ?? ''}`
    }
    expect(failure).toContain('output changed')
  })
})
