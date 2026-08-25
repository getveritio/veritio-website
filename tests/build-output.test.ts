import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'

const root = join(import.meta.dir, '..')
const dist = join(root, 'dist')

function walk(directory: string): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

function html(path: string) {
  return readFileSync(join(dist, path, 'index.html'), 'utf8')
}

function visibleText(source: string) {
  return source
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;|&#x22;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

describe('built route and SEO contracts', () => {
  test('documentation remains English-only', () => {
    expect(existsSync(join(dist, 'docs/index.html'))).toBeTrue()
    expect(existsSync(join(dist, 'de/docs/index.html'))).toBeFalse()
    expect(existsSync(join(dist, 'ko/docs/index.html'))).toBeFalse()
  })

  test('representative pages use one trailing-slash canonical', () => {
    for (const path of ['', 'product', 'de/cloud', 'docs', 'docs/start/record-first-event']) {
      const source = html(path)
      const canonicals = [...source.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((match) => match[1])
      expect(canonicals, path || 'home').toHaveLength(1)
      expect(canonicals[0]).toEndWith('/')
    }
  })

  test('documentation emits canonical TechArticle and breadcrumb JSON-LD', () => {
    const source = html('docs/concepts/hash-chain')
    const jsonLdBlocks = [...source.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((match) => JSON.parse(match[1]))
      .flatMap((value) => Array.isArray(value) ? value : [value])
    const article = jsonLdBlocks.find((item) => item['@type'] === 'TechArticle')
    const breadcrumbs = jsonLdBlocks.find((item) => item['@type'] === 'BreadcrumbList')

    expect(article?.headline).toBe('Hash chain')
    expect(article?.mainEntityOfPage).toBe('https://getveritio.com/docs/concepts/hash-chain/')
    expect(article?.dateModified).toBe('2026-08-23')
    expect(article?.about).toContain('How does the Veritio hash chain work?')
    expect(breadcrumbs?.itemListElement.at(-1)?.item).toBe('https://getveritio.com/docs/concepts/hash-chain/')
  })

  test('canonical pages advertise generated agent-readable representations', () => {
    const docsSource = html('docs/concepts/hash-chain')
    expect(docsSource).toContain('<link rel="alternate" type="text/markdown" href="https://getveritio.com/docs/concepts/hash-chain.md"')
    expect(docsSource).toContain('<link rel="alternate" type="text/plain" href="https://getveritio.com/llms.txt"')
    expect(docsSource).toContain('<link rel="alternate" type="application/json" href="https://getveritio.com/agent-index.json"')

    const productSource = html('product')
    expect(productSource).toContain('<link rel="alternate" type="text/markdown" href="https://getveritio.com/product.md"')
    expect(productSource).toContain('<link rel="alternate" type="text/plain" href="https://getveritio.com/llms.txt"')
  })

  test('localized hreflang URLs use the same trailing-slash policy', () => {
    for (const path of ['', 'cloud', 'pricing', 'de/cloud', 'ko/pricing']) {
      const alternates = [...html(path).matchAll(/<link rel="alternate" hreflang="[^"]+" href="([^"]+)"/g)].map((match) => match[1])
      expect(alternates.length, path || 'home').toBeGreaterThan(0)
      for (const href of alternates) expect(href, `${path || 'home'}: ${href}`).toEndWith('/')
    }
  })

  test('marketing and legal pages expose a keyboard skip target', () => {
    for (const path of ['', 'product', 'legal/privacy', 'de/cloud', 'ko/pricing']) {
      const source = html(path)
      expect(source, path || 'home').toContain('href="#main-content"')
      expect(source, path || 'home').toContain('id="main-content"')
    }
  })

  test('desktop and mobile Cloud registration actions use the active locale', () => {
    for (const [path, label] of [
      ['pricing', 'Register for Cloud'],
      ['de/pricing', 'Für Cloud registrieren'],
      ['ko/pricing', 'Cloud 가입'],
    ] as const) {
      const source = html(path)
      expect(source.match(new RegExp(`>${label} ↗</a>`, 'g'))).toHaveLength(2)
    }
  })

  test('localized pricing renders six launch-gated selections with every reviewed operating limit', () => {
    const expectedSelections = [
      ['pro', 'monthly'],
      ['pro', 'yearly'],
      ['team', 'monthly'],
      ['team', 'yearly'],
      ['compliance', 'monthly'],
      ['compliance', 'yearly'],
    ] as const

    const localeFacts = {
      pricing: {
        monthlyPrices: ['$29', '$99', '$499'],
        monthlyLabel: 'Monthly',
        counts: ['100,000', '200,000', '500,000', '1,000,000', '5,000,000', '10,000,000'],
        projects: ['3 projects', '10 projects'],
        exports: ['5 export bundles each month', 'Unlimited export bundles'],
        retention: 'Plan-based evidence retention is not available yet.',
        launchGate: 'The planned launch configuration is a 14-day trial with a card required. It is not active yet.',
        handoff: 'Registration preserves your selection. It does not start checkout, a purchase, or a trial.',
      },
      'de/pricing': {
        monthlyPrices: ['29 $', '99 $', '499 $'],
        monthlyLabel: 'Monatlich',
        counts: ['100.000', '200.000', '500.000', '1.000.000', '5.000.000', '10.000.000'],
        projects: ['3 Projekte', '10 Projekte'],
        exports: ['5 Export-Bundles pro Monat', 'Unbegrenzte Export-Bundles'],
        retention: 'Planbasierte Aufbewahrung von Evidence-Daten ist noch nicht verfügbar.',
        launchGate: 'Die geplante Launch-Konfiguration ist eine 14-tägige Testphase mit erforderlicher Karte. Sie ist noch nicht aktiv.',
        handoff: 'Die Registrierung übernimmt Ihre Auswahl. Sie startet weder Checkout noch Kauf oder Testphase.',
      },
      'ko/pricing': {
        monthlyPrices: ['US$29', 'US$99', 'US$499'],
        monthlyLabel: '월간',
        counts: ['100,000', '200,000', '500,000', '1,000,000', '5,000,000', '10,000,000'],
        projects: ['3 개 프로젝트', '10 개 프로젝트'],
        exports: ['월 5개 내보내기 번들', '무제한 내보내기 번들'],
        retention: '플랜 기반 증거 보존은 아직 제공되지 않습니다.',
        launchGate: '출시 예정 구성은 카드가 필요한 14일 체험이며 아직 활성화되지 않았습니다.',
        handoff: '가입 시 선택 사항만 유지되며 결제, 구매 또는 체험은 시작되지 않습니다.',
      },
    } as const

    for (const [path, facts] of Object.entries(localeFacts)) {
      const source = html(path)
      const text = visibleText(source)
      for (const [plan, interval] of expectedSelections) {
        const redirect = encodeURIComponent(`/checkout?plan=${plan}&interval=${interval}`)
        expect(source, `${path}: ${plan}:${interval}`).toContain(
          `href="https://console.getveritio.com/register?redirect=${redirect}"`,
        )
      }
      for (const price of facts.monthlyPrices) {
        expect(source, `${path}: monthly ${price}`).toContain(`>${facts.monthlyLabel}</dt><dd class="mt-1 text-3xl">${price}`)
      }
      for (const count of facts.counts) expect(text, `${path}: ${count}`).toContain(count)
      for (const project of facts.projects) expect(text, `${path}: ${project}`).toContain(project)
      for (const exportLimit of facts.exports) expect(text, `${path}: ${exportLimit}`).toContain(exportLimit)
      expect(text.match(new RegExp(facts.retention, 'g')), `${path}: retention`).toHaveLength(3)
      expect(text, `${path}: launch gate`).toContain(facts.launchGate)
      expect(text, `${path}: registration handoff`).toContain(facts.handoff)
      expect(text, path).not.toMatch(/90 days|365 days|5 years|90 Tage|365 Tage|5 Jahre|90일|365일|5년/i)
    }
  })

  test('sitemap excludes Markdown and localized docs fallbacks', () => {
    const sitemap = walk(dist).filter((file) => /sitemap.*\.xml$/.test(file)).map((file) => readFileSync(file, 'utf8')).join('\n')
    expect(sitemap).not.toContain('.md</loc>')
    expect(sitemap).not.toContain('/de/docs/')
    expect(sitemap).not.toContain('/ko/docs/')
    expect(sitemap).not.toContain('/docs/cloud-getting-started/')
    expect(sitemap).not.toContain('/docs/connect-agents/')
  })

  test('every canonical public page has a faithful static Markdown representation', () => {
    const canonicalPages = walk(dist).filter((file) => file.endsWith('index.html') && !/\/docs\/(?:cloud-getting-started|connect-agents)\/index\.html$/.test(file))
    const markdown = walk(dist).filter((file) => file.endsWith('.md') && !file.endsWith('/.indexnow-note.md') && !file.endsWith('/flags/README.md'))
    expect(markdown.length).toBe(canonicalPages.length)
    for (const path of ['index.md', 'product.md', 'examples.md', 'changelog.md', 'legal/privacy.md', 'alternatives/aws-cloudtrail.md', 'docs.md']) {
      expect(existsSync(join(dist, path)), path).toBeTrue()
    }
    const docsMarkdown = readFileSync(join(dist, 'docs.md'), 'utf8')
    expect(docsMarkdown).toContain('import { MemoryAuditStore')
    expect(docsMarkdown).toContain("\nconst store = new MemoryAuditStore()")
    expect(docsMarkdown).not.toMatch(/<Aside|<CardGrid|<LinkCard|Imported from the checked fixture/)
    expect(existsSync(join(dist, 'claims.json'))).toBeTrue()
    expect(readFileSync(join(dist, 'claims.json'), 'utf8')).not.toMatch(/veritio-cloud|[0-9a-f]{40}/i)
    expect(readFileSync(join(dist, '_headers'), 'utf8')).toContain('X-Robots-Tag: noindex, follow')
  })

  test('agent discovery outputs are canonical, sourced, and bounded', () => {
    const indexPath = join(dist, 'agent-index.json')
    const fullPath = join(dist, 'llms-full.txt')
    expect(existsSync(indexPath)).toBeTrue()
    expect(existsSync(fullPath)).toBeTrue()

    const index = JSON.parse(readFileSync(indexPath, 'utf8'))
    expect(index.version).toBe(1)
    expect(index.pages).toHaveLength(60)
    for (const page of index.pages) {
      expect(page.url).toMatch(/^https:\/\/getveritio\.com\/docs\/(?:.*\/)?$/)
      expect(page.markdownUrl).toMatch(/^https:\/\/getveritio\.com\/docs(?:\/.*)?\.md$/)
      expect(page.questions.length).toBeGreaterThan(0)
      expect(page.sourceRefs.length).toBeGreaterThan(0)
    }

    const full = readFileSync(fullPath, 'utf8')
    expect(full.length).toBeLessThan(1_048_576)
    expect(full).toContain('Source: https://getveritio.com/docs/concepts/hash-chain/')
    expect(full).toContain('## Hash chain')
    expect(full).not.toMatch(/<Aside|<CardGrid|<LinkCard|\?raw/)

    const llms = readFileSync(join(dist, 'llms.txt'), 'utf8')
    expect(llms).toContain('https://getveritio.com/agent-index.json')
    expect(llms).toContain('https://getveritio.com/llms-full.txt')
    const headers = readFileSync(join(dist, '_headers'), 'utf8')
    expect(headers).toContain('/llms-full.txt')
    expect(headers).toContain('/agent-index.json')
  })

  test('legacy documentation routes are permanent redirects', () => {
    expect(html('docs/cloud-getting-started')).toContain('/docs/cloud/getting-started/')
    expect(html('docs/connect-agents')).toContain('/docs/ai/agent-events/')
  })

  test('analytics HTML loads Umami but never preloads GA4', () => {
    for (const path of ['', 'docs', 'docs/start/record-first-event']) {
      const source = html(path)
      expect(source, path || 'home').toContain('cloud.umami.is/script.js')
      expect(source, path || 'home').not.toContain('<script src="https://www.googletagmanager.com')
    }
  })

  test('the opening tutorial renders the checked two-record and tamper exercises', () => {
    const recordPage = html('docs/start/record-first-event')
    const recordText = visibleText(recordPage)
    expect(recordText).toContain('Two records, one tenant-local chain')
    expect(recordText).toContain('evt_member_joined_01')
    expect(recordText).toContain('"previousHashLinked": true')
    expect(recordPage).toContain('href="/docs/start/verify-a-chain/"')

    const verifyPage = html('docs/start/verify-a-chain')
    const verifyText = visibleText(verifyPage)
    expect(verifyText).toContain('Tampering detected')
    expect(verifyText).toContain('Dropped record detected')
    expect(verifyText).toContain('"reason": "hash_mismatch"')
    expect(verifyText).toContain('"reason": "sequence_mismatch"')

    const recordMarkdown = readFileSync(join(dist, 'docs/start/record-first-event.md'), 'utf8')
    const verifyMarkdown = readFileSync(join(dist, 'docs/start/verify-a-chain.md'), 'utf8')
    expect(recordMarkdown).toContain('evt_member_joined_01')
    expect(recordMarkdown).toContain('"previousHashLinked": true')
    expect(verifyMarkdown).toContain('"reason": "hash_mismatch"')
    expect(verifyMarkdown).toContain('"reason": "sequence_mismatch"')
  })

  test('the file-store guide renders an executed persistence and restart check', () => {
    const page = html('docs/storage/file-store')
    const text = visibleText(page)
    expect(text).toContain('Persist, reopen, and verify')
    expect(text).toContain('"eventSequences": [')
    expect(text).toContain('1,')
    expect(text).toContain('2')
    expect(text).toContain('"reopenedEventCount": 2')
    expect(text).toContain('"audit": {')
    expect(text).toContain('"ok": true')

    const markdown = readFileSync(join(dist, 'docs/storage/file-store.md'), 'utf8')
    expect(markdown).toContain('createFileEvidenceStore')
    expect(markdown).toContain('"reopenedEventCount": 2')
  })

  test('agent and export guides render their executed verification artifacts', () => {
    const agentText = visibleText(html('docs/ai/agent-events'))
    expect(agentText).toContain('"agent.session.started"')
    expect(agentText).toContain('"rawPromptStored": false')
    expect(agentText).toContain('"edgeRelations": [')

    const exportText = visibleText(html('docs/reference/export-format'))
    expect(exportText).toContain('buildAndVerifyExport')
    expect(exportText).toContain('"bundleVersion": "vevb-1"')
    expect(exportText).toContain('"integrity": false')
  })
})

describe('built internal links', () => {
  test('root-relative page links use canonical trailing slashes and resolve', () => {
    const failures: string[] = []
    for (const file of walk(dist).filter((entry) => entry.endsWith('.html'))) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/href="(\/[^"]*)"/g)) {
        const href = match[1]
        const [pathname] = href.split(/[?#]/)
        if (!pathname || pathname.startsWith('/_') || pathname === '/' || extname(pathname)) continue
        if (!pathname.endsWith('/')) failures.push(`${file}: non-canonical ${href}`)
        const target = join(dist, pathname.replace(/^\//, ''), 'index.html')
        if (!existsSync(target)) failures.push(`${file}: missing ${href}`)
      }
    }
    expect(failures).toEqual([])
  })

  test('internal fragment links resolve to an element ID', () => {
    const failures: string[] = []
    for (const file of walk(dist).filter((entry) => entry.endsWith('.html'))) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/href="([^"#]*)#([^"?]+)"/g)) {
        const [, rawPathname, rawFragment] = match
        if (/^(?:https?:|mailto:|tel:)/.test(rawPathname)) continue
        const fragment = decodeURIComponent(rawFragment)
        const targetFile = rawPathname.startsWith('/')
          ? join(dist, rawPathname.replace(/^\//, ''), 'index.html')
          : file
        if (!existsSync(targetFile)) {
          failures.push(`${file}: missing anchor target ${match[0]}`)
          continue
        }
        const target = readFileSync(targetFile, 'utf8')
        const ids = new Set([...target.matchAll(/\sid="([^"]+)"/g)].map((id) => id[1]))
        if (!ids.has(fragment)) failures.push(`${file}: missing #${fragment} in ${targetFile}`)
      }
    }
    expect(failures).toEqual([])
  })
})

describe('Pagefind search', () => {
  test('indexes only docs, examples, and changelog with representative results', async () => {
    const pagefind = await import(join(dist, 'pagefind/pagefind.js'))
    await pagefind.init()
    const expected: Record<string, string> = {
      'hash chain': '/docs/concepts/hash-chain/',
      FastAPI: '/docs/frameworks/fastapi/',
      redaction: '/docs/concepts/redaction/',
      exports: '/docs/cloud/exports/',
      'copy-pasteable': '/examples/',
      Changelog: '/changelog/',
    }
    for (const [query, intended] of Object.entries(expected)) {
      const search = await pagefind.search(query)
      const rawResults = await Promise.all(search.results.slice(0, 12).map((result: { data: () => Promise<{ url: string }> }) => result.data()))
      const results = rawResults.map((result) => ({ ...result, url: result.url.replace(/^\/file:.*\/dist/, '') }))
      expect(results.some((result) => result.url === intended), query).toBeTrue()
      for (const result of results) {
        expect(result.url, query).toMatch(/^\/(docs|examples|changelog)\//)
      }
    }
  })
})
